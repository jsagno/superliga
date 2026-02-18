# Data Models Specification

## Overview
This specification defines the core data models shared between the Liga Interna admin dashboard and the Clash API sync cron job. These models are the foundation for all inter-project communication and database operations.

## Vision
Create a single source of truth for Liga Interna's core entities (Players, Clans, Battles) that enables:
- Consistent data structure across frontend and backend
- Predictable API contracts for agents to work with
- Seamless sync between Supercell Clash API and Supabase

## Requirements

### REQ-1: Player Entity
- The system SHALL maintain standardized Player records with Supercell identifiers
- The system SHALL track player stats (trophies, battle count, position)
- The system SHALL record historical snapshots for ranking calculations
- The system SHALL link players to their clan membership

### REQ-2: Clan Entity
- The system SHALL maintain Clan records identified by unique clan tags
- The system SHALL track clan statistics (members, trophies, war status)
- The system SHALL record clan metadata (name, description, location)

### REQ-3: Battle/War Entity
- The system SHALL record individual player battles with outcomes
- The system SHALL track war participation and results per clan
- The system SHALL capture battle timestamps and participant references

### REQ-4: Data Freshness
- The system SHALL allow tracking of last sync times per entity
- The system SHALL support incremental updates from the Clash API

## Scenarios

### Scenario: Player Profile Fetch
- **GIVEN** a player with tag `#12345678` exists in Supabase
- **WHEN** the admin dashboard requests player details
- **THEN** return complete player object with current stats and clan reference
- **AND** include last sync timestamp

### Scenario: Clan Data Synchronization
- **GIVEN** the cron job fetches clan data from Clash API
- **WHEN** clan members or stats have changed
- **THEN** update Supabase clan record
- **AND** create snapshot entry for historical tracking
- **AND** trigger notifications if membership changes exceeded threshold

### Scenario: Battle Record Creation
- **GIVEN** the cron job receives new battle data from Clash API
- **WHEN** battle completed for player in tracked clan
- **THEN** create new battle record with outcome
- **AND** update player battle count and trophy delta
- **AND** link to war record if applicable

## Data Models

### Player
```typescript
interface Player {
  id: string;              // UUID
  tag: string;             // Supercell player tag (unique)
  name: string;            // Player display name
  exp_level: number;       // Experience level
  trophies: number;        // Current trophy count
  best_trophies: number;   // Best trophy count ever
  highest_role: string;    // Highest role in any clan
  clan_id?: string;        // FK to Clan (if member)
  last_sync: datetime;     // Last API sync timestamp
  created_at: datetime;
  updated_at: datetime;
}
```

### Clan
```typescript
interface Clan {
  id: string;              // UUID
  tag: string;             // Supercell clan tag (unique)
  name: string;            // Clan display name
  description: string;     // Clan description
  trophies: number;        // Clan trophies
  member_count: number;    // Number of members
  badge_url: string;       // Badge image URL
  type: string;            // "inviteOnly" | "open" | "closed"
  location?: string;       // Clan location
  war_wins: number;        // Total war wins
  war_losses: number;      // Total war losses
  last_sync: datetime;     // Last API sync timestamp
  created_at: datetime;
  updated_at: datetime;
}
```

### Battle
```typescript
interface Battle {
  id: string;              // UUID
  player_id: string;       // FK to Player
  opponent_tag: string;    // Opponent player tag
  result: string;          // "win" | "loss" | "draw"
  battle_time: datetime;   // When battle occurred
  trophies_change: number; // +/- trophy change
  crowns?: number;         // War battle: crowns earned
  war_id?: string;         // FK to War (if applicable)
  battle_type: string;     // "ladder" | "war" | "tournament"
  created_at: datetime;
}
```

### PlayerSnapshot
```typescript
interface PlayerSnapshot {
  id: string;              // UUID
  player_id: string;       // FK to Player
  trophies: number;        // Snapshot of trophies at time
  battles: number;         // Snapshot of battle count
  position_in_clan?: number; // Rank within clan
  snapshot_date: datetime;
  created_at: datetime;
}
```

### War
```typescript
interface War {
  id: string;              // UUID
  clan_id: string;         // FK to Clan
  opponent_tag: string;    // Opponent clan tag
  state: string;           // "collectionDay" | "warDay" | "ended"
  season: number;          // War season identifier
  clan_crowns: number;     // Crowns earned by clan
  opponent_crowns: number; // Opponent crowns
  ended_at?: datetime;     // When war ended
  created_at: datetime;
  updated_at: datetime;
}
```

## Validation Rules

- **Player Tag Format**: Must match Supercell format (alphanumeric, starts with #)
- **Clan Tag Format**: Must match Supercell format (alphanumeric, starts with #)
- **Trophy Values**: Non-negative integers
- **Timestamps**: ISO 8601 format with timezone
- **Enum Values**: Strictly defined options only (no free text for status fields)

## Integration Points

### Cron Job → Supabase
- Fetches data from Clash API
- Writes to Player, Battle, War, Clan tables
- Updates `last_sync` timestamp
- Creates historical snapshots

### Admin Dashboard → Supabase
- Reads from all tables
- Displays filtered/sorted views
- Generates rankings from PlayerSnapshot
- No direct write operations (except admin settings)

## Schema Management

### Centralized Supabase CLI
**Location**: `./supabase/` (top-level, shared by both projects)

The database schema is managed through Supabase CLI migrations, centralized at the project root to serve both:
- **liga-admin**: React SPA consuming player, battle, and team data
- **cron**: Python Clash Royale sync job performing bulk data ingestion

**Key files**:
- `./supabase/config.toml` - Supabase local SDK configuration
- `./supabase/migrations/` - Versioned SQL migrations (applied in order)
- `./supabase/seed.sql` - Initial data for local development

**Workflow**:
```bash
# Start local development environment
supabase start

# Apply all migrations locally
supabase db reset

# Create new migration
supabase migration new <description>

# Push migrations to production (requires permission)
supabase db push
```

For detailed migration procedures, see [Git Workflow - Database Migrations](./git-workflow.md#database-migrations).

## Related Specs
- [Clash Sync Cron](./clash-sync-cron.md) - Implementation details for data ingestion
- [Admin Dashboard](./admin-dashboard.md) - How frontend consumes these models
- [Git Workflow](./git-workflow.md) - Branch strategy and code review process
