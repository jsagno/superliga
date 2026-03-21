import os
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from postgrest.exceptions import APIError
from supabase import create_client, Client


# ──────────────────────────────────────────────────────────────
# Config
# ──────────────────────────────────────────────────────────────

@dataclass
class Config:
    supabase_url: str
    supabase_key: str
    log_file: str
    log_level: str


def load_config() -> Config:
    dotenv_path = os.path.join(os.path.dirname(__file__), ".env")
    load_dotenv(dotenv_path=dotenv_path, override=False)

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        raise SystemExit(
            "ERROR: SUPABASE_URL and SUPABASE_KEY must be set in the environment or .env file"
        )

    return Config(
        supabase_url=url,
        supabase_key=key,
        log_file=os.environ.get("LOG_FILE", "./logs/standings_cron.log"),
        log_level=os.environ.get("LOG_LEVEL", "INFO"),
    )


# ──────────────────────────────────────────────────────────────
# Logging
# ──────────────────────────────────────────────────────────────

def setup_logging(cfg: Config) -> None:
    os.makedirs(os.path.dirname(cfg.log_file), exist_ok=True)
    level = getattr(logging, cfg.log_level.upper(), logging.INFO)

    file_handler = logging.FileHandler(cfg.log_file, encoding="utf-8")
    file_handler.setFormatter(logging.Formatter("%(asctime)s | %(levelname)s | %(message)s"))

    console_handler = logging.StreamHandler()
    console_handler.setFormatter(logging.Formatter("%(asctime)s | %(levelname)s | %(message)s"))

    logging.basicConfig(level=level, handlers=[file_handler, console_handler])
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)


# ──────────────────────────────────────────────────────────────
# Supabase helpers
# ──────────────────────────────────────────────────────────────

def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def insert_points_ledger_rows_idempotent(sb: Client, rows: List[Dict[str, Any]]) -> int:
    """
    Inserts points_ledger rows one-by-one.
    Duplicate-key errors (23505) are ignored to preserve idempotency.

    Why row-by-row?
    - points_ledger idempotency is enforced by a partial expression unique index
      (ux_points_ledger_idempotent), which PostgREST cannot target via on_conflict
      column inference. Batch upsert therefore fails with 42P10.
    """
    inserted = 0
    duplicates = 0

    for row in rows:
        try:
            sb.table("points_ledger").insert(row).execute()
            inserted += 1
        except APIError as exc:
            # Unique violation -> row already exists (idempotent re-run)
            if getattr(exc, "code", None) == "23505":
                duplicates += 1
                continue
            raise

    if duplicates:
        logging.info(f"  [LEDGER] Skipped {duplicates} duplicate row(s)")
    return inserted


# ──────────────────────────────────────────────────────────────
# Step 1 — Populate points_ledger from CW_DAILY duels
# ──────────────────────────────────────────────────────────────

def populate_cw_daily_ledger(sb: Client, season_id: str) -> int:
    """
    Reads resolved CW_DAILY scheduled_match_result rows for the season and
    upserts points_ledger entries (source_type='CW_DAILY').
    Returns the number of new rows inserted.
    """
    logging.info(f"  [CW_DAILY] Fetching resolved duels for season {season_id}")

    # Fetch CW_DAILY matches with results for this season
    resp = (
        sb.table("scheduled_match")
        .select(
            "scheduled_match_id, player_a_id, player_b_id, zone_id,"
            " scheduled_match_result(points_a, points_b)"
        )
        .eq("season_id", season_id)
        .eq("type", "CW_DAILY")
        .not_.is_("scheduled_match_result", "null")
        .execute()
    )

    matches = resp.data or []
    rows_to_insert: List[Dict[str, Any]] = []

    for m in matches:
        result = m.get("scheduled_match_result")
        if not result:
            continue
        # result may be a list (postgrest nested) or dict
        if isinstance(result, list):
            if not result:
                continue
            result = result[0]

        match_id = m["scheduled_match_id"]
        zone_id = m["zone_id"]

        if m["player_a_id"]:
            rows_to_insert.append({
                "scope": "PLAYER",
                "season_id": season_id,
                "zone_id": zone_id,
                "player_id": m["player_a_id"],
                "source_type": "CW_DAILY",
                "source_id": match_id,
                "sub_key": "player_a",
                "points": result.get("points_a") or 0,
                "is_reversal": False,
            })

        if m.get("player_b_id"):
            rows_to_insert.append({
                "scope": "PLAYER",
                "season_id": season_id,
                "zone_id": zone_id,
                "player_id": m["player_b_id"],
                "source_type": "CW_DAILY",
                "source_id": match_id,
                "sub_key": "player_b",
                "points": result.get("points_b") or 0,
                "is_reversal": False,
            })

    if not rows_to_insert:
        logging.info("  [CW_DAILY] No duel rows to process")
        return 0

    inserted = insert_points_ledger_rows_idempotent(sb, rows_to_insert)
    logging.info(f"  [CW_DAILY] Inserted {inserted} new ledger row(s)")
    return inserted


