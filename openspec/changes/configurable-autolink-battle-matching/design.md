# Design: Configurable Auto-Link Battle Matching

## Technical Architecture

### System Context

```
┌─────────────────┐
│  Supercell API  │
└────────┬────────┘
         │ CRON syncs battles
         ▼
┌─────────────────────────────────────────┐
│        Supabase Database                │
│  ┌──────────┐  ┌─────────────────────┐ │
│  │  battle  │  │  scheduled_match    │ │
│  │  ├─ id   │  │  ├─ id              │ │
│  │  ├─ time │  │  ├─ scheduled_from  │ │
│  │  └─ mode │  │  ├─ scheduled_to    │ │
│  └──────────┘  │  ├─ status          │ │
│                │  └─ player_a_id     │ │
│  ┌──────────┐  └─────────────────────┘ │
│  │  season  │                           │
│  │  ├─ id   │  ┌──────────────────────┐│
│  │  ├─ battle_cutoff_minutes (NEW)    ││
│  │  └─ battle_cutoff_tz_offset (NEW)  ││
│  └──────────┘  └──────────────────────┘│
└─────────────────────────────────────────┘
         │
         │ autoLinkBattles()
         ▼
┌─────────────────────────────────────────┐
│      LIGA-ADMIN (React Frontend)        │
│  ┌─────────────────────────────────┐   │
│  │  SeasonsList.jsx                │   │
│  │  ├─ autoLinkBattles()           │   │
│  │  │   ├─ Load config from season │   │
│  │  │   ├─ findAvailableBattle()   │   │
│  │  │   └─ disambiguateBattles()   │   │
│  │  └─ Progress UI                 │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │  lib/battleDateUtils.js (NEW)   │   │
│  │  ├─ getBattleDateKey()          │   │
│  │  ├─ scoreBattleQuality()        │   │
│  │  └─ selectBestBattle()          │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │  SeasonEdit.jsx                 │   │
│  │  └─ Cutoff config fields        │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

---

## Data Model Changes

### Season Table Extension

```sql
ALTER TABLE public.season
ADD COLUMN IF NOT EXISTS battle_cutoff_minutes INT DEFAULT 590,
ADD COLUMN IF NOT EXISTS battle_cutoff_tz_offset TEXT DEFAULT '-03:00';

COMMENT ON COLUMN season.battle_cutoff_minutes IS 
  'Minutes to subtract from battle timestamp to determine game date. 
   Default 590 = 09:50 UTC cutoff (battles before this count as previous day)';

COMMENT ON COLUMN season.battle_cutoff_tz_offset IS 
  'Timezone offset for display purposes (e.g., ''-03:00'' for Argentina UTC-3). 
   Does not affect calculation—used only for admin UI clarity';
