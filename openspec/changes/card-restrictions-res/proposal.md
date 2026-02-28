# Proposal: Card Restrictions (RES) System

## Why

Currently, there's no way to prohibit specific players from using certain cards in competitions. This limitation prevents administrators from implementing:
- **Competitive Balance**: Restricting overpowered cards for top-tier players
- **Fair Play Enforcement**: Penalizing players who violate deck composition rules
- **Skill Development**: Forcing players to learn alternative strategies by banning their comfort cards
- **Meta Diversity**: Creating varied gameplay by restricting dominant cards from specific players

Without this feature, administrators cannot enforce card-level restrictions on individual players, limiting the competitive integrity and strategic depth of the league.

## What Changes

### Core Functionality
- **Per-Season Card Restrictions**: Admins can ban specific cards for specific players within a season
- **Restriction Management UI**: New "RES" (Restricciones) admin page with CRUD operations
- **Bulk Restriction Creation**: Ability to restrict multiple cards for multiple players simultaneously
- **Player-Specific View**: Each player sees their own restricted cards
- **Battle Validation**: System validates battles against player restrictions (future: flag violations)

### User Experience
- **Admin Dashboard**: New "RES" navigation tab in admin layout
- **Restriction List**: Card-style view showing all active restrictions per player
- **Card Selection Interface**: Visual card picker with rarity filters (Champion, Legendary, Epic, Rare, Common)
- **Player Search**: Searchable dropdown to select affected players
- **Bulk Actions**: Apply same restrictions to multiple players at once

### Data Model
- New `season_card_restriction` table linking players, cards, and seasons
- Stores: `player_id`, `card_id`, `season_id`, `reason` (optional), timestamps
- Indexes for efficient querying by player/season/card

## Capabilities

### New Capabilities

1. **`res-admin-management`**: CRUD interface for managing card restrictions per season
   - Create new restrictions (single or bulk)
   - View all active restrictions grouped by player
   - Edit existing restrictions
   - Delete restrictions
   
2. **`res-card-selector`**: Visual card selection interface with filtering
   - Display all cards in grid layout
   - Filter by rarity (Champion, Legendary, Epic, Rare, Common)
   - Multi-select cards for bulk restriction
   - Card images and names from `card.raw_payload`

3. **`res-player-selector`**: Player selection with zone context
   - Search players within current season
   - Display player avatars and zones
   - Multi-select for bulk operations
   - Shows participant status

4. **`res-bulk-operations`**: Apply restrictions to multiple players
   - Select N players
   - Select M cards
   - Apply all M restrictions to all N players
   - Progress feedback and error handling

5. **`res-battle-validation`** (Future): Validate battles against restrictions
   - Check player decks against their restrictions
   - Flag/reject battles using restricted cards
   - Alert admins of violations

### Modified Capabilities

- **`admin-navigation`**: Add "RES" tab to admin layout
- **`season-management`**: Link to RES configuration per season
- **`player-profile`**: Show player's active restrictions (future)

## Impact

### Database
- New table: `season_card_restriction`
- New indexes for query performance
- Migration required

### Frontend (liga-admin)
- New page: `SeasonRestrictions.jsx` (list view)
- New page: `SeasonRestrictionEdit.jsx` (bulk editor)
- Updated: `AdminLayout.jsx` (add RES navigation)
- New component: `CardGrid.jsx` (reusable card selector)
- New component: `PlayerMultiSelect.jsx` (player chips)

### Backend/Database
- Supabase queries for restrictions CRUD
- RLS policies: admin-only write, player read-own
- Join queries with `card`, `player`, `season_zone_team_player`

### APIs
- Read-only Supabase queries from client
- No external API changes

### User Experience
- **Admins**: New powerful tool for enforcing competitive balance
- **Players**: Clear visibility of their restrictions (future)
- **Observers**: Enhanced competitive integrity

### Performance
- Indexed queries ensure fast restriction lookups
- Card grid rendering optimized with virtualization (if needed)
- Bulk operations batched for efficiency

## Business Value

1. **Competitive Integrity**: Enforce fair play through card-level restrictions
2. **Admin Control**: Granular control over player advantages
3. **Strategic Depth**: Force meta diversity by restricting dominant cards
4. **Penalty System**: Implement card bans as penalties for rule violations
5. **Player Development**: Encourage skill growth by restricting crutch cards

## Success Metrics

- Number of restrictions created per season
- Admin time spent managing restrictions
- Player awareness of their restrictions
- Reduction in dominant card usage
- Increase in deck diversity within restricted player pool

## Open Questions

1. **Validation Timing**: Should we validate restrictions during battle entry or post-battle?
2. **Notification System**: How do players learn about their restrictions?
3. **Expiration**: Do restrictions auto-expire at season end or persist?
4. **Reason Field**: Should admins be required to provide a reason for restrictions?
5. **Appeal Process**: Can players request restriction removal?
6. **Historical View**: Should we archive old restrictions for reference?

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Players unaware of restrictions | Accidental violations | Notification system + player portal |
| Performance with many restrictions | Slow queries | Proper indexing, caching |
| Admin error (wrong player/card) | Unfair penalty | Audit log, undo capability |
| Bulk restriction mistakes | Widespread impact | Confirmation dialog, preview step |

## Dependencies

- Existing `card` table with `raw_payload` (rarity data)
- `season_zone_team_player` for participant lookup
- Admin authentication system
- Supabase RLS policies

## Timeline Estimate

- **Database Design & Migration**: 1 day
- **Backend Queries & RLS**: 1 day
- **Frontend UI (List + Edit)**: 3 days
- **Card Selector Component**: 2 days
- **Player Selection Component**: 1 day
- **Testing & Refinement**: 2 days
- **Documentation**: 1 day

**Total**: ~11 days (single developer)

## Future Enhancements

1. **Player Portal**: Players view their own restrictions
2. **Battle Validation**: Auto-reject battles using restricted cards
3. **Restriction Templates**: Pre-defined restriction sets (e.g., "Meta Ban Package")
4. **Duration**: Time-limited restrictions (e.g., 2-week ban)
5. **Restriction Reasons**: Categorize by type (penalty, balance, development)
6. **Analytics**: Track restriction effectiveness and compliance
7. **API Integration**: External tools can query/create restrictions
8. **Mobile App**: Manage restrictions from mobile admin app
