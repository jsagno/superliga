# Agent Integration Guide

## Overview

This guide explains how to use OpenSpec specifications when working on Liga Interna features. The specs are designed to be both human-readable and AI-agent friendly.

## Quick Start for Agents

### 1. Before Starting Any Feature

**Always read the spec first:**

```
Your Task: "Implement player ranking display"

STEP 1: Read the spec
→ /openspec/specs/admin-dashboard.md (REQ-1: Player Rankings)
→ /openspec/specs/data-models.md (Player interface)
→ /openspec/design.md (Database schema)

STEP 2: Extract requirements
- Display players sorted by trophies (descending)
- Show name, trophies, best trophies, role
- Include contribution rating calculation
- Support filtering by role
- Mobile-responsive table

STEP 3: Implement with these constraints
- Use columns from data model spec
- Validate form per spec rules
- Test scenarios from spec
```

### 2. Understand Data Models First

Every spec references the **data model** it uses. Always check:

`/openspec/specs/data-models.md`

```markdown
### Player
- Fields: tag, name, trophies, best_trophies, clan_id, last_sync
- Validation: tag must match pattern, trophies non-negative
- Examples: See integration points section
```

### 3. Reference Spec Sections in Code

When implementing, add comments linking to specs:

```typescript
// SPEC: /openspec/specs/admin-dashboard.md (REQ-1)
// SCENARIO: View Clan Standings
// Display players ranked by trophies descending
const sortedPlayers = players.sort((a, b) => b.trophies - a.trophies);

// VALIDATION: /openspec/specs/data-models.md
// Trophy values must be non-negative
if (player.trophies < 0) {
  throw new Error('Invalid trophy count');
}
```

```python
# SPEC: /openspec/specs/clash-sync-cron.md (REQ-2: Data Sync)
# Retry failed API requests up to 5 times with exponential backoff
for attempt in range(1, MAX_RETRIES + 1):
    try:
        return fetch_from_api()
    except RequestException as e:
        if attempt < MAX_RETRIES:
            wait_time = INITIAL_BACKOFF * (BACKOFF_MULTIPLIER ** (attempt - 1))
            time.sleep(wait_time)
```

## How to Read Specs

### Anatomy of a Spec Section

```markdown
### REQ-X: Clear Requirement Title
The system SHALL [specific, testable behavior]

### Scenario: Real Use Case
- **GIVEN** [initial condition]
- **WHEN** [user action or system event]
- **THEN** [expected outcome]
- **AND** [additional outcome]
```

**Translation for agents:**
- `REQ-X` = Must implement this behavior
- `SHALL` = Non-negotiable requirement
- `Scenario` segments are your test cases
- `GIVEN/WHEN/THEN` is BDD format (Behavior-Driven Development)

### Example: Extract Requirements

**Spec snippet:**
```markdown
### REQ-1: Player Rankings
- The system SHALL display ranked list of clan members sorted by trophies
- The system SHALL show player name, trophies, best trophies, role
- The system SHALL calculate player contribution rating

### Scenario: View Clan Standings
- GIVEN admin opens the dashboard
- WHEN dashboard loads
- THEN display clan overview card
- AND display ranked player table
```

**What agents implement:**
1. Fetch players from DB
2. Sort by trophies descending (REQ-1)
3. Calculate contribution = (battles + wins) / time_period (REQ-1)
4. Display in table with: name, trophies, best_trophies, role, contribution (REQ-1)
5. Test: Load dashboard → see clan card + sorted table (Scenario test)

## Spec Navigation Map

### For Frontend Features
```
START: /openspec/specs/admin-dashboard.md
  ↓ Find your feature (e.g., REQ-1: Player Rankings)
  ↓ Read scenarios (GIVEN/WHEN/THEN)
  ↓ Link to data models
  ↓ /openspec/specs/data-models.md (check Player interface)
  ↓ Link to design
  ↓ /openspec/design.md (see API endpoints)
```

### For Backend/Sync Features
```
START: /openspec/specs/clash-sync-cron.md
  ↓ Find your requirement (e.g., REQ-1: API Ingestion)
  ↓ Read scenarios (error cases, rate limits)
  ↓ Link to data models
  ↓ /openspec/specs/data-models.md (check validation rules)
  ↓ Link to design
  ↓ /openspec/design.md (see database schema, deployment)
```

