# Product: CRON (Battle Synchronization Service)

**Product Type**: Background Service / Data Pipeline  
**Status**: ✅ Active Production  
**Version**: 1.0  
**Repository**: `packages/cron/`

---

## Purpose

CRON is an automated background service that synchronizes Clash Royale battle data from the Supercell API into Supabase (PostgreSQL). It serves as the **data ingestion layer** for Liga Interna, ensuring the admin dashboard always has fresh, accurate player statistics, battle history, and clan information.

### Why CRON Exists

Liga Interna manages an internal Clash Royale tournament with **53 players** organized into **6 teams** competing across multiple zones. The tournament requires:
- Real-time tracking of player battles
- Historical data for rankings and statistics
- Automated data collection without manual intervention
- Validation of deck completeness for tournament rules

Without CRON, administrators would need to manually fetch and input battle data—an impossible task given the volume (~50-100 battles per sync, 1500+ accumulated battles).

---

## Capabilities

### Core Functions
1. **Automatic Data Synchronization**
   - Fetches clan member list every 30 minutes
   - Retrieves battle logs for all active players (25 most recent battles per player)
   - Upserts battle data to Supabase (no duplicate battles created)
   - Discovers and registers new cards automatically

2. **Intelligent Caching**
   - File-based cache with configurable TTL (30-60 minutes)
   - Reduces redundant API calls by serving cached data
   - Per-player cache files (e.g., `cache/battlelog_2QYGCPUUJ.json`)
   - Respects Supercell API rate limits (prevents 429 errors)

3. **Data Validation & Repair**
   - Detects incomplete decks (< 8 cards) due to API timing issues
   - Marks battles as `needs_refresh=true` for retry
   - Repair queue attempts up to 5 retries with exponential backoff
   - Ensures data quality for tournament validation

4. **Robust Error Handling**
   - Graceful degradation: skips failing players without blocking sync
   - Comprehensive logging to file and stdout
   - HTTP 404 handling for players who leave clan
   - Connection retry logic for database failures

5. **Deterministic Battle Identification**
   - Generates stable battle IDs using MD5(battleTime + type + mode + player_tags)
   - Prevents duplicate battles across multiple syncs
   - Enables idempotent operations (safe to re-run)

---

## Technology Stack

### Language & Runtime
- **Python 3.10+** - Modern Python with type hints support
- **Single-file architecture** - `cron_clash_sync.py` (986 lines)

### Dependencies
```python
requests>=2.31.0        # HTTP client for Supercell API
supabase-py>=2.0.0      # Supabase Python SDK
python-dotenv>=1.0.0    # Environment variable management
```

### External Services
- **Supercell Clash Royale API** - `https://api.clashroyale.com/v1`
  - Authentication: Bearer token (API key)
  - Rate limit: 120 requests/minute
  
- **Supabase (PostgreSQL)** - Database and BaaS
  - Authentication: Service role key (bypasses RLS)
  - Direct SDK access (no PostgREST layer needed)

### Infrastructure
- **Deployment**: Standalone Python script wrapped in Windows executable
- **Execution**: Infinite loop with `time.sleep(1800)` (30-minute intervals)
- **Logging**: File-based (`logs/clash_sync.log`) with rotation
- **Cache Storage**: Local filesystem (`cache/` directory)

---

## Key Features

### 1. Battle Data Synchronization
**Feature**: [battle-sync.md](../features/cron/battle-sync.md)

Fetches and stores complete battle records including:
- Battle metadata (time, type, mode, arena)
- Player participation (tag, deck, crowns, elixir leaked)
- Round-by-round breakdown (princess tower HP, king tower HP)
- Winner determination and trophy changes

**Data Model**:
```
battle (parent record with battle_id, battle_time, type, mode)
  └─ battle_round (each round in best-of-3)
      └─ battle_round_player (per-player stats: deck, crowns, damage)
```

### 2. Card Discovery & Registration
Automatically detects new cards from battle decks and registers them in the `card` table:
- Card ID (unique identifier from API)
- Card name, level, star level
- Icon URL for UI rendering
- Batch upserts to avoid N+1 queries

### 3. Player Identity Management
Links player tags to internal database records:
- Resolves player by Clash tag (`#2QYGCPUUJ`)
- Creates mapping in `player_identity` table
- Enables cross-referencing with tournament roster

