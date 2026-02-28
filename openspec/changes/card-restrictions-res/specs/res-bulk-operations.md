# Capability: RES Bulk Operations

## Overview

The Bulk Operations capability enables administrators to create or delete multiple card restrictions simultaneously. This workflow allows selecting N players and M cards to generate N×M restrictions in a single transaction, significantly improving efficiency compared to individual restriction creation.

## User Stories

### Story 1: Create Bulk Restrictions

**As an** admin  
**I want to** apply the same card restrictions to multiple players at once  
**So that** I can enforce rules efficiently

**Acceptance Criteria**:
- Select multiple players (N)
- Select multiple cards (M)
- Preview shows N×M restrictions to be created
- "Apply Restrictions" button creates all at once
- Success message shows count: "X restrictions created"
- Failed restrictions are reported with details
- Operation completes in < 5 seconds for 100 restrictions

### Story 2: Preview Before Apply

**As an** admin  
**I want to** see exactly what restrictions will be created  
**So that** I can verify before committing

**Acceptance Criteria**:
- Preview table shows player × card matrix
- Each cell represents one restriction
- Duplicate restrictions are highlighted
- Already-restricted combinations show warning icon
- "X new restrictions will be created" counter
- "Cancel" button available before apply

### Story 3: Handle Duplicates Gracefully

**As an** admin  
**I want** duplicate restrictions to be ignored  
**So that** I don't get errors when re-applying rules

**Acceptance Criteria**:
- Duplicate restrictions (same season+player+card) are ignored
- System uses `UPSERT` logic (insert or update)
- Success message distinguishes: "X created, Y already existed"
- No error thrown for duplicates
- Existing restriction metadata (created_at, created_by) preserved

### Story 4: Partial Success Handling

**As an** admin  
**I want** to see which restrictions succeeded vs failed  
**So that** I can troubleshoot issues

**Acceptance Criteria**:
- If some restrictions fail, show which ones
- Display: "150 succeeded, 5 failed"
- Failed list shows player name + card name + error reason
- Option to "Retry Failed" without re-selecting
- Successful restrictions are visible immediately

### Story 5: Bulk Delete by Criteria

**As an** admin  
**I want to** delete multiple restrictions at once  
**So that** I can quickly remove outdated rules

**Acceptance Criteria**:
- Filter restrictions by: player, zone, card, rarity
- "Select All" checkbox for filtered results
- Confirmation dialog shows count: "Delete X restrictions?"
- Successful deletion updates list immediately
- Undo available for 10 seconds after bulk delete

### Story 6: Reason Field (Optional)

**As an** admin  
**I want to** add a reason when creating restrictions  
**So that** I can document why rules were applied

**Acceptance Criteria**:
- Optional "Reason" text field during bulk creation
- Reason is applied to all N×M restrictions
- Reason is visible in restriction details
- 500 character limit
- Pre-filled suggestions: "Tournament Rule", "Fair Play", "Meta Balance"

## Technical Specification

### Bulk Create Flow

```javascript
async function handleBulkCreate() {
  // Validate inputs
  if (selectedPlayers.length === 0) {
    toast.error('Select at least one player');
    return;
  }
  
  if (selectedCards.length === 0) {
    toast.error('Select at least one card');
    return;
  }
  
  // Show confirmation
  const count = selectedPlayers.length * selectedCards.length;
  const confirmed = await confirm(
    `Create ${count} restrictions?`,
    `This will restrict ${selectedCards.length} cards for ${selectedPlayers.length} players.`
  );
  
  if (!confirmed) return;
  
  // Generate restrictions array
  const restrictions = selectedPlayers.flatMap(player =>
    selectedCards.map(card => ({
      season_id: seasonId,
      player_id: player.player_id,
      card_id: card.card_id,
      reason: reasonText || null,
      created_by: currentUser.player_id,
    }))
  );
  
  setLoading(true);
  
  // Batch upsert
  const { data, error } = await supabase
    .from('season_card_restriction')
    .upsert(restrictions, {
      onConflict: 'season_id,player_id,card_id',
      ignoreDuplicates: false, // Update existing
    })
    .select();
  
  setLoading(false);
  
  if (error) {
    toast.error(`Error creating restrictions: ${error.message}`);
    return;
  }
  
  // Show success
  toast.success(`${data.length} restrictions created successfully`);
  
  // Reset form
  setSelectedPlayers([]);
  setSelectedCards([]);
  setReasonText('');
  
  // Navigate back to list
  navigate(`/admin/seasons/${seasonId}/restrictions`);
}
```

### Preview Component

