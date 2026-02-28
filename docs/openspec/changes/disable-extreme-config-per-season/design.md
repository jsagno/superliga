# Design: Disable Extreme Configuration Per Season

## Context

The Extreme Configuration feature validates player decks against extreme/risky composition rules. Currently, this validation is hardcoded and always active. For the current season (Season 2026), there are no extreme/risky participants, so validation is unnecessary and creates confusion in battle history with mismatched data.

**Current State:**
- `BattlesHistory.jsx` calls `isExtreme()` on all battles unconditionally
- `isExtreme()` checks deck composition against hardcoded rules
- Supabase `season_extreme_config` table exists but isn't used to toggle validation
- Admin can only adjust extreme rules, not disable them per-season

## Goals / Non-Goals

**Goals:**
- Allow admins to toggle extreme configuration validation on/off per-season
- Conditionally apply extreme deck checks in battle-history based on season flag
- Maintain backward compatibility (defaults to enabled for existing seasons)
- Add minimal database/API overhead

**Non-Goals:**
- Modify extreme validation rules themselves
- Create complex per-player/per-deck overrides
- Add UI for managing extreme config rules (stays in Extreme Configuration page)
- Change how battle history displays battles (only extreme annotations affected)

## Decisions

### Decision 1: Database Column Location
**Choice:** Add `is_extreme_config_disabled` column to `seasons` table

**Rationale:**
- Simplest approach: one boolean flag per season
- Avoids creating new tables
- Follows precedent of season-scoped settings
- Easy to query at load time

**Alternatives Considered:**
- Store in `season_extreme_config`: Adds complexity (would need nullable field)
- Environment variable: Not season-specific, not admin-editable
- Feature flag service: Overkill for simple boolean toggle

### Decision 2: UI Implementation
**Choice:** Add checkbox in Extreme Configuration page admin section

**Rationale:**
- Colocates all extreme-related settings in one place
- Admins expect to toggle configuration here
- Minimal UI change (single checkbox)

**Alternatives Considered:**
- Separate "Season Settings" page: Fragmented admin experience
- Inline toggle in season selector: Not discoverable

### Decision 3: Client-Side Check
**Choice:** Read config at component mount, conditionally render isExtreme() results

**Rationale:**
- Keeps validation logic in React component (where it's used)
- Single source of truth: `BattlesHistory.jsx`
- No changes needed to `isExtreme()` function itself
- Responsive: Can update without page reload (if using subscription)

**Alternatives Considered:**
- Compute on server-side: Requires API changes, adds latency
- Store in React context: Adds state management complexity

## Risks / Trade-offs

**[Risk] Admin forgets to disable for multi-season tournaments**
→ *Mitigation:* Add explanatory tooltip on checkbox; document in admin guide

**[Risk] Checkbox inadvertently disabled, breaking assumptions**
→ *Mitigation:* Add visual indicator/badge showing extreme config status; log admin changes

**[Risk] RLS permissions not updated properly**
→ *Mitigation:* Only admin role (service_role) can update `is_extreme_config_disabled`; verify policy in `20260124220001_production_schema.sql`

**[Trade-off] Column added to seasons table
→ *Impact:* Small schema change, negligible performance impact; migration required

## Migration Plan

1. **Create Migration**: Add `is_extreme_config_disabled` column to `seasons` table (default: false)
2. **Update `BattlesHistory.jsx`**: 
   - Query current season's `is_extreme_config_disabled` flag
   - Conditionally apply `isExtreme()` checks
3. **Update Extreme Configuration page**: Add checkbox (only visible to admins)
4. **Test**: Verify battles show/hide extreme annotations when toggled
5. **Rollback**: Drop column if needed (backward compatible)

## Open Questions

1. Should we add a subscription to `seasons` table so toggling updates battle history in real-time? (Optional enhancement)
2. Should past seasons default to `is_extreme_config_disabled = false` or `true`?
3. Do we want a UI indicator showing which seasons have extreme config disabled?
