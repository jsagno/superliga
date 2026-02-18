# Cron Clash Sync - Technical Architecture

## 1. Executive Summary

**Purpose**: Automatic synchronization of Clash Royale battles from Supercell API to Supabase  
**Type**: Cron job / Background worker  
**Status**: Active production  
**Frequency**: Every 30 minutes (configurable)  
**Scale**: ~50-100 battles per synchronization, 1500+ accumulated battles

### Core Technologies
- **Language**: Python 3.10+
- **Database**: Supabase (PostgreSQL) via SDK
- **APIs**: Clash Royale API (Supercell)
- **Dependencies**: `requests`, `supabase-py`, `python-dotenv`
- **Deployment**: Standalone executable (no framework)

---

## 2. High-Level Architecture

```
┌────────────────────────────────────────────────────────┐
│           Supercell API (Clash Royale)                 │
│  https://api.clashroyale.com/v1                        │
│  - /clans/{tag}/members                                │
│  - /players/{tag}/battlelog                            │
└────────────────────────────────────────────────────────┘
                          ↓ HTTPS (Bearer token)
┌────────────────────────────────────────────────────────┐
│         cron_clash_sync.py (Python 3.10)               │
├────────────────────────────────────────────────────────┤
│  1. Fetch clan members (tags list)                    │
│  2. For each player:                                   │
│     - Fetch battlelog (25 last battles)               │
│     - Parse JSON                                       │
│     - Validate deck completeness                      │
│     - Generate deterministic battle_id                │
│     - Transform to DB rows                            │
│  3. Upsert to Supabase                                 │
│  4. Repair incomplete battles (retry queue)           │
│  5. Cache API responses (TTL: 30-60 min)              │
│  6. Log to file + stdout                              │
└────────────────────────────────────────────────────────┘
                          ↓ HTTPS (Service Role Key)
┌────────────────────────────────────────────────────────┐
│              Supabase (PostgreSQL)                     │
│  - battle (1514 rows)                                  │
│  - battle_round                                        │
│  - battle_round_player                                 │
│  - card (auto-inserted)                                │
│  - player_identity (tag mapping)                       │
└────────────────────────────────────────────────────────┘
```

### Data Flow
1. **Timer**: Every 30 minutes (infinite loop with `time.sleep(1800)`)
2. **Fetch Members**: `GET /clans/{tag}/members` → List of player tags
3. **Fetch Battlelogs**: For each tag → `GET /players/{tag}/battlelog`
4. **Cache Check**: If cache exists < TTL → use cache, otherwise fetch fresh
5. **Parse & Validate**: Detect incomplete decks (< 8 cards)
6. **Generate ID**: MD5(battleTime + type + mode + sorted_tags) → UUID
7. **Upsert Battle**: INSERT if not exists, SKIP if exists (no overwrite by default)
8. **Repair Queue**: If `needs_refresh=true` → retry until max_attempts
9. **Flush Cards**: Batch upsert of newly discovered cards

---

## 3. Code Structure

### 3.1 Single File: `cron_clash_sync.py` (986 lines)

**Internal organization** (no separate modules):
```python
# Config (lines 1-60)
@dataclass class Config
def load_config() -> Config

# Logging (lines 60-75)
def setup_logging(cfg: Config)

# Cache (lines 75-105)
def load_cache(path, ttl_minutes)
def save_cache(path, data)

# Supercell API (lines 105-135)
class SupercellApi:
    def get_clan_members(clan_tag)
    def get_player_battlelog(player_tag)

# Card Management (lines 135-200)
def load_card_cache(sb)
def queue_missing_cards(cards, card_cache, pending_cards)
def flush_pending_cards(sb, pending_cards)

# Battle Parsing (lines 200-310)
def parse_battle_time(s)
def stable_battle_id(...)
def extract_player_tags_from_battle(b)
def is_incomplete_deck(b)
def detect_round_count(b)
def detect_team_size(b)

# Supabase Persistence (lines 310-550)
def sb_get_battle(sb, battle_id)
def sb_insert_battle_with_rounds(...)
def sb_mark_battle_for_refresh(...)
def sb_overwrite_battle_with_rounds(...)
def sb_update_battle_still_incomplete(...)

# Transform (lines 550-750)
def to_battle_rows(b, battle_id, ...)
def make_round_player_row(...)
def assign_player_ids(rows, tag_to_player_id)

# Main Logic (lines 750-986)
def sync_player_battlelog(...)
def run_sync_once(cfg, sb, api, card_cache)
def run_repairs(sb, api, cfg, card_cache)
def main()
if __name__ == "__main__": main()
```