```

**Rationale:**
- `battle_cutoff_minutes`: Single configurable value, easier than storing time-of-day
- Default 590 maintains current behavior (09:50 UTC)
- Integer type enables arithmetic operations (subtraction from timestamp)
- `battle_cutoff_tz_offset`: String format matches ISO 8601 (e.g., '-03:00', '+05:30')

---

## Core Algorithms

### Algorithm 1: Battle Date Normalization

**Function**: `getBattleDateKey(battleTimestamp, cutoffMinutes)`

**Purpose**: Convert battle timestamp to game date using configurable cutoff.

**Input:**
- `battleTimestamp`: ISO 8601 string (e.g., '2026-02-28T09:45:00Z')
- `cutoffMinutes`: Number (default: 590)

**Output:**
- Game date key as ISO date string (e.g., '2026-02-27' if before cutoff)

**Algorithm:**
```javascript
export function getBattleDateKey(battleTimestamp, cutoffMinutes = 590) {
  const battleTime = new Date(battleTimestamp);
  
  // Subtract cutoff minutes to get effective game time
  const gameTime = new Date(battleTime);
  gameTime.setUTCMinutes(gameTime.getUTCMinutes() - cutoffMinutes);
  
  // Extract date in UTC (YYYY-MM-DD)
  const yyyy = gameTime.getUTCFullYear();
  const mm = String(gameTime.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(gameTime.getUTCDate()).padStart(2, '0');
  
  return `${yyyy}-${mm}-${dd}`;
}
```

**Example:**
```javascript
// Battle at 09:45 UTC on Feb 28
getBattleDateKey('2026-02-28T09:45:00Z', 590)
// → '2026-02-27' (45 minutes before 09:50 cutoff = yesterday)

// Battle at 10:05 UTC on Feb 28
getBattleDateKey('2026-02-28T10:05:00Z', 590)
// → '2026-02-28' (15 minutes after cutoff = today)
```

**Test Cases:**
1. Battle exactly at cutoff → same date
2. Battle 1 minute before cutoff → previous date
3. Battle 1 minute after cutoff → same date
4. Battle at midnight UTC → previous date (0:00 < 09:50)
5. Custom cutoff (e.g., 300 minutes = 05:00 UTC)

---

### Algorithm 2: Battle Quality Scoring

**Function**: `scoreBattleQuality(battle, scheduledFrom, scheduledTo, cutoffMinutes, bestOf)`

**Purpose**: Assign quality score to battle candidate for disambiguation.

**Input:**
- `battle`: Battle object with `{ battle_id, battle_time, round_count, raw_payload }`
- `scheduledFrom`: ISO timestamp of scheduled window start
- `scheduledTo`: ISO timestamp of scheduled window end
- `cutoffMinutes`: Season cutoff configuration
- `bestOf`: Expected best_of value from scheduled_match

**Output:**
- Score object: `{ total: number (0-100), breakdown: { proximity, completeness, windowFit, deckValidity } }`

**Algorithm:**
```javascript
export function scoreBattleQuality(battle, scheduledFrom, scheduledTo, cutoffMinutes, bestOf) {
  const battleTime = new Date(battle.battle_time);
  const from = new Date(scheduledFrom);
  const to = new Date(scheduledTo);
  
  // 1. Time Proximity Score (40 points)
  // Distance from scheduled window midpoint
  const midpoint = new Date((from.getTime() + to.getTime()) / 2);
  const deltaMs = Math.abs(battleTime.getTime() - midpoint.getTime());
  const maxDelta = 12 * 60 * 60 * 1000; // 12 hours
  const proximityScore = Math.max(0, 40 * (1 - deltaMs / maxDelta));
  
  // 2. Battle Completeness Score (30 points)
  // Higher round_count indicates more complete battle
  const expectedRounds = bestOf || 1;
  const completenessRatio = Math.min(1, battle.round_count / expectedRounds);
  const completenessScore = 30 * completenessRatio;
  
  // 3. Window Fit Score (20 points)
  // Battle fully within window gets full points
  const fullyWithin = battleTime >= from && battleTime <= to;
  const battleDateKey = getBattleDateKey(battle.battle_time, cutoffMinutes);
  const scheduledDateKey = getBattleDateKey(scheduledFrom, cutoffMinutes);
  const dateMatches = battleDateKey === scheduledDateKey;
  
  let windowFitScore = 0;
  if (fullyWithin && dateMatches) {
    windowFitScore = 20;
  } else if (dateMatches) {
    windowFitScore = 15; // Right date, outside strict window
  } else if (fullyWithin) {
    windowFitScore = 10; // Right time window, wrong game date
  }
  
  // 4. Deck Validity Score (10 points)
  // Battles with complete deck data score higher
  const deckValidity = battle.raw_payload?.team 
    ? 10 
    : 0;
  
  const total = proximityScore + completenessScore + windowFitScore + deckValidity;
  
  return {
    total: Math.round(total * 10) / 10, // Round to 1 decimal
    breakdown: {
      proximity: Math.round(proximityScore * 10) / 10,
      completeness: Math.round(completenessScore * 10) / 10,
      windowFit: windowFitScore,
      deckValidity: deckValidity
    }
  };
}
```

**Scoring Weights Rationale:**
- **Proximity (40%)**: Most important—battles should occur near scheduled time
- **Completeness (30%)**: Full battles preferred over incomplete (indicates legitimate match)
- **Window Fit (20%)**: Secondary check for boundary correctness
- **Deck Validity (10%)**: Nice-to-have for future analysis, low weight

**Example Scenarios:**

| Battle Time | Midpoint Delta | Round Count | Window Fit | Deck | Total Score |
|-------------|----------------|-------------|------------|------|-------------|
| 10:00 (midpoint) | 0 min | 3/3 | Within + Date Match | ✓ | **100** |
| 09:55 (5m before) | 5 min | 3/3 | Within + Date Match | ✓ | **98** |
| 10:15 (15m after) | 15 min | 2/3 | Within + Date Match | ✓ | **90** |
| 09:45 (edge) | 15 min | 3/3 | Date Match Only | ✓ | **85** |
| 10:30 (wrong date) | 30 min | 3/3 | Within Only | ✓ | **60** |

---

### Algorithm 3: Battle Disambiguation

**Function**: `selectBestBattle(candidates, scheduledFrom, scheduledTo, cutoffMinutes, bestOf)`

**Purpose**: Choose best battle from multiple candidates.

**Input:**
- `candidates`: Array of battle objects
- Context parameters (same as scoreBattleQuality)

**Output:**
- `{ battle: selected_battle, score: score_object, reason: string }`

**Algorithm:**
```javascript
export function selectBestBattle(candidates, scheduledFrom, scheduledTo, cutoffMinutes, bestOf) {
  if (!candidates || candidates.length === 0) {
    return null;
  }
  
  if (candidates.length === 1) {
    const score = scoreBattleQuality(candidates[0], scheduledFrom, scheduledTo, cutoffMinutes, bestOf);
    return {
      battle: candidates[0],
      score: score,
      reason: 'SINGLE_CANDIDATE'
    };
  }
  
  // Score all candidates
  const scored = candidates.map(battle => ({
    battle,
    score: scoreBattleQuality(battle, scheduledFrom, scheduledTo, cutoffMinutes, bestOf)
  }));
  
  // Sort by total score descending
  scored.sort((a, b) => b.score.total - a.score.total);
  
  const winner = scored[0];
  const runnerUp = scored[1];
  
  // Determine reason
  let reason = 'HIGHEST_SCORE';
  const scoreDiff = winner.score.total - runnerUp.score.total;
  
  if (scoreDiff > 20) {
    reason = 'CLEAR_WINNER'; // Significant score difference
  } else if (scoreDiff < 5) {
    reason = 'CLOSE_CALL'; // Very close scores, may need review
  }
  
  return {
    battle: winner.battle,
    score: winner.score,
    reason: reason,
    alternatives: scored.slice(1).map(s => ({
      battle_id: s.battle.battle_id,
      score: s.score.total
    }))
  };
}
```

**Decision Logging:**
```javascript
console.log(`[AUTO-LINK DISAMBIGUATION] Match ${scheduledMatchId}:`, {
  player: playerName,
  scheduled: { from: scheduledFrom, to: scheduledTo },
  candidates: candidates.length,
  winner: {
    battle_id: result.battle.battle_id,
    battle_time: result.battle.battle_time,
    score: result.score.total,
    breakdown: result.score.breakdown
  },
  reason: result.reason,
  alternatives: result.alternatives
});
```

---

## Component Integration

### SeasonsList.jsx Refactor

**Current Function**:
```javascript
async function findAvailableBattle(playerId, scheduledFrom, scheduledTo, stage, scheduledMatchId) {
  // ... fetch battles in time range ...
  // Return first match (no disambiguation)
  return battles && battles.length > 0 ? battles[0] : null;
}
```

**Enhanced Function**:
```javascript
import { getBattleDateKey, selectBestBattle } from '../lib/battleDateUtils';

async function findAvailableBattle(playerId, scheduledFrom, scheduledTo, stage, scheduledMatchId, cutoffMinutes, bestOf) {
  try {
    // Add buffer to catch edge cases (30 minutes before/after)
    const buffer = 30 * 60 * 1000; // 30 minutes in ms
    const fromDate = new Date(new Date(scheduledFrom).getTime() - buffer);
    const toDate = new Date(new Date(scheduledTo).getTime() + buffer);
    
    const fromISO = fromDate.toISOString();
    const toISO = toDate.toISOString();
    
    // Fetch battles (same as before)
    // ... existing battle fetch logic ...
    
    const { data: battles } = await battleQuery;
    
    if (!battles || battles.length === 0) {
      return null;
    }
    
    // Filter battles matching the scheduled game date
    const scheduledDateKey = getBattleDateKey(scheduledFrom, cutoffMinutes);
    const matchingBattles = battles.filter(b => {
      const battleDateKey = getBattleDateKey(b.battle_time, cutoffMinutes);
      return battleDateKey === scheduledDateKey;
    });
    
    if (matchingBattles.length === 0) {
      console.warn(`No battles match scheduled date ${scheduledDateKey} for player ${playerId}`);
      return null;
    }
    
    // Disambiguate if multiple candidates
    const result = selectBestBattle(matchingBattles, scheduledFrom, scheduledTo, cutoffMinutes, bestOf);
    
    if (result && result.reason !== 'SINGLE_CANDIDATE') {
      console.log(`[DISAMBIGUATION] Match ${scheduledMatchId}: ${result.reason}`, {
        winner: result.battle.battle_id,
        score: result.score.total,
        alternatives: result.alternatives
      });
    }
    
    return result ? result.battle : null;
  } catch (error) {
    console.error("Error finding available battle:", error);
    return null;
  }
}
```

**Changes in autoLinkBattles()**:
```javascript
async function autoLinkBattles(seasonId, testPlayerId = null) {
  // ... existing setup ...
  
  // LOAD SEASON CONFIG (NEW)
  const { data: seasonData, error: seasonError } = await supabase
    .from('season')
    .select('battle_cutoff_minutes, battle_cutoff_tz_offset')
    .eq('season_id', seasonId)
    .single();
  
  if (seasonError) {
    console.error('Failed to load season config:', seasonError);
    return;
  }
  
  const cutoffMinutes = seasonData?.battle_cutoff_minutes || 590; // Default fallback
  
  // ... existing match fetching ...
  
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    
    // PASS CUTOFF TO findAvailableBattle (NEW)
    const availableBattle = await findAvailableBattle(
      match.player_a_id,
      match.scheduled_from,
      match.scheduled_to,
      match.stage,
      match.scheduled_match_id,
      cutoffMinutes,      // NEW PARAMETER
      match.best_of       // NEW PARAMETER
    );
    
    // ... rest of linking logic unchanged ...
  }
}
```

---

### SeasonEdit.jsx UI

**New Fields:**
```jsx
function SeasonEdit() {
  const [battleCutoffMinutes, setBattleCutoffMinutes] = useState(590);
  const [battleCutoffTzOffset, setBattleCutoffTzOffset] = useState('-03:00');
  
  // Load existing values
  useEffect(() => {
    if (season) {
      setBattleCutoffMinutes(season.battle_cutoff_minutes || 590);
      setBattleCutoffTzOffset(season.battle_cutoff_tz_offset || '-03:00');
    }
  }, [season]);
  
  // Save logic
  async function handleSave() {
    const payload = {
      // ... existing fields ...
      battle_cutoff_minutes: battleCutoffMinutes,
      battle_cutoff_tz_offset: battleCutoffTzOffset
    };
    
    // ... existing save logic ...
  }
  
  return (
    <form>
      {/* Existing fields */}
      
      <div className="form-section">
        <h3>Battle Auto-Link Configuration</h3>
        
        <label>
          Battle Cutoff Time (minutes before midnight UTC)
          <input 
            type="number" 
            min="0" 
            max="1440"
            value={battleCutoffMinutes}
            onChange={(e) => setBattleCutoffMinutes(parseInt(e.target.value))}
          />
          <small>
            Current: {Math.floor(battleCutoffMinutes / 60)}:{String(battleCutoffMinutes % 60).padStart(2, '0')} UTC
            ({battleCutoffTzOffset} local)
          </small>
        </label>
        
        <label>
          Timezone Offset (display only)
          <select 
            value={battleCutoffTzOffset}
            onChange={(e) => setBattleCutoffTzOffset(e.target.value)}
          >
            <option value="-03:00">Argentina (UTC-3)</option>
            <option value="-05:00">US Eastern (UTC-5)</option>
            <option value="+00:00">UTC</option>
            <option value="+01:00">Central Europe (UTC+1)</option>
          </select>
        </label>
        
        <div className="info-box">
          <strong>How it works:</strong> Battles before {Math.floor(battleCutoffMinutes / 60)}:
          {String(battleCutoffMinutes % 60).padStart(2, '0')} UTC count as the previous day.
          Default is 09:50 UTC (06:50 Argentina time).
        </div>
      </div>
    </form>
  );
}
```

---

### SeasonDailyPoints.jsx Refactor

**Current:**
```javascript
function getDateKey(timestamptz) {
  const gameTime = new Date(timestamptz);
  gameTime.setUTCMinutes(gameTime.getUTCMinutes() - 590); // HARDCODED
  // ... return date string ...
}
```

**Refactored:**
```javascript
import { getBattleDateKey } from '../lib/battleDateUtils';