### 4. Incomplete Battle Repair
Handles API race conditions where battles return with partial deck data:
- Marks battle with `needs_refresh=true`
- Retries on subsequent sync cycles
- Tracks `refresh_attempts` counter
- Max 5 attempts before abandoning

### 5. Historical Data Preservation
Maintains complete battle history without overwriting:
- Only inserts new battles (SKIP if `battle_id` exists)
- Preserves original battle data for audit trail
- Enables time-series analysis for rankings

---

## Architecture

### High-Level Data Flow

```
┌─────────────────────────────────────┐
│   Supercell API (Clash Royale)     │
│   /clans/{tag}/members              │
│   /players/{tag}/battlelog          │
└─────────────────────────────────────┘
              ↓ HTTP GET (Bearer token)
┌─────────────────────────────────────┐
│     cron_clash_sync.py (Python)     │
│  ┌────────────────────────────────┐ │
│  │ 1. Fetch clan members          │ │
│  │ 2. For each player:            │ │
│  │    - Check cache (TTL 30-60m)  │ │
│  │    - Fetch battlelog if stale  │ │
│  │ 3. Parse & validate battles    │ │
│  │ 4. Generate deterministic IDs  │ │
│  │ 5. Upsert to Supabase          │ │
│  │ 6. Repair incomplete battles   │ │
│  │ 7. Sleep 30 minutes            │ │
│  └────────────────────────────────┘ │
└─────────────────────────────────────┘
              ↓ Supabase SDK (Service role)
┌─────────────────────────────────────┐
│      Supabase (PostgreSQL)          │
│  - battle (1500+ records)           │
│  - battle_round                     │
│  - battle_round_player              │
│  - card (auto-discovered)           │
│  - player_identity (tag mapping)    │
└─────────────────────────────────────┘
```

### Technical Architecture
**Reference**: [architecture/cron-technical-spec.md](../architecture/cron-technical-spec.md)

Key implementation details:
- **`@dataclass Config`** - Type-safe configuration from environment variables
- **`SupercellApi` class** - Encapsulates all API calls with error handling
- **Cache functions** - `load_cache()`, `save_cache()` with TTL expiration
- **Battle ID generation** - `stable_battle_id()` using MD5 hashing
- **Deck validation** - `is_incomplete_deck()` checks card count
- **Batch operations** - Card flushing, member fetching optimized for performance

---

## Dependencies

### Upstream Dependencies (What CRON Relies On)
1. **Supercell Clash Royale API**
   - Availability: 99.9% uptime (Supercell SLA)
   - Rate limits: 120 requests/minute
   - Authentication: API key from Supercell Developer Portal

2. **Supabase Instance**
   - Database schema must exist (see [architecture/data-model.md](../architecture/data-model.md))
   - Service role key with full database access
   - Network connectivity to Supabase cloud

3. **Environment Configuration**
   - `SUPERCELL_API_KEY` - Clash Royale API bearer token
   - `CLAN_TAG` - Primary clan identifier (e.g., `#2YU9JJCJJ`)
   - `SUPABASE_URL` - Supabase project URL
   - `SUPABASE_SERVICE_KEY` - Backend admin key (bypasses RLS)

### Downstream Consumers (What Relies On CRON)
1. **LIGA-ADMIN Dashboard**
   - Depends on fresh battle data for rankings
   - Displays player statistics from synced data
   - Shows last sync timestamp for data currency

2. **Tournament Administration**
   - Battle validation for deck rules
   - Points calculation for daily/season rankings
   - Historical analysis for player performance

---

## System Context

### Execution Environment
- **OS**: Windows (primary), Linux (compatible)
- **Scheduling**: Internal loop (no OS cron required)
- **Permissions**: Read/write to `cache/` and `logs/` directories
- **Network**: Outbound HTTPS to Supercell and Supabase

### Operational Characteristics
- **Frequency**: Every 30 minutes (1800 seconds sleep)
- **Duration**: ~2-5 minutes per sync cycle (depends on player count)
- **Resource Usage**: 
  - CPU: Minimal (I/O bound)
  - Memory: ~50-100 MB (in-memory caching of API responses)
  - Disk: Cache grows to ~10-50 MB for 50 players
  - Network: ~1-5 MB per sync (API responses)

### Monitoring & Observability
- **Logging**: File-based logs in `logs/clash_sync.log`
  - Log level: INFO (configurable to DEBUG)
  - Format: Timestamp, level, message
  - Rotation: Manual (no automatic rotation configured)
  