# ──────────────────────────────────────────────────────────────
# Step 2 — Populate points_ledger from competition matches
# ──────────────────────────────────────────────────────────────

COPA_COMPETITION_NAMES = ("Copa de Liga", "Copa Revenge")
COPA_SOURCE_TYPE_MAP = {
    "Copa de Liga": "COPA_LIGA",
    "Copa Revenge": "COPA_REVENGE",
}


def populate_competition_ledger(sb: Client, season_id: str) -> int:
    """
    Reads resolved match results for Copa de Liga and Copa Revenge competitions
    for the season and upserts points_ledger entries.
    Returns the number of new rows inserted.
    """
    # Find competition IDs by name
    comp_resp = (
        sb.table("competition")
        .select("competition_id, name")
        .in_("name", list(COPA_COMPETITION_NAMES))
        .execute()
    )
    competitions = comp_resp.data or []

    if not competitions:
        logging.info("  [COPA] No Copa de Liga / Copa Revenge competitions found")
        return 0

    comp_id_to_source_type = {c["competition_id"]: COPA_SOURCE_TYPE_MAP[c["name"]] for c in competitions}
    copa_ids = list(comp_id_to_source_type.keys())

    logging.info(f"  [COPA] Found {len(copa_ids)} competition(s): {[c['name'] for c in competitions]}")

    # Fetch copa matches with results for this season
    resp = (
        sb.table("scheduled_match")
        .select(
            "scheduled_match_id, player_a_id, player_b_id, zone_id, competition_id,"
            " scheduled_match_result(points_a, points_b)"
        )
        .eq("season_id", season_id)
        .in_("competition_id", copa_ids)
        .not_.is_("scheduled_match_result", "null")
        .execute()
    )

    matches = resp.data or []
    rows_to_insert: List[Dict[str, Any]] = []

    for m in matches:
        result = m.get("scheduled_match_result")
        if not result:
            continue
        if isinstance(result, list):
            if not result:
                continue
            result = result[0]

        match_id = m["scheduled_match_id"]
        zone_id = m["zone_id"]
        source_type = comp_id_to_source_type.get(m["competition_id"])
        if not source_type:
            continue

        if m["player_a_id"]:
            rows_to_insert.append({
                "scope": "PLAYER",
                "season_id": season_id,
                "zone_id": zone_id,
                "player_id": m["player_a_id"],
                "source_type": source_type,
                "source_id": match_id,
                "sub_key": "player_a",
                "points": result.get("points_a") or 0,
                "is_reversal": False,
            })

        if m.get("player_b_id"):
            rows_to_insert.append({
                "scope": "PLAYER",
                "season_id": season_id,
                "zone_id": zone_id,
                "player_id": m["player_b_id"],
                "source_type": source_type,
                "source_id": match_id,
                "sub_key": "player_b",
                "points": result.get("points_b") or 0,
                "is_reversal": False,
            })

    if not rows_to_insert:
        logging.info("  [COPA] No copa rows to process")
        return 0

    inserted = insert_points_ledger_rows_idempotent(sb, rows_to_insert)
    logging.info(f"  [COPA] Inserted {inserted} new ledger row(s)")
    return inserted


# ──────────────────────────────────────────────────────────────
# Step 3 — Compute standings
# ──────────────────────────────────────────────────────────────

STANDINGS_SOURCE_TYPES = ("LIGA_BONUS", "CW_DAILY", "COPA_LIGA", "COPA_REVENGE")


