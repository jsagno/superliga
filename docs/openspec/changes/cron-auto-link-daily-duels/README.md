# Auto-Link Daily Duels in CRON Process

## Overview

This change automates the creation and linking of daily duel matches directly in the CRON sync process. Instead of manually running "Auto-vincular" in the admin website, the CRON service will:

1. **Detect** daily duel battles with `api_game_mode=CW_Duel_1v1` and `api_battle_type` in `[riverRaceDuel, riverRaceDuelColosseum]`
2. **Create** `scheduled_match` records automatically if they don't exist
3. **Link** battles to scheduled matches via `scheduled_match_battle_link`
4. **Calculate** daily duel results and populate `scheduled_match_result`

## Benefits

- ✅ Eliminates manual admin workflow for daily duels
- ✅ Daily duel results available immediately after sync
- ✅ Reduces system complexity and dependencies
- ✅ More autonomous, event-driven architecture

## Current Workflow (Manual)

```
CRON Sync → Battle Ingested → Manual Admin Action Required
                                   ↓
                           "Auto-vincular" Button Click
                                   ↓
                           league-admin finds/links battles
```

## Desired Workflow (Automated)

```
CRON Sync → Battle Ingested → Auto-Detect Daily Duel → Create/Link Match → Result Calculated
```

## Technical Details

### Detection Logic

When CRON processes battles, check:
```python
if battle['api_game_mode'] == 'CW_Duel_1v1' and \
   battle['api_battle_type'] in ['riverRaceDuel', 'riverRaceDuelColosseum']:
    # Handle daily duel
```

### Match Creation

If `scheduled_match` doesn't exist for the player/date, create:
- `type` = 'CW_DAILY'
- `stage` = 'CW_Duel_1v1'
- `best_of` = 1
- `status` = 'PENDING' (will become 'OVERRIDDEN' after result set)
- Date range: battle's game day (using cutoff logic: 09:50 UTC boundary)

### Result Calculation

Use same logic as SeasonsList.jsx `calculateBattleResult()`:
- Points Schema: 2-0=4, 2-1=3, 1-2=1, 0-2=0
- `decided_by` = 'SYSTEM' (not 'ADMIN')
- No extreme/risky bonuses (unless season configured)

## Files to Modify

- `packages/cron/cron_clash_sync.py` - Main sync logic
- Possibly: `packages/cron/battle_utils.py` - Helper functions

## Related Documentation

- [CW_DAILY Daily Points Rules](../../docs/REGALAMENTO.md#CW_DAILY)
- [Battle Sync Architecture](../../docs/openspec/architecture/cron-technical-spec.md)
- [SeasonsList.jsx Auto-vincular Implementation](../../packages/liga-admin/src/pages/admin/SeasonsList.jsx)