function SeasonDailyPoints() {
  const [cutoffMinutes, setCutoffMinutes] = useState(590);
  
  // Load season config on mount
  useEffect(() => {
    async function loadConfig() {
      const { data } = await supabase
        .from('season')
        .select('battle_cutoff_minutes')
        .eq('season_id', seasonId)
        .single();
      
      setCutoffMinutes(data?.battle_cutoff_minutes || 590);
    }
    loadConfig();
  }, [seasonId]);
  
  // Use utility function with loaded config
  function getDateKey(timestamptz) {
    return getBattleDateKey(timestamptz, cutoffMinutes);
  }
  
  // ... rest of component uses getDateKey() as before ...
}
```

---

## Testing Strategy

### Unit Tests

**File**: `packages/liga-admin/src/lib/battleDateUtils.test.js`

```javascript
import { describe, test, expect } from '@jest/globals';
import { getBattleDateKey, scoreBattleQuality, selectBestBattle } from './battleDateUtils';

describe('getBattleDateKey', () => {
  test('battle before cutoff counts as previous day', () => {
    // 09:45 UTC on Feb 28 with 590min cutoff → Feb 27
    expect(getBattleDateKey('2026-02-28T09:45:00Z', 590)).toBe('2026-02-27');
  });
  
  test('battle after cutoff counts as same day', () => {
    // 10:05 UTC on Feb 28 with 590min cutoff → Feb 28
    expect(getBattleDateKey('2026-02-28T10:05:00Z', 590)).toBe('2026-02-28');
  });
  
  test('battle exactly at cutoff', () => {
    // 09:50 UTC on Feb 28 with 590min cutoff → Feb 28
    expect(getBattleDateKey('2026-02-28T09:50:00Z', 590)).toBe('2026-02-28');
  });
  
  test('custom cutoff (5 hours = 300 minutes)', () => {
    // 04:30 UTC on Feb 28 with 300min cutoff → Feb 27
    expect(getBattleDateKey('2026-02-28T04:30:00Z', 300)).toBe('2026-02-27');
  });
});