def compute_standings(sb: Client, season_id: str, zone_id: str) -> List[Dict[str, Any]]:
    """
    Computes standings per player in the zone.
    Returns a list of player rows with computed points and position info.
    """
    # Load all active players in the zone with their initial_points and league
    players_resp = (
        sb.table("season_zone_team_player")
        .select("player_id, league, initial_points, ranking_seed")
        .eq("zone_id", zone_id)
        .is_("end_date", "null")
        .execute()
    )
    players = players_resp.data or []

    if not players:
        return []

    player_ids = [p["player_id"] for p in players]

    # Load wins/losses per player from scheduled_match_result
    matches_resp = (
        sb.table("scheduled_match")
        .select(
            "player_a_id, player_b_id,"
            " scheduled_match_result(final_score_a, final_score_b)"
        )
        .eq("season_id", season_id)
        .eq("zone_id", zone_id)
        .eq("type", "CW_DAILY")
        .not_.is_("scheduled_match_result", "null")
        .execute()
    )

    # Compute wins/losses per player
    wins: Dict[str, int] = {pid: 0 for pid in player_ids}
    losses: Dict[str, int] = {pid: 0 for pid in player_ids}

    for m in (matches_resp.data or []):
        result = m.get("scheduled_match_result")
        if not result:
            continue
        if isinstance(result, list):
            if not result:
                continue
            result = result[0]

        sa = result.get("final_score_a", 0) or 0
        sb_score = result.get("final_score_b", 0) or 0
        pa = m.get("player_a_id")
        pb = m.get("player_b_id")

        if pa and pa in wins:
            if sa > sb_score:
                wins[pa] += 1
            else:
                losses[pa] += 1

        if pb and pb in wins:
            if sb_score > sa:
                wins[pb] += 1
            else:
                losses[pb] += 1

    # Load ledger totals per player (broken down by source_type)
    ledger_resp = (
        sb.table("points_ledger")
        .select("player_id, source_type, points")
        .eq("season_id", season_id)
        .eq("zone_id", zone_id)
        .eq("scope", "PLAYER")
        .in_("source_type", list(STANDINGS_SOURCE_TYPES))
        .eq("is_reversal", False)
        .in_("player_id", player_ids)
        .execute()
    )

    # Also load reversal rows to subtract them
    reversal_resp = (
        sb.table("points_ledger")
        .select("player_id, source_type, points")
        .eq("season_id", season_id)
        .eq("zone_id", zone_id)
        .eq("scope", "PLAYER")
        .in_("source_type", list(STANDINGS_SOURCE_TYPES))
        .eq("is_reversal", True)
        .in_("player_id", player_ids)
        .execute()
    )

    # Aggregate points per player per source_type
    ledger_by_player: Dict[str, Dict[str, int]] = {pid: {} for pid in player_ids}
    for row in (ledger_resp.data or []):
        pid = row["player_id"]
        st = row["source_type"]
        if pid in ledger_by_player:
            ledger_by_player[pid][st] = ledger_by_player[pid].get(st, 0) + (row["points"] or 0)
    for row in (reversal_resp.data or []):
        pid = row["player_id"]
        st = row["source_type"]
        if pid in ledger_by_player:
            ledger_by_player[pid][st] = ledger_by_player[pid].get(st, 0) + (row["points"] or 0)

    # Build result rows
    rows = []
    for p in players:
        pid = p["player_id"]
        initial = p.get("initial_points") or 0
        ledger = ledger_by_player.get(pid, {})
        points_total = initial + sum(ledger.values())

        rows.append({
            "player_id": pid,
            "league": p["league"],
            "initial_points": initial,
            "points_bonus": ledger.get("LIGA_BONUS", 0),
            "points_cw_daily": ledger.get("CW_DAILY", 0),
            "points_copa": ledger.get("COPA_LIGA", 0) + ledger.get("COPA_REVENGE", 0),
            "points_total": points_total,
            "wins": wins.get(pid, 0),
            "losses": losses.get(pid, 0),
        })

    return rows


def _assign_positions(rows: List[Dict[str, Any]], key_fn) -> None:
    """Sort rows by key_fn and assign position in-place."""
    rows.sort(key=key_fn, reverse=True)
    for i, row in enumerate(rows):
        row["_position"] = i + 1


def fetch_previous_snapshot(sb: Client, season_id: str, zone_id: str, scope: str) -> Dict[str, int]:
    """Returns {player_id: position} from the previous snapshot."""
    resp = (
        sb.table("player_standings_snapshot")
        .select("player_id, position")
        .eq("season_id", season_id)
        .eq("zone_id", zone_id)
        .eq("scope", scope)
        .execute()
    )
    return {r["player_id"]: r["position"] for r in (resp.data or [])}


# ──────────────────────────────────────────────────────────────
# Step 4 — Write snapshot
# ──────────────────────────────────────────────────────────────