**Architectural pattern**: Procedural / Functional (no classes except API wrapper and Config)

---

## 4. Configuration (.env)

### 4.1 Environment Variables
```bash
# Supabase
SUPABASE_URL=https://kivlwozjpijejrubapcw.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...  # ⚠️ SENSITIVE

# Supercell API
SUPERCELL_TOKEN=eyJ0eXAiOiJKV1QiLC...  # ⚠️ SENSITIVE
CLAN_TAG=#PUGCG80C

# Cache
CACHE_DIR=./cache
CACHE_TTL_CLAN_MIN=30          # 30 minutes
CACHE_TTL_BATTLELOG_MIN=60     # 60 minutes

# Repair Logic
REPAIR_MAX_ATTEMPTS=5          # Max retries for incomplete battles
REPAIR_BATCH_SIZE=25           # Number of battles to repair per cycle

# Logging
LOG_FILE=./logs/cron.log
LOG_LEVEL=INFO                 # DEBUG, INFO, WARNING, ERROR
```

### 4.2 File Structure
```
cron/
├── cron_clash_sync.py         # Main script (986 lines)
├── requirements.txt           # python-dotenv, requests, supabase
├── .env                       # ⚠️ Contains secrets, DO NOT commit
├── venv/                      # Python virtual environment
├── cache/                     # API response cache (JSON)
│   ├── clan_PUGCG80C.json
│   └── battlelog_{tag}.json
└── logs/                      # Execution logs
    └── cron.log
```

---

## 5. Critical Business Logic

### 5.1 Deterministic Battle ID Generation
**Problem**: Supercell API does not return a unique ID for battles.  
**Solution**: Generate deterministic ID from unique attributes.

```python
def stable_battle_id(
    battle_time: datetime,
    player_tags: List[str],
    game_mode: str,
    battle_type: str
) -> str:
    tags = ",".join(sorted([t.upper() for t in player_tags]))
    key = f"{battle_time.isoformat()}|{battle_type}|{game_mode}|{tags}"
    md5 = hashlib.md5(key.encode("utf-8")).hexdigest()
    # Format as UUID
    return f"{md5[0:8]}-{md5[8:12]}-{md5[12:16]}-{md5[16:20]}-{md5[20:32]}"
```

**ID Components**:
1. `battleTime` - Exact timestamp (e.g., `20240115T143025.000Z`)
2. `battleType` - Battle type (e.g., `clanWarWarDay`, `challenge`)
3. `gameMode` - Game mode (e.g., `CW_Battle_1v1`, `CW_Duel`)
4. `sorted(player_tags)` - Tags sorted alphabetically

**Properties**:
- ✅ Idempotent: Same input → same UUID
- ✅ No collisions (in practice): MD5 + timestamp + participants
- ⚠️ Sensitive to tag changes: If a player changes tag, generates new ID

### 5.2 Incomplete Deck Detection

**Context**: Supercell API sometimes returns battles without complete cards (< 8 cards per deck).

**Validation Rules**:
```python
def is_incomplete_deck(b: Dict[str, Any]) -> bool:
    # Classic 1v1: each player must have 8 cards in player['cards']
    # Duel: each round must have 8 cards in round['cards']
    
    if battle_has_rounds(b):
        return is_incomplete_deck_rounds(team, opp)
    else:
        return is_incomplete_deck_classic(team, opp)
```

**Detected Cases**:
1. **Classic 1v1**: `player['cards']` must have exactly 8 elements
2. **2v2**: Both players on each side must have 8 cards
3. **Duel (rounds)**: Each round of each player must have 8 cards
4. **Round inconsistency**: All players must have same number of rounds

**Action if incomplete**:
```python
battle_row["sync_status"] = "INCOMPLETE"
battle_row["needs_refresh"] = True
battle_row["data_quality"] = {"missing_cards": True, "reason": "..."}
```

### 5.3 Repair Queue (Auto-Retry Logic)

**Problem**: Incomplete battles cannot be "re-fetched" directly (no `/battles/{id}` endpoint in Supercell API).

**Solution**: Retry system based on re-synchronization of battlelogs from involved players.

