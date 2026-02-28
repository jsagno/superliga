# RES (Restricciones Estacionales) Service Layer Documentation

Service layer for managing season card restrictions in Liga Interna's competitive integrity system.

## Overview

The `restrictionsService.js` module provides a complete API for managing restrictions:
- **Read**: Fetch restrictions grouped by player
- **Create**: Single or bulk restriction creation
- **Delete**: Single or bulk restriction deletion
- **Query**: Check for existing restrictions
- **Stats**: Calculate restriction statistics
- **Subscribe**: Real-time updates via Supabase subscriptions

## Installation

No special installation needed - module is in [src/services/restrictionsService.js](./restrictionsService.js)

## Usage

### Import

```javascript
import * as restrictionsService from '../services/restrictionsService';
// or specific functions:
import { fetchRestrictions, createRestriction, deleteRestriction } from '../services/restrictionsService';
```

### Fetch Restrictions

Get all restrictions for a season, grouped by player:

```javascript
try {
  const restrictions = await restrictionsService.fetchRestrictions(seasonId);
  
  // Returns:
  // [
  //   {
  //     player_id: 'uuid',
  //     player_name: 'Player Name',
  //     player_nick: 'Nick',
  //     restrictions: [
  //       {
  //         restriction_id: 'uuid',
  //         card_id: 26000000,
  //         card_name: 'Knight',
  //         card_parsed: { name, icon, rarity, elixir, maxLevel },
  //         reason: 'Optional reason',
  //         created_by: 'admin-uuid',
  //         created_at: '2026-02-27T...'
  //       }
  //     ]
  //   }
  // ]

  restrictions.forEach(playerGroup => {
    console.log(`${playerGroup.player_name} has ${playerGroup.restrictions.length} restrictions`);
  });
} catch (error) {
  console.error('Failed to fetch restrictions:', error);
}
```

### Create Single Restriction

Add one card restriction for a player:

```javascript
const newRestriction = await restrictionsService.createRestriction({
  season_id: seasonId,
  player_id: playerId,
  card_id: 26000000, // Knight
  reason: 'Balance adjustment for Season 5',
  created_by: currentAdminId
});

console.log('Created restriction:', newRestriction.restriction_id);
```

### Bulk Create Restrictions

Add multiple restrictions efficiently (automatically batched):

```javascript
const restrictions = [
  { player_id: 'player-1', card_id: 26000000, reason: 'Ban 1', created_by: adminId },
  { player_id: 'player-1', card_id: 26000001, reason: 'Ban 2', created_by: adminId },
  { player_id: 'player-2', card_id: 26000000, reason: 'Ban 1', created_by: adminId },
  // ... up to 1000s of restrictions
];

const result = await restrictionsService.bulkCreateRestrictions(restrictions, seasonId);

console.log(`✓ Created: ${result.success}`);
console.log(`✗ Failed: ${result.failed}`);
if (result.errors.length > 0) {
  console.error('Batch errors:', result.errors);
}
```

**Features**:
- Automatically splits into batches of 50
- Upserts to avoid duplicate key errors
- Returns summary of successes/failures
- Provides detailed error info per batch

### Delete Single Restriction

Remove one restriction:

```javascript
const deleted = await restrictionsService.deleteRestriction(restrictionId);
console.log(`Deleted: ${deleted.player_id} - Card ${deleted.card_id}`);
```

### Bulk Delete Restrictions

Remove multiple restrictions (useful for undo/rollback):

```javascript
const restrictionIds = ['res-1', 'res-2', 'res-3', ...]; // up to 1000s

const result = await restrictionsService.bulkDeleteRestrictions(restrictionIds);

console.log(`✓ Deleted: ${result.success}`);
console.log(`✗ Failed: ${result.failed}`);

// Can use 'deleted' for undo functionality:
if (result.deleted.length > 0) {
  localStorage.setItem('deleted_restrictions', JSON.stringify(result.deleted));
}
```