```jsx
<BulkPreview>
  <PreviewHeader>
    <h3>Preview: {restrictionCount} restrictions</h3>
    <CountBadge>
      <span>{newCount} new</span>
      {duplicateCount > 0 && (
        <span className="text-yellow-500">{duplicateCount} duplicates</span>
      )}
    </CountBadge>
  </PreviewHeader>
  
  <PreviewMatrix>
    <table>
      <thead>
        <tr>
          <th>Player</th>
          {selectedCards.map(card => (
            <th key={card.card_id}>
              <img src={card.icon} className="w-8 h-8" />
              <span>{card.name}</span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {selectedPlayers.map(player => (
          <tr key={player.player_id}>
            <td>{player.name}</td>
            {selectedCards.map(card => (
              <td key={`${player.player_id}-${card.card_id}`}>
                {isDuplicate(player.player_id, card.card_id) ? (
                  <WarningIcon title="Already restricted" />
                ) : (
                  <CheckIcon title="Will be created" />
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </PreviewMatrix>
  
  <PreviewActions>
    <button onClick={onCancel} className="btn-secondary">
      Cancel
    </button>
    <button onClick={onApply} className="btn-primary">
      Apply {newCount} Restrictions
    </button>
  </PreviewActions>
</BulkPreview>
```

### Duplicate Detection

```javascript
const [existingRestrictions, setExistingRestrictions] = useState([]);

useEffect(() => {
  async function checkExisting() {
    if (selectedPlayers.length === 0 || selectedCards.length === 0) {
      return;
    }
    
    const playerIds = selectedPlayers.map(p => p.player_id);
    const cardIds = selectedCards.map(c => c.card_id);
    
    const { data } = await supabase
      .from('season_card_restriction')
      .select('player_id, card_id')
      .eq('season_id', seasonId)
      .in('player_id', playerIds)
      .in('card_id', cardIds);
    
    setExistingRestrictions(data || []);
  }
  
  checkExisting();
}, [selectedPlayers, selectedCards, seasonId]);

function isDuplicate(playerId, cardId) {
  return existingRestrictions.some(
    r => r.player_id === playerId && r.card_id === cardId
  );
}

const duplicateCount = useMemo(() => {
  return selectedPlayers.reduce((count, player) => {
    return count + selectedCards.filter(card => 
      isDuplicate(player.player_id, card.card_id)
    ).length;
  }, 0);
}, [selectedPlayers, selectedCards, existingRestrictions]);

const newCount = (selectedPlayers.length * selectedCards.length) - duplicateCount;
```

### Bulk Delete Flow

```javascript
async function handleBulkDelete(restrictionIds) {
  const confirmed = await confirm(
    `Delete ${restrictionIds.length} restrictions?`,
    'This action cannot be undone.'
  );
  
  if (!confirmed) return;
  
  setLoading(true);
  
  // Store for undo
  const deletedData = restrictions.filter(r => 
    restrictionIds.includes(r.restriction_id)
  );
  
  const { error } = await supabase
    .from('season_card_restriction')
    .delete()
    .in('restriction_id', restrictionIds);
  
  setLoading(false);
  
  if (error) {
    toast.error('Error deleting restrictions');
    return;
  }
  
  // Show success with undo
  toast.success(`${restrictionIds.length} restrictions deleted`, {
    action: {
      label: 'Undo',
      onClick: () => handleUndoDelete(deletedData),
    },
    duration: 10000, // 10 seconds to undo
  });
  
  // Refresh list
  fetchRestrictions();
}

async function handleUndoDelete(deletedData) {
  const { error } = await supabase
    .from('season_card_restriction')
    .insert(deletedData);
  
  if (error) {
    toast.error('Failed to undo delete');
    return;
  }
  
  toast.success('Restrictions restored');
  fetchRestrictions();
}
```

### Error Handling with Partial Success

```javascript
async function handleBulkCreateWithRetry() {
  const restrictions = generateRestrictions();
  const results = [];
  const errors = [];
  
  // Batch size: 50 restrictions per request
  const batchSize = 50;
  
  for (let i = 0; i < restrictions.length; i += batchSize) {
    const batch = restrictions.slice(i, i + batchSize);
    
    const { data, error } = await supabase
      .from('season_card_restriction')
      .upsert(batch, { onConflict: 'season_id,player_id,card_id' })
      .select();
    
    if (error) {
      errors.push({ batch, error: error.message });
    } else {
      results.push(...data);
    }
  }
  
  // Report results
  if (errors.length > 0) {
    toast.warning(`${results.length} succeeded, ${errors.length} batches failed`);
    setFailedBatches(errors);
    setShowRetryDialog(true);
  } else {
    toast.success(`All ${results.length} restrictions created successfully`);
    navigate(`/admin/seasons/${seasonId}/restrictions`);
  }
}
```