**Workflow**:
1. Battle inserted with `needs_refresh=true`, `sync_status=INCOMPLETE`
2. In next cycle, `run_repairs()` selects up to `REPAIR_BATCH_SIZE` battles
3. For each battle:
   - If `refresh_attempts >= max_attempts` → `sync_status=GIVE_UP`, `needs_refresh=false`
   - If not, marks `sync_status=REPAIR_QUEUED`, `refresh_attempts += 1`
4. In `sync_player_battlelog()`, if existing battle has `needs_refresh=true`:
   - Re-parse current payload
   - If now complete → `sb_overwrite_battle_with_rounds()`, `sync_status=REPAIRED`
   - If still incomplete → `refresh_attempts += 1`

**Battle States**:
```python
sync_status = "OK" | "INCOMPLETE" | "REPAIR_QUEUED" | "REPAIRED" | "GIVE_UP"
```

### 5.4 Auto-Creation of Player Identities

**Problem**: Battles may contain tags of unregistered players in the league (external opponents, guests).

**Solution**: Auto-create `player` + `player_identity` for unknown tags, but **only for participants in active season**.

```python
def sb_auto_create_missing_player_identities(sb, tags, existing_mapping):
    # 1. Filter tags that already exist in player_identity
    missing_tags = tags - existing_mapping.keys()
    
    # 2. For each missing tag:
    for tag in missing_tags:
        player_id = uuid4()
        # Insert player with nick = tag (temporary)
        sb.table("player").insert({"player_id": player_id, "nick": tag})
        # Insert player_identity
        sb.table("player_identity").insert({
            "player_id": player_id,
            "player_tag": tag,
            "valid_from": now_utc(),
        })
```

**Limitation**: Identities are only created for tags of players in `season_zone_team_player` (active participants).

---

## 6. Cache System

### 6.1 Purpose
Reduce calls to Supercell API (rate limit: ~1000 req/min at Silver tier).

### 6.2 Implementation
```python
def load_cache(path: str, ttl_minutes: int) -> Optional[Dict]:
    if not os.path.exists(path):
        return None
    
    age_sec = time.time() - os.path.getmtime(path)
    if age_sec > ttl_minutes * 60:
        return None  # Cache expired
    
    return json.load(open(path))

def save_cache(path: str, data: Dict):
    # Atomic write with .tmp + os.replace()
    tmp = path + ".tmp"
    json.dump(data, open(tmp, "w"), indent=2)
    os.replace(tmp, path)  # Atomic on POSIX and Windows
```

### 6.3 Cache Files
```
cache/
├── clan_PUGCG80C.json           # TTL: 30 min
└── battlelog_{player_tag}.json  # TTL: 60 min
```

**Invalidation strategy**: Based on file modification time (mtime).

---

## 7. Database (Supabase)

### 7.1 Main Tables Affected

| Table | Operations | Description |
|-------|-------------|-------------|
| `battle` | INSERT, UPDATE | Main battle (1 row = 1 battle) |
| `battle_round` | INSERT, DELETE | Duel rounds (1-3 per battle) |
| `battle_round_player` | INSERT, DELETE | Players per round (2-4 per round) |
| `card` | UPSERT | CR cards (auto-discovered) |
| `player_identity` | INSERT, SELECT | Tag → player_id mapping |
| `season_zone_team_player` | SELECT | List of season participants |

### 7.2 Critical Fields in `battle`

```sql
battle (
  battle_id UUID PRIMARY KEY,
  battle_time TIMESTAMPTZ NOT NULL,
  api_battle_type VARCHAR,      -- "clanWarWarDay", "challenge", etc.
  api_game_mode VARCHAR,         -- "CW_Battle_1v1", "CW_Duel", etc.
  team_size INT,                 -- 1 or 2
  round_count INT,               -- 1 (1v1) or 2-3 (duel)
  
  sync_status VARCHAR,           -- "OK", "INCOMPLETE", "REPAIRED", "GIVE_UP"
  needs_refresh BOOLEAN,         -- true if requires retry
  refresh_attempts INT,          -- attempt counter
  last_refresh_at TIMESTAMPTZ,   -- last time attempted to repair
  data_quality JSONB,            -- metadata of detected issues
  
  raw_payload JSONB              -- complete payload from Supercell API
)
```

### 7.3 Transactions and Consistency

**Does not use explicit transactions** → Each `insert()` or `update()` is an isolated operation.

**Risks**:
- If `battle_round.insert()` fails after `battle.insert()`, battle is left without rounds
- If `battle_round_player.insert()` fails, round is left without players