- **Key Metrics** (logged):
  - Sync start/end timestamps
  - Player count fetched
  - New battles discovered
  - Cache hit rate
  - API errors encountered
  - Incomplete battles detected

---

## Integration Points

### Supabase Tables Written By CRON
| Table | Purpose | Write Pattern |
|-------|---------|---------------|
| `battle` | Parent battle record | INSERT (skip if exists) |
| `battle_round` | Round-level data | INSERT (via FK) |
| `battle_round_player` | Player stats per round | INSERT (via FK) |
| `card` | Card catalog | UPSERT (deduplicated) |
| `player_identity` | Tag-to-player mapping | UPSERT (deduplicated) |

### Supabase Tables Read By CRON
| Table | Purpose | Read Pattern |
|-------|---------|---------------|
| `card` | Check existing cards | SELECT all on startup |
| `battle` | Check for duplicates | SELECT by `battle_id` (via upsert) |
| `player` | Resolve player identities | SELECT by tag |

---

## Configuration

### Environment Variables
```bash
# Supercell API
SUPERCELL_API_KEY=eyJ0eXAiOiJKV1QiLCJhbGc...   # Required
CLAN_TAG=#2YU9JJCJJ                            # Required

# Supabase
SUPABASE_URL=https://xxx.supabase.co           # Required
SUPABASE_SERVICE_KEY=eyJhbGc...                # Required (service_role)

# Caching (optional)
CACHE_TTL_MINUTES=60                           # Default: 60
CACHE_DIR=./cache                              # Default: ./cache

# Logging (optional)
LOG_LEVEL=INFO                                 # Default: INFO
LOG_FILE=logs/clash_sync.log                   # Default: logs/clash_sync.log
```

### File Structure
```
packages/cron/
├── cron_clash_sync.py       # Main script (986 lines)
├── requirements.txt         # Python dependencies
├── .env.example             # Configuration template
├── README.md                # Setup instructions
├── cache/                   # API response cache (gitignored)
│   └── battlelog_*.json
└── logs/                    # Sync logs (gitignored)
    └── clash_sync.log
```

---

## Related Documentation

### Feature Specifications
- [features/cron/battle-sync.md](../features/cron/battle-sync.md) - Battle synchronization requirements

### Architecture
- [architecture/cron-technical-spec.md](../architecture/cron-technical-spec.md) - Complete technical architecture (706 lines)
- [architecture/data-model.md](../architecture/data-model.md) - Database schema and entities
- [architecture/system-overview.md](../architecture/system-overview.md) - System-wide architecture

### Business Rules
- [business-rules/deck-validation.md](../business-rules/deck-validation.md) - Tournament deck rules (basis for incomplete deck detection)

### Setup & Operations
- [packages/cron/README.md](../../packages/cron/README.md) - Installation and execution guide
- [docs/REGALAMENTO.md](../../docs/REGALAMENTO.md) - Tournament rules (Spanish)

---

## Future Enhancements

### Planned Features
- [ ] Real-time sync via Supercell webhooks (when available)
- [ ] Multi-clan support (sync multiple clans in parallel)
- [ ] Prometheus metrics endpoint for monitoring
- [ ] Docker containerization for cross-platform deployment
- [ ] Automatic log rotation and retention policy
- [ ] Player trophy snapshot scheduler (daily archival)
- [ ] War status synchronization (currently manual)

### Technical Debt
- [ ] Refactor monolithic file into modules (`api/`, `cache/`, `parsers/`)
- [ ] Add type hints throughout (currently partial)
- [ ] Implement unit tests (currently no test suite)
- [ ] Add integration tests with mock Supercell API
- [ ] Migrate from `time.sleep()` to proper scheduler (APScheduler)
- [ ] Implement structured logging (JSON format for log aggregation)

---

## Success Metrics

**Reliability**: 99.5% sync success rate (measured over 30 days)  
**Data Currency**: 95% of battles synced within 60 minutes of occurrence  
**Performance**: <5 minutes per sync cycle for 50 players  
**Error Rate**: <1% API failures excluding Supercell downtime  
**Cache Efficiency**: >70% cache hit rate (reduces API load)

---

*Last Updated: February 18, 2026*  
*Maintained By: Backend Team*  
*Version: 1.0*