## UI Design

### Bulk Editor Page Layout

```
┌──────────────────────────────────────────────────┐
│  Create Bulk Restrictions                        │
├──────────────────────────────────────────────────┤
│                                                   │
│  Step 1: Select Players (3 selected)             │
│  ┌────────────────────────────────────────────┐  │
│  │ [Player Search & Chips Component]           │  │
│  └────────────────────────────────────────────┘  │
│                                                   │
│  Step 2: Select Cards (5 selected)               │
│  ┌────────────────────────────────────────────┐  │
│  │ [Card Grid Component]                       │  │
│  └────────────────────────────────────────────┘  │
│                                                   │
│  Step 3: Add Reason (Optional)                   │
│  ┌────────────────────────────────────────────┐  │
│  │ Tournament Rule ▾                           │  │
│  └────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────┐  │
│  │ [Text area for custom reason]              │  │
│  └────────────────────────────────────────────┘  │
│                                                   │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                   │
│  Preview: 15 restrictions (12 new, 3 duplicate)  │
│  [Matrix Preview Table]                          │
│                                                   │
│  [Cancel]                       [Apply (12)]     │
│                                                   │
└──────────────────────────────────────────────────┘
```

### Reason Suggestions Dropdown

```jsx
<select
  value={reasonTemplate}
  onChange={(e) => setReasonText(e.target.value)}
  className="w-full px-4 py-2 bg-gray-800 rounded"
>
  <option value="">Select reason template...</option>
  <option value="Tournament Rule - Extreme Mode">Tournament Rule - Extreme Mode</option>
  <option value="Fair Play Enforcement">Fair Play Enforcement</option>
  <option value="Meta Balance Adjustment">Meta Balance Adjustment</option>
  <option value="Competitive Integrity">Competitive Integrity</option>
  <option value="Player Conduct Violation">Player Conduct Violation</option>
</select>

<textarea
  value={reasonText}
  onChange={(e) => setReasonText(e.target.value)}
  placeholder="Enter custom reason (optional, 500 char max)"
  maxLength={500}
  className="w-full px-4 py-2 bg-gray-800 rounded mt-2"
  rows={3}
/>

<div className="text-right text-sm text-gray-400 mt-1">
  {reasonText.length} / 500
</div>
```

### Failed Restrictions Dialog

```jsx
<Modal open={showRetryDialog} onClose={() => setShowRetryDialog(false)}>
  <ModalHeader>
    <span className="material-symbols-outlined text-red-500 text-3xl">
      error
    </span>
    <h2>Some Restrictions Failed</h2>
  </ModalHeader>
  
  <ModalContent>
    <p>{successCount} restrictions created successfully</p>
    <p className="text-red-400">{failedBatches.length} batches failed</p>
    
    <div className="mt-4 max-h-64 overflow-auto">
      {failedBatches.map((batch, idx) => (
        <div key={idx} className="bg-gray-800 p-3 rounded mb-2">
          <div className="font-semibold">Batch {idx + 1}</div>
          <div className="text-sm text-red-400">{batch.error}</div>
          <div className="text-xs text-gray-400 mt-1">
            {batch.batch.length} restrictions affected
          </div>
        </div>
      ))}
    </div>
  </ModalContent>
  
  <ModalActions>
    <button onClick={ignoreErrors} className="btn-secondary">
      Ignore Errors
    </button>
    <button onClick={retryFailed} className="btn-primary">
      Retry Failed Batches
    </button>
  </ModalActions>
</Modal>
```

## Performance Optimization

### Batching Strategy

```javascript
// Process in batches of 50 to avoid payload size limits
const BATCH_SIZE = 50;

async function batchUpsert(restrictions) {
  const batches = [];
  
  for (let i = 0; i < restrictions.length; i += BATCH_SIZE) {
    batches.push(restrictions.slice(i, i + BATCH_SIZE));
  }
  
  // Process batches in parallel (max 3 concurrent)
  const results = await Promise.all(
    batches.map((batch, idx) => 
      retryWithBackoff(() => 
        supabase
          .from('season_card_restriction')
          .upsert(batch, { onConflict: 'season_id,player_id,card_id' })
          .select()
      , { maxRetries: 3, delay: 1000 * (idx % 3) })
    )
  );
  
  return results;
}
```

### Progress Indicator