**Current mitigation**:
- Retry logic with exponential backoff (see `sb_insert_battle_with_rounds`)
- Detailed error logging
- Manual repair system (via admin app)

---

## 8. Supercell API (Clash Royale)

### 8.1 Used Endpoints

```python
class SupercellApi:
    base = "https://api.clashroyale.com/v1"
    
    def get_clan_members(self, clan_tag: str):
        # GET /clans/%23PUGCG80C/members
        # Returns: {"items": [{"tag": "#ABC", "name": "..."}, ...]}
        
    def get_player_battlelog(self, player_tag: str):
        # GET /players/%23ABC/battlelog
        # Returns: [{"battleTime": "...", "team": [...], ...}, ...]
```

### 8.2 Rate Limits (Silver Tier)
- **Requests/min**: ~1000
- **Throttling**: HTTP 429 if exceeded
- **IP Whitelist**: Configured in developer portal (181.87.204.177)

### 8.3 Authentication
```python
headers = {
    "Authorization": f"Bearer {SUPERCELL_TOKEN}",
    "Accept": "application/json"
}
```

**Token**: JWT with long expiration (~1 year), scope: `royale`

### 8.4 Battle Format (JSON)

**Simplified example**:
```json
{
  "battleTime": "20240115T143025.000Z",
  "type": "clanWarWarDay",
  "gameMode": {"name": "CW_Battle_1v1"},
  "team": [
    {
      "tag": "#ABC123",
      "name": "Player1",
      "cards": [{<8 cards>}],
      "crowns": 2
    }
  ],
  "opponent": [
    {
      "tag": "#DEF456",
      "name": "Player2",
      "cards": [{<8 cards>}],
      "crowns": 1
    }
  ]
}
```

**For duels** (2-3 rounds):
```json
{
  "team": [
    {
      "tag": "#ABC",
      "rounds": [
        {"cards": [<8 cards>], "crowns": 1},
        {"cards": [<8 cards>], "crowns": 2}
      ]
    }
  ]
}
```

---

## 9. Logging and Monitoring

### 9.1 Log Configuration
```python
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    handlers=[
        logging.FileHandler("./logs/cron.log", encoding="utf-8"),
        logging.StreamHandler()  # Also stdout
    ]
)
```

### 9.2 Types of Logged Messages

| Level | Example |
|-------|---------|
| INFO | `"Fetching battlelog for player #ABC123..."` |
| INFO | `"Battle inserted: {battle_id}"` |
| WARNING | `"Battle still incomplete: {battle_id}"` |
| ERROR | `"Failed to insert battle after 3 attempts: {error}"` |
| DEBUG | `"Cache hit for battlelog_{tag}.json"` |

### 9.3 Metrics per Cycle
```
[2024-01-15 14:30:00] INFO | Starting sync cycle...
[2024-01-15 14:30:05] INFO | Fetched 53 clan members
[2024-01-15 14:32:15] INFO | Processed 53 players: 12 inserted, 150 skipped, 3 marked incomplete
[2024-01-15 14:32:20] INFO | Inserted 5 new cards
[2024-01-15 14:32:25] INFO | Waiting 30 minutes before next sync...
```

### 9.4 Manual Monitoring
**Currently missing**:
- ❌ Automatic alerts (e.g., if sync fails 3 times in a row)
- ❌ Metrics dashboard
- ❌ Health check endpoint

**Proposal**:
- Add `/health` endpoint with Flask/FastAPI
- Export metrics to Prometheus
- Alerts via email/Slack if error rate > threshold

---

## 10. Deployment and Operations

### 10.1 Current Execution

**Method**: Probably executed manually or via crontab/systemd.

**Command**:
```bash
cd /path/to/cron
source venv/bin/activate  # or .\venv\Scripts\Activate.ps1 on Windows
python cron_clash_sync.py
```

**Logs**: `./logs/cron.log` (rotate manually)

### 10.2 Suggested Deployment (Production)

**Option A: Systemd Service (Linux)**
```ini
# /etc/systemd/system/clash-sync.service
[Unit]
Description=Clash Royale Battle Sync
After=network.target

[Service]
Type=simple
User=ligaadmin
WorkingDirectory=/opt/liga/cron
ExecStart=/opt/liga/cron/venv/bin/python cron_clash_sync.py
Restart=always
RestartSec=60

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable clash-sync
sudo systemctl start clash-sync
sudo systemctl status clash-sync
```