### Check For Conflicts

Before bulk creating, verify no duplicates exist:

```javascript
const playerIds = ['player-1', 'player-2'];
const cardIds = [26000000, 26000001];

const existing = await restrictionsService.checkExistingRestrictions(
  seasonId,
  playerIds,
  cardIds
);

if (existing.length > 0) {
  console.warn(`Found ${existing.length} existing restrictions:`, existing);
  // Ask user if they want to skip or upsert
}
```

### Get Statistics

Calculate restriction summary for a season:

```javascript
const stats = await restrictionsService.getRestrictionStats(seasonId);

console.log(`Total restrictions: ${stats.total_restrictions}`);
console.log(`Affected players: ${stats.affected_players}`);
console.log(`Restricted cards: ${stats.restricted_cards}`);
console.log(`By rarity:`, stats.by_rarity);
// Output:
// {
//   total_restrictions: 25,
//   affected_players: 12,
//   restricted_cards: 8,
//   by_rarity: {
//     champion: 3,
//     legendary: 5,
//     epic: 8,
//     rare: 6,
//     common: 3
//   }
// }
```

### Subscribe to Real-Time Changes

Keep multiple browser windows in sync:

```javascript
const subscription = restrictionsService.subscribeToRestrictions(
  seasonId,
  (event) => {
    console.log('Change detected:', event.eventType, event.new);
    
    // Refresh UI based on event type
    if (event.eventType === 'INSERT') {
      // Add new restriction to UI
      addRestrictionToList(event.new);
    } else if (event.eventType === 'DELETE') {
      // Remove from UI
      removeRestrictionFromList(event.old.restriction_id);
    } else if (event.eventType === 'UPDATE') {
      // Update in UI
      updateRestrictionInList(event.new);
    }
  }
);

// Later, cleanup subscription:
subscription.unsubscribe();
```

## React Component Usage

### Example: Restrictions List Page

```javascript
import { useEffect, useState } from 'react';
import * as restrictionsService from '../services/restrictionsService';
import { parseCardPayload, getRarityEmoji } from '../utils/cardParser';

function RestrictionsPage({ seasonId }) {
  const [restrictions, setRestrictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadRestrictions();
    
    // Subscribe to real-time changes
    const subscription = restrictionsService.subscribeToRestrictions(
      seasonId,
      () => loadRestrictions() // Refresh on any change
    );
    
    return () => subscription.unsubscribe();
  }, [seasonId]);

  async function loadRestrictions() {
    try {
      setLoading(true);
      const data = await restrictionsService.fetchRestrictions(seasonId);
      setRestrictions(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Failed to load restrictions:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(restrictionId) {
    if (!confirm('Delete this restriction?')) return;
    
    try {
      await restrictionsService.deleteRestriction(restrictionId);
      // Real-time subscription will trigger reload
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  }

  if (loading) return <div>Loading restrictions...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="restrictions">
      {restrictions.map(playerGroup => (
        <div key={playerGroup.player_id} className="player-group">
          <h3>{playerGroup.player_name}</h3>
          <div className="restriction-cards">
            {playerGroup.restrictions.map(res => (
              <div key={res.restriction_id} className="restriction-card">
                <img src={res.card_parsed.icon} alt={res.card_name} />
                <span>{res.card_name}</span>
                <span className="rarity">
                  {getRarityEmoji(res.card_parsed.rarity)}
                </span>
                {res.reason && <p className="reason">{res.reason}</p>}
                <button
                  onClick={() => handleDelete(res.restriction_id)}
                  className="btn-delete"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default RestrictionsPage;
```

### Example: Bulk Upload from CSV