describe('scoreBattleQuality', () => {
  const scheduled = {
    from: '2026-02-28T08:00:00Z',
    to: '2026-02-28T20:00:00Z'
  };
  
  test('perfect battle (midpoint, complete, within) scores 100', () => {
    const battle = {
      battle_id: 1,
      battle_time: '2026-02-28T14:00:00Z', // Midpoint
      round_count: 3,
      raw_payload: { team: [] }
    };
    
    const score = scoreBattleQuality(battle, scheduled.from, scheduled.to, 590, 3);
    expect(score.total).toBeGreaterThan(95);
  });
  
  test('incomplete battle scores lower', () => {
    const battle = {
      battle_id: 2,
      battle_time: '2026-02-28T14:00:00Z',
      round_count: 1, // Only 1/3 rounds
      raw_payload: { team: [] }
    };
    
    const score = scoreBattleQuality(battle, scheduled.from, scheduled.to, 590, 3);
    expect(score.total).toBeLessThan(80);
    expect(score.breakdown.completeness).toBeLessThan(15); // 30 * (1/3)
  });
});

describe('selectBestBattle', () => {
  test('single candidate returns immediately', () => {
    const candidates = [{ battle_id: 1, battle_time: '2026-02-28T10:00:00Z', round_count: 3 }];
    const result = selectBestBattle(candidates, '2026-02-28T08:00:00Z', '2026-02-28T20:00:00Z', 590, 3);
    
    expect(result.reason).toBe('SINGLE_CANDIDATE');
    expect(result.battle.battle_id).toBe(1);
  });
  
  test('selects higher-scoring battle', () => {
    const candidates = [
      { battle_id: 1, battle_time: '2026-02-28T09:45:00Z', round_count: 1 }, // Edge, incomplete
      { battle_id: 2, battle_time: '2026-02-28T14:00:00Z', round_count: 3 }  // Midpoint, complete
    ];
    
    const result = selectBestBattle(candidates, '2026-02-28T08:00:00Z', '2026-02-28T20:00:00Z', 590, 3);
    
    expect(result.battle.battle_id).toBe(2);
    expect(result.reason).toBe('CLEAR_WINNER');
  });
});
```

---

### E2E Tests

**File**: `packages/liga-admin/tests/e2e/autolink-configurable.spec.js`

```javascript
import { test, expect } from '@playwright/test';
import { loginAdmin } from './helpers.js';

