# standings-cron

Python script that computes and persists `player_standings_snapshot` for LigaInterna.

This script remains a one-shot executable, but it can also be invoked automatically by `packages/cron/cron_clash_sync.py` after each completed sync cycle.

## What it does

On each run, for every active season and zone:
1. **`populate_cw_daily_ledger`** — reads `scheduled_match_result` for `CW_DAILY` matches and upserts `points_ledger` entries with `source_type='CW_DAILY'`.
2. **`populate_competition_ledger`** — reads results for **Copa de Liga** and **Copa Revenge** competitions and upserts ledger entries with `source_type='COPA_LIGA'` / `'COPA_REVENGE'`.
3. **`compute_standings`** — calculates `points_total = initial_points + SUM(ledger)`, win/loss records, and assigns positions.
4. **`write_snapshot`** — upserts `player_standings_snapshot` for both `ZONE` and `LEAGUE` scopes, calculates `delta_position` vs. previous snapshot, and updates `season_zone.last_snapshot_at`.

All ledger ingestion is **idempotent** (uses `on_conflict` upsert).

## Setup

```bash
cd packages/standings-cron
cp .env.example .env
# Edit .env with your Supabase URL and service-role key
pip install -r requirements.txt
```

## Running

```bash
python standings_cron.py
```

## Chained Execution

When the main cron loop is enabled, standings runs as the second phase of the shared 30-minute cycle:

1. `cron_clash_sync.py` completes battle sync.
2. It invokes `standings_cron.py` in one-shot mode.
3. The main loop sleeps 30 minutes.

Do not schedule a second independent standings job in production if the chained cron flow is being used.

## Configuration

| Variable       | Required | Default                          | Description                  |
|---------------|----------|----------------------------------|------------------------------|
| `SUPABASE_URL` | ✅       | —                                | Project URL                  |
| `SUPABASE_KEY` | ✅       | —                                | Service role key             |
| `LOG_FILE`     | ❌       | `./logs/standings_cron.log`      | Path to log file             |
| `LOG_LEVEL`    | ❌       | `INFO`                           | DEBUG / INFO / WARNING / ERROR |

## Scheduling

Standalone scheduling is still possible for manual operations or environments where the chained flow is not enabled:

```
# Linux/macOS crontab example
*/30 * * * * cd /path/to/packages/standings-cron && python standings_cron.py
```