**Option B: Docker Container**
```dockerfile
FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY cron_clash_sync.py .env ./
CMD ["python", "cron_clash_sync.py"]
```

```bash
docker build -t clash-sync .
docker run -d --restart always --name clash-sync clash-sync
```

**Option C: Kubernetes CronJob** (if already using K8s)
```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: clash-sync
spec:
  schedule: "*/30 * * * *"  # Every 30min
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: sync
            image: clash-sync:latest
            envFrom:
            - secretRef:
                name: clash-sync-secrets
```

### 10.3 Health Check Monitoring

**Health Check Script**:
```python
# health_check.py
import os, time

log_file = "./logs/cron.log"
max_age_sec = 45 * 60  # 45 minutes

if not os.path.exists(log_file):
    print("FAIL: Log file not found")
    exit(1)

age = time.time() - os.path.getmtime(log_file)
if age > max_age_sec:
    print(f"FAIL: Log file not updated in {age/60:.1f} minutes")
    exit(1)

print("OK: Cron is running")
exit(0)
```

**Integration with monitoring**:
```bash
# Run every 5 minutes from another cron
*/5 * * * * /opt/liga/cron/health_check.py || /usr/bin/alert-admin
```

---

## 11. Useful Development Commands

```bash
# Initial setup
python -m venv venv
source venv/bin/activate  # Windows: .\venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Edit configuration
nano .env

# Run once (foreground)
python cron_clash_sync.py

# Run in background (Linux/Mac)
nohup python cron_clash_sync.py > output.log 2>&1 &

# Run in background (Windows)
Start-Job -ScriptBlock { python cron_clash_sync.py }

# View logs in real-time
tail -f logs/cron.log

# Clear cache
rm -rf cache/*.json

# Check last execution
ls -lh logs/cron.log

# Manual API test
python -c "
from cron_clash_sync import SupercellApi, load_config
cfg = load_config()
api = SupercellApi(cfg.supercell_token)
print(api.get_clan_members(cfg.clan_tag))
"
```

---

## 12. Dependencies (requirements.txt)

```txt
python-dotenv==1.0.1    # Load .env
requests==2.32.3        # HTTP client for Supercell API
supabase==2.6.0         # Supabase Python SDK
```

**Transitive dependencies** (installed by `supabase`):
- `postgrest-py` - PostgreSQL REST client
- `storage3` - S3 client
- `gotrue` - Auth client
- `websockets` - For Realtime

**No testing dependencies** (to add):
```txt
pytest==8.0.0
pytest-cov==4.1.0
responses==0.24.0  # Mock requests
```

---

## 13. Code Metrics

| Metric | Value |
|--------|-------|
| **Total lines** | 986 |
| **Functions** | 40+ |
| **Classes** | 2 (Config, SupercellApi) |
| **Cyclomatic complexity** | High (functions > 50 lines) |
| **Test coverage** | 0% |
| **External dependencies** | 3 (dotenv, requests, supabase) |
| **DB queries** | 20+ `sb_*` functions |
| **API calls** | 2 endpoints (clan_members, battlelog) |


## 14. Git Workflow

See [`.github/WORKFLOW.md`](../../.github/WORKFLOW.md) for complete documentation.

**Summary**:
- Branch naming: `feature/CR-P1-001-description`, `fix/CR-P0-002-description`
- Commits: `feat(cron): add retry with exponential backoff (CR-P0-002)`
- Code review: Developer → Architect → Merge/Reject

**Update docs when**:
- Add new functions → This doc, section 3
- Change critical algorithms → This doc, section 5
- Modify database → `specs/04-database-schema.md`
- Complete tasks → `DEVELOPMENT_BACKLOG.md`

---

## 15. References

### External Documentation
- [Clash Royale API Docs](https://developer.clashroyale.com/api-docs/index.html)
- [Supabase Python SDK](https://github.com/supabase-community/supabase-py)
- [python-dotenv](https://pypi.org/project/python-dotenv/)

### Project Files
- [liga-admin Database Schema](../../specs/04-database-schema.md)
- [liga-admin Migrations](../../specs/05-database-migrations.md)
- [Git Workflow and Code Review](../../.github/WORKFLOW.md) ⭐
- [Development Backlog](../../DEVELOPMENT_BACKLOG.md)

---

**Last updated**: 2026-01-24  
**Author**: Documentation generated by AI Agent (Architect)  
**Version**: 1.0