test.describe('Configurable Auto-Link', () => {
  test('T1: Admin can configure battle cutoff in season edit', async ({ page }) => {
    await loginAdmin(page);
    await page.goto('/admin/seasons');
    
    // Click first season edit
    await page.locator('a[href*="/admin/seasons/"]').first().click();
    
    // Change cutoff to 7 hours (420 minutes)
    await page.fill('input[type="number"][value="590"]', '420');
    await page.selectOption('select', '-03:00');
    
    // Save and verify
    await page.click('button:has-text("Save")');
    await page.waitForTimeout(1000);
    
    // Reload and check persistence
    await page.reload();
    const cutoffInput = await page.inputValue('input[type="number"]');
    expect(cutoffInput).toBe('420');
  });
  
  test('T2: Auto-link uses season cutoff configuration', async ({ page }) => {
    // Setup: Create test season with custom cutoff
    // Trigger auto-link
    // Verify console logs show correct cutoff in use
    // (Requires mock battles at edge times)
  });
  
  test('T3: Disambiguation selects higher-quality battle', async ({ page }) => {
    // Setup: Insert 2 battles for same player/date (one incomplete, one complete)
    // Trigger auto-link
    // Verify complete battle is selected
    // Check console logs for disambiguation reason
  });
});
```

---

## Performance Considerations

### Query Optimization

**Current Battle Fetch:**
```sql
SELECT battle_id, battle_time, round_count
FROM battle
WHERE battle_id IN (...)
  AND api_game_mode = 'CW_Duel_1v1'
  AND battle_time >= '2026-02-28T08:00:00Z'
  AND battle_time <= '2026-02-28T20:00:00Z'