```jsx
{loading && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-gray-800 rounded-lg p-6 w-96">
      <h3 className="text-xl font-semibold mb-4">Creating Restrictions...</h3>
      
      <ProgressBar value={progress} max={100} />
      
      <p className="text-sm text-gray-400 mt-2">
        {processedCount} / {totalCount} restrictions created
      </p>
      
      <p className="text-xs text-gray-500 mt-1">
        This may take a few moments...
      </p>
    </div>
  </div>
)}
```

## Error Handling

| Error | User Message | Recovery |
|-------|--------------|----------|
| No players selected | "Select at least one player" | Highlight player selector |
| No cards selected | "Select at least one card" | Highlight card selector |
| Validation failed | "Invalid restriction data" | Show specific field errors |
| Network timeout | "Operation timed out" | Retry button |
| Permission denied | "You don't have permission" | Redirect to dashboard |
| Database constraint | "Duplicate restriction" | Handle via upsert |
| Batch size exceeded | "Too many restrictions at once" | Suggest breaking into smaller batches |

## BDD Scenarios

### Scenario: Create Bulk Restrictions Successfully

```gherkin
Given I am on the bulk editor page
And I select 3 players: "John", "Jane", "Bob"
And I select 5 cards: "Archer Queen", "Dark Prince", "Fireball", "Goblin Barrel", "Ice Spirit"
And I enter reason "Tournament Rule - Extreme Mode"
When I click "Apply Restrictions"
Then I see a confirmation dialog "Create 15 restrictions?"
When I confirm
Then 15 restrictions are created
And I see "15 restrictions created successfully"
And I am redirected to the restrictions list
And all 15 restrictions are visible
```

### Scenario: Handle Duplicate Restrictions

```gherkin
Given I am on the bulk editor page
And "John" already has "Archer Queen" restricted
And I select players: "John", "Jane"
And I select cards: "Archer Queen", "Dark Prince"
When I view the preview
Then I see "4 restrictions (3 new, 1 duplicate)"
And John's Archer Queen cell shows a warning icon
When I apply
Then 3 new restrictions are created
And 1 duplicate is skipped
And I see "3 created, 1 already existed"
```

### Scenario: Bulk Delete with Filter

```gherkin
Given I am viewing the restrictions list
And there are 50 restrictions total
When I filter by rarity "Champion"
Then I see 12 champion card restrictions
When I click "Select All"
And I click "Delete Selected"
Then I see a confirmation "Delete 12 restrictions?"
When I confirm
Then 12 restrictions are deleted
And I see "12 restrictions deleted"
And an "Undo" button is available for 10 seconds
```

### Scenario: Undo Bulk Delete

```gherkin
Given I just deleted 12 restrictions
And the undo option is still available
When I click "Undo"
Then all 12 restrictions are restored
And I see "Restrictions restored"
And the restrictions appear in the list
```

### Scenario: Partial Success Handling

```gherkin
Given I am creating 100 restrictions
And the network fails after 60 are created
When the operation completes
Then I see "60 succeeded, 40 failed"
And a dialog shows the failed batches
When I click "Retry Failed Batches"
Then the system attempts to create the remaining 40
And successful ones are added to the list
```

## Testing Checklist

### Unit Tests
- [ ] Generate N×M restrictions array
- [ ] Detect duplicates correctly
- [ ] Batch restrictions into chunks
- [ ] Handle partial success results
- [ ] Calculate preview counts

### Integration Tests
- [ ] Bulk upsert to Supabase
- [ ] Handle database constraint errors
- [ ] Retry failed batches
- [ ] Undo bulk delete
- [ ] Real-time update after bulk create

### E2E Tests
- [ ] Create bulk restrictions (happy path)
- [ ] Handle duplicate restrictions
- [ ] Preview before apply
- [ ] Cancel bulk operation
- [ ] Add reason to restrictions
- [ ] Bulk delete with filter
- [ ] Undo bulk delete
- [ ] Partial success scenario

## Dependencies

- `season_card_restriction` table with UNIQUE constraint
- Supabase upsert with onConflict handling
- Toast notification system
- Confirmation dialog component
- Progress indicator component

## Future Enhancements

- Import restrictions from CSV file
- Export restrictions as CSV/JSON
- Schedule bulk operations (e.g., apply restrictions on specific date)
- Templated restriction sets (e.g., "Ban all champions")
- Bulk edit reason for existing restrictions
- Dry-run mode (preview without committing)
- Audit log for bulk operations (track who created/deleted what)
- Webhook notifications for bulk changes
- Roll back entire bulk operation if any fails (transaction mode)