```javascript
async function handleBulkUpload(csvFile) {
  const text = await csvFile.text();
  const lines = text.split('\n');
  
  const restrictions = [];
  for (const line of lines.slice(1)) { // Skip header
    const [playerTag, cardIdStr, reason] = line.split(',');
    if (!playerTag || !cardIdStr) continue;
    
    // Resolve player tag to ID (example)
    const player = await resolvePlayerTag(playerTag);
    if (!player) {
      console.warn(`Unknown player: ${playerTag}`);
      continue;
    }
    
    restrictions.push({
      player_id: player.player_id,
      card_id: parseInt(cardIdStr),
      reason: reason?.trim() || null,
      created_by: currentAdminId,
    });
  }
  
  const result = await restrictionsService.bulkCreateRestrictions(
    restrictions,
    seasonId
  );
  
  alert(`Created: ${result.success}, Failed: ${result.failed}`);
}
```

## Error Handling

All functions throw errors that should be caught:

```javascript
try {
  const data = await restrictionsService.fetchRestrictions(seasonId);
} catch (error) {
  // Handle specific errors
  if (error.message.includes('seasonId is required')) {
    console.error('Invalid season');
  } else if (error.message.includes('PGRST')) {
    console.error('Database query failed');
  } else {
    console.error('Unknown error:', error);
  }
}
```

## Testing

Run unit tests with:

```bash
npm test -- restrictionsService.test.js
```

Tests are mocked and don't require a database. Mock any API responses as needed in your test environment.

## Performance Considerations

- **Fetching large seasons**: If a season has 10,000+ restrictions, consider pagination (future enhancement)
- **Bulk operations**: Automatically batched in groups of 50 to prevent timeout
- **Real-time subscriptions**: Use selectively - each subscription adds overhead
- **Parsing**: Card parsing happens client-side; cache results if rendering many times

## Batch Processing

All bulk operations automatically split into manageable chunks:

```
Input: 150 restrictions → 3 batches of 50 → 3 requests
Input: 1000 restrictions → 20 batches of 50 → 20 requests
```

Failures are tracked per batch and don't stop other batches from processing.

## Data Flow Diagram

```
┌─ Component (React)
│  ├─ useEffect(() => fetchRestrictions())
│  ├─ onClick → deleteRestriction()
│  ├─ onUpload → bulkCreateRestrictions()
│  └─ subscribe → subscribeToRestrictions()
│
├─ Service Layer (restrictionsService.js)
│  ├─ fetchRestrictions() [SELECT + GROUP]
│  ├─ createRestriction() [INSERT]
│  ├─ bulkCreateRestrictions() [UPSERT in batches]
│  ├─ deleteRestriction() [DELETE]
│  ├─ bulkDeleteRestrictions() [DELETE in batches]
│  ├─ checkExistingRestrictions() [SELECT for conflicts]
│  └─ subscribeToRestrictions() [LISTEN]
│
├─ Supabase Client
│  └─ PostgreSQL Database
│     └─ season_card_restriction table
```

## Related Files

- **Component**: [SeasonCardRestrictions.jsx](../pages/admin/SeasonCardRestrictions.jsx) (to be created)
- **Utilities**: [cardParser.js](../utils/cardParser.js)
- **Database**: `supabase/migrations/20260228000000_add_season_card_restriction.sql`
- **Tests**: [restrictionsService.test.js](./restrictionsService.test.js)

## Troubleshooting

### "seasonId is required" Error
- Verify seasonId is passed and not null/undefined
- Check that season exists in database

### "Cannot read property 'from' of undefined"
- Supabase client might not be initialized
- Check `supabaseClient.js` is properly configured

### Real-time subscription not firing
- Verify user has permission to subscribe to channel
- Check network console for websocket errors
- May need to unsubscribe and re-subscribe

### Bulk operations timing out
- Large batches are automatically split into 50-row chunks
- If still timing out, reduce batch size in code (change BATCH_SIZE constant)
- Consider processing in chunks from frontend instead

## API Reference

See [restrictionsService.js](./restrictionsService.js) for full JSDoc documentation on each function.