ORDER BY battle_time ASC
LIMIT 10; -- Fetch top 10 instead of 1 for disambiguation
```

**Indexes Required:**
- `battle(battle_time, api_game_mode)` - Already exists
- `battle(battle_id)` - Primary key

**Buffer Impact:**
- Adding 30-minute buffer increases result set by ~10-20% (minimal)
- Disambiguation scoring for 2-5 candidates: <10ms per match

### Memory Footprint

- Disambiguation: Load 10 battles max per scheduled_match (vs 1 currently)
- Additional memory: ~500 KB for 100 scheduled matches with 10 candidates each
- Acceptable for async background operation

---

## Migration Plan

### Phase 1: Database Schema (Week 1)
1. Create migration: `20260300000000_add_battle_cutoff_config.sql`
2. Add columns with defaults (no data loss)
3. Deploy to test environment
4. Validate queries work with default values

### Phase 2: Utility Module (Week 1)
1. Create `lib/battleDateUtils.js` with functions
2. Write unit tests (95%+ coverage)
3. Document API contracts (JSDoc)
4. Code review + approval

### Phase 3: Component Integration (Week 2)
1. Refactor `SeasonsList.jsx` (autoLinkBattles, findAvailableBattle)
2. Update `SeasonDailyPoints.jsx` to use utility
3. Add SeasonEdit UI fields
4. E2E tests for configuration UI

### Phase 4: Testing & Validation (Week 2)
1. Run E2E test suite on test environment
2. Manual testing with real battle data
3. Performance profiling (query timing, scoring overhead)
4. Edge case validation (midnight battles, month boundaries)

### Phase 5: Deployment (Week 3)
1. Deploy database migration to production
2. Deploy frontend changes
3. Monitor auto-link runs for 1 week
4. Collect admin feedback
5. Tune scoring weights if needed

---

## Rollback Plan

If disambiguation causes issues:
1. **Database**: Columns are additive, safe to leave (default values maintain current behavior)
2. **Frontend**: Revert to previous commit (disambiguation optional, not breaking)
3. **Hotfix**: Disable disambiguation by setting scoring threshold very high (force single match)

---

## Future Enhancements

1. **Admin Disambiguation UI**: Show scoring details in a modal for manual review
2. **Re-process Historical Links**: Batch job to re-run auto-link with new config on past seasons
3. **Zone-Level Cutoff**: Override season cutoff per zone (if regions span timezones)
4. **Machine Learning**: Train scoring weights based on admin corrections
5. **Real-Time Preview**: Show estimated battle matches before running auto-link

---

**Status**: Ready for Spec Phase  
**Complexity**: Medium  
**Estimated Effort**: 2-3 weeks (including testing)