### For Data Structure Questions
```
ALWAYS: /openspec/specs/data-models.md
  - Field names and types
  - Validation rules
  - Relationships (FKs)
  - Constraints (unique, required)
```

## Implementation Workflow

### Phase 1: Planning
```
Agent: "I'll implement REQ-1: Player Rankings"

Task Breakdown (cite spec):
1. Create PlayerTable component
   - Spec: /openspec/specs/admin-dashboard.md (REQ-1)
   - Columns: name, trophies, best_trophies, role, contribution
   - Sort: by trophies DESC
   - Filter: by role (optional feature)

2. Implement sort logic
   - Spec: /openspec/design.md (Performance targets: <200ms for sort)
   - Use Array.sort() with trophy comparison

3. Add mobile responsiveness
   - Spec: /openspec/specs/admin-dashboard.md (REQ-7)
   - Hide columns on mobile: best_trophies, contribution

4. Test scenarios
   - Spec: /openspec/specs/admin-dashboard.md (Scenario: View Clan Standings)
   - Load dashboard → see sorted table
```

### Phase 2: Implementation
```typescript
// File: src/components/PlayerRanking.jsx
// SPEC: /openspec/specs/admin-dashboard.md (REQ-1, REQ-7)
// SCENARIO: View Clan Standings

import usePlayerRankings from '@/hooks/usePlayerRankings';

export default function PlayerRanking() {
  const { players, loading } = usePlayerRankings();
  
  // REQUIREMENT: Sort by trophies descending
  const sorted = [...players].sort((a, b) => b.trophies - a.trophies);
  
  // Test: Scenario - "THEN display in ranked table"
  return (
    <table className="w-full">
      <thead>
        <tr>
          <th>Rank</th>
          <th>Name</th>
          <th>Trophies</th>
          <th className="hidden md:table-cell">Best</th>
          <th>Role</th>
          <th className="hidden lg:table-cell">Contribution</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((player, idx) => (
          <tr key={player.id}>
            <td>{idx + 1}</td>
            <td>{player.name}</td>
            <td>{player.trophies}</td>
            <td className="hidden md:table-cell">{player.best_trophies}</td>
            <td>{player.role}</td>
            <td className="hidden lg:table-cell">
              {calculateContribution(player)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### Phase 3: Validation
```
Checklist before committing:

□ Implemented all requirements (grep for "REQ-" in spec)
□ Tested all scenarios (WHEN/THEN from spec)
□ Validated data per spec rules
  (/openspec/specs/data-models.md)
□ Met performance targets
  (/openspec/design.md - Performance Targets)
□ Added spec citations in code comments
□ Updated or noted any spec deviations in PR
```

## Common Scenarios

### Scenario A: "When do I use service role vs anon key?"

**Check spec:**
- `/openspec/design.md` → Database Schema → Row Level Security
- Service role: writes from cron job (authenticated)
- Anon key: reads from frontend (public data)

```typescript
// SPEC: /openspec/design.md (Security section)
// Frontend uses anon key (read-only, public data)
const supabase = createClient(API_URL, ANON_KEY);
const players = await supabase
  .from('players')
  .select('*')
  .order('trophies', { ascending: false });

// Cron uses service role key (write access)
# SPEC: /openspec/design.md (Backend Deployment)
# Service role can write players, battles, snapshots
client = supabase.create_client(SUPABASE_URL, SERVICE_ROLE_KEY)
client.table('players').upsert(player_data)
```

### Scenario B: "How often should cron run?"

**Check spec:**
- `/openspec/specs/clash-sync-cron.md` → REQ-1
- Clan data: every 30 minutes
- Battle logs: every 60 minutes

```python
# SPEC: /openspec/specs/clash-sync-cron.md (REQ-1)
# Fetch clan data every 30 minutes
CLAN_SYNC_INTERVAL = 30  # minutes
BATTLE_SYNC_INTERVAL = 60  # minutes
```

### Scenario C: "What fields does a Player have?"

**Check spec:**
- `/openspec/specs/data-models.md` → Player interface
- Always the canonical reference

```
From spec: name, tag, trophies, best_trophies, clan_id, last_sync, created_at, updated_at
Use these exact field names in code - don't invent new ones!
```

### Scenario D: "If API call fails, what should I do?"

**Check spec:**
- `/openspec/specs/clash-sync-cron.md` → REQ-4: Error Handling
- Retry up to 5 times with exponential backoff
- Skip individual players on persistent failure
- Alert if >50% failures

```python
# SPEC: /openspec/specs/clash-sync-cron.md (REQ-4)
MAX_RETRIES = 5
INITIAL_BACKOFF = 1  # second