def write_snapshot(sb: Client, season_id: str, zone_id: str, computed_rows: List[Dict[str, Any]]) -> int:
    """
    Writes player_standings_snapshot rows for both ZONE and LEAGUE scopes.
    Updates season_zone.last_snapshot_at.
    Returns total rows written.
    """
    now = now_utc()
    total_written = 0

    # ── ZONE scope: all players ordered by points_total ──
    zone_previous = fetch_previous_snapshot(sb, season_id, zone_id, "ZONE")
    zone_rows = [dict(r) for r in computed_rows]
    _assign_positions(zone_rows, lambda r: (r["points_total"], -r.get("wins", 0)))

    zone_snapshot = []
    for r in zone_rows:
        prev_pos = zone_previous.get(r["player_id"], r["_position"])
        zone_snapshot.append({
            "season_id": season_id,
            "zone_id": zone_id,
            "player_id": r["player_id"],
            "scope": "ZONE",
            "league": r["league"],
            "position": r["_position"],
            "points_total": r["points_total"],
            "wins": r["wins"],
            "losses": r["losses"],
            "delta_position": prev_pos - r["_position"],
            "updated_at": now,
        })

    # ── LEAGUE scope: players grouped by league, ordered within league ──
    league_previous = fetch_previous_snapshot(sb, season_id, zone_id, "LEAGUE")
    leagues = {}
    for r in computed_rows:
        leagues.setdefault(r["league"], []).append(dict(r))

    league_snapshot = []
    for league_name, league_rows in leagues.items():
        _assign_positions(league_rows, lambda r: (r["points_total"], -r.get("wins", 0)))
        for r in league_rows:
            prev_pos = league_previous.get(r["player_id"], r["_position"])
            league_snapshot.append({
                "season_id": season_id,
                "zone_id": zone_id,
                "player_id": r["player_id"],
                "scope": "LEAGUE",
                "league": r["league"],
                "position": r["_position"],
                "points_total": r["points_total"],
                "wins": r["wins"],
                "losses": r["losses"],
                "delta_position": prev_pos - r["_position"],
                "updated_at": now,
            })

    all_snapshot_rows = zone_snapshot + league_snapshot
    if all_snapshot_rows:
        sb.table("player_standings_snapshot").upsert(
            all_snapshot_rows,
            on_conflict="season_id,zone_id,scope,league,player_id",
        ).execute()
        total_written = len(all_snapshot_rows)

    # Update last_snapshot_at on the zone
    sb.table("season_zone").update({"last_snapshot_at": now}).eq("zone_id", zone_id).execute()

    logging.info(f"  Wrote {total_written} snapshot rows, updated last_snapshot_at")
    return total_written


# ──────────────────────────────────────────────────────────────
# Main loop
# ──────────────────────────────────────────────────────────────

def run_standings_once(cfg: Config, sb: Optional[Client] = None) -> Dict[str, int]:
    owns_client = sb is None
    if owns_client:
        sb = create_client(cfg.supabase_url, cfg.supabase_key)

    # Fetch active seasons
    seasons_resp = sb.table("season").select("season_id, description").eq("status", "ACTIVE").execute()
    seasons = seasons_resp.data or []

    if not seasons:
        logging.info("No active seasons found. Exiting.")
        return {
            "season_count": 0,
            "ledger_rows": 0,
            "snapshot_rows": 0,
        }

    total_ledger_rows = 0
    total_snapshot_rows = 0

    for season in seasons:
        season_id = season["season_id"]
        logging.info(f"Processing season: {season['description']} ({season_id})")

        # Populate ledger from duels
        ledger_cw = populate_cw_daily_ledger(sb, season_id)
        total_ledger_rows += ledger_cw

        # Populate ledger from copa competitions
        ledger_copa = populate_competition_ledger(sb, season_id)
        total_ledger_rows += ledger_copa

        # Fetch zones for this season
        zones_resp = (
            sb.table("season_zone")
            .select("zone_id, name")
            .eq("season_id", season_id)
            .execute()
        )
        zones = zones_resp.data or []

        for zone in zones:
            zone_id = zone["zone_id"]
            logging.info(f"  Zone: {zone['name']} ({zone_id})")

            computed = compute_standings(sb, season_id, zone_id)
            if not computed:
                logging.info("  No active players — skipping snapshot")
                continue

            written = write_snapshot(sb, season_id, zone_id, computed)
            total_snapshot_rows += written

    logging.info("=" * 60)
    logging.info(f"Standings cron complete")
    logging.info(f"  Ledger rows upserted : {total_ledger_rows}")
    logging.info(f"  Snapshot rows written: {total_snapshot_rows}")
    logging.info("=" * 60)

    return {
        "season_count": len(seasons),
        "ledger_rows": total_ledger_rows,
        "snapshot_rows": total_snapshot_rows,
    }


def main() -> None:
    cfg = load_config()
    setup_logging(cfg)

    logging.info("=" * 60)
    logging.info("Standings cron started")
    logging.info("=" * 60)

    run_standings_once(cfg)


if __name__ == "__main__":
    main()
