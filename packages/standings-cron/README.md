# standings-cron

Python script that computes and persists `player_standings_snapshot` for LigaInterna.

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

## Configuration

| Variable       | Required | Default                          | Description                  |
|---------------|----------|----------------------------------|------------------------------|
| `SUPABASE_URL` | ✅       | —                                | Project URL                  |
| `SUPABASE_KEY` | ✅       | —                                | Service role key             |
| `LOG_FILE`     | ❌       | `./logs/standings_cron.log`      | Path to log file             |
| `LOG_LEVEL`    | ❌       | `INFO`                           | DEBUG / INFO / WARNING / ERROR |

## Scheduling

Run on a fixed interval (e.g., every 30 minutes via cron or a task scheduler):

```
# Linux/macOS crontab example
*/30 * * * * cd /path/to/packages/standings-cron && python standings_cron.py
```