successful = 0
failed = 0

for player in players:
    for attempt in range(MAX_RETRIES):
        try:
            fetch_battles(player)
            successful += 1
            break
        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                wait = INITIAL_BACKOFF * (2 ** attempt)
                time.sleep(wait)
            else:
                failed += 1
                log(f"Failed to sync {player.tag}")

if failed / (successful + failed) > 0.5:
    alert("Sync failure rate >50%")
```

## Troubleshooting

### Problem: "Spec doesn't cover my use case"

**Solution:**
1. Check if it's already in the spec (search carefully)
2. Ask: "Should be in REQ-X but I can't find details"
3. Propose update to spec (discussion point)
4. For now, document decision in code:
   ```python
   # NOTE: Spec /openspec/specs/clash-sync-cron.md doesn't cover
   # incremental batch processing after rate limit.
   # Implementing exponential backoff strategy.
   ```

### Problem: "Data doesn't match spec"

**Solution:**
1. Check if your code matches `/openspec/specs/data-models.md`
2. Common issues:
   - Using wrong field name (snake_case vs camelCase)
   - Allowing null when spec says NOT NULL
   - Wrong data type (string vs int)
   ```python
   # VALIDATION per spec: /openspec/specs/data-models.md
   # Player.trophies must be: int, non-negative
   if not isinstance(player['trophies'], int):
       raise ValueError(f"Invalid trophy type: {type(player['trophies'])}")
   if player['trophies'] < 0:
       raise ValueError(f"Invalid trophy value: {player['trophies']}")
   ```

### Problem: "I need to change something in the spec"

**Process:**
1. Work in code first (don't edit spec mid-feature)
2. After feature is done, propose spec update
3. Update relevant spec file with rationale
4. Example:
   ```markdown
   ### Change: Increased retry attempts from 3 to 5
   Rationale: Rate limit failures were too frequent with 3 attempts.
   Reduced success rate from 92% to 96% with 5 attempts.
   See PR #123 for details.
   
   OLD: retry_max_attempts = 3
   NEW: retry_max_attempts = 5
   ```

## Tips for Agents

1. **Always Link Back to Spec**
   - Comments should cite `/openspec/specs/filename.md (REQ-X)`
   - PRs should reference specs being implemented
   - Makes it easy for humans to verify requirements

2. **Test Against Scenarios**
   - Each spec has GIVEN/WHEN/THEN scenarios
   - Write tests that match scenario names
   - Example test:
     ```python
     def test_scenario_view_clan_standings():
         # GIVEN admin opens dashboard
         response = client.get('/api/clan/standings')
         # WHEN dashboard loads
         assert response.status_code == 200
         # THEN display player table sorted by trophies
         players = response.json()['players']
         assert players == sorted(players, key=lambda p: p['trophies'], reverse=True)
     ```

3. **Batch Related Changes**
   - Don't change data model in isolation
   - Update frontend + backend + spec together
   - Reduces desync risk

4. **Ask When Unclear**
   - Specs should be clear enough to act on
   - If you don't understand, it's probably unclear for others too
   - Suggestion: propose spec improvement to team

## Summary

**Golden Rule:** Specs are the constitutional law of this repo. Code must conform to specs, not the other way around.

**Three-Step Process:**
1. **Read** the relevant spec section
2. **Implement** per spec requirements
3. **Test** against spec scenarios

**Key Files to Bookmark:**
- `/openspec/specs/data-models.md` - Field definitions
- `/openspec/specs/admin-dashboard.md` - Frontend features
- `/openspec/specs/clash-sync-cron.md` - Backend/sync logic
- `/openspec/design.md` - Architecture & tech decisions

---

Questions? Check the spec first, then ask the team.
