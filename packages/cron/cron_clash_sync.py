import os
import json
import time
import hashlib
import logging
import importlib.util
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone, date
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests
from dotenv import load_dotenv
from supabase import create_client, Client
from postgrest.exceptions import APIError
from colorama import Fore, Style, init as colorama_init

try:
    from discord_notifications import notify_duel_result
    DISCORD_ENABLED = True
except ImportError:
    logging.warning("discord_notifications module not available, Discord notifications disabled")
    DISCORD_ENABLED = False


# -----------------------------
# Config
# -----------------------------
@dataclass
class Config:
    supabase_url: str
    supabase_key: str

    supercell_token: str
    clan_tag: str

    cache_dir: str
    cache_ttl_clan_min: int
    cache_ttl_battlelog_min: int

    repair_max_attempts: int
    repair_batch_size: int

    log_file: str
    log_level: str


def load_config() -> Config:
    dotenv_path = os.path.join(os.path.dirname(__file__), ".env")
    load_dotenv(dotenv_path=dotenv_path, override=True)
    return Config(
        supabase_url=os.environ["SUPABASE_URL"],
        supabase_key=os.environ["SUPABASE_SERVICE_ROLE_KEY"],
        supercell_token=os.environ["SUPERCELL_TOKEN"],
        clan_tag=os.environ.get("CLAN_TAG", "#PUGCG80C"),
        cache_dir=os.environ.get("CACHE_DIR", "./cache"),
        cache_ttl_clan_min=int(os.environ.get("CACHE_TTL_CLAN_MIN", "30")),
        cache_ttl_battlelog_min=int(os.environ.get("CACHE_TTL_BATTLELOG_MIN", "0")),
        repair_max_attempts=int(os.environ.get("REPAIR_MAX_ATTEMPTS", "5")),
        repair_batch_size=int(os.environ.get("REPAIR_BATCH_SIZE", "25")),
        log_file=os.environ.get("LOG_FILE", "./logs/cron.log"),
        log_level=os.environ.get("LOG_LEVEL", "INFO"),
    )


# -----------------------------
# Logging
# -----------------------------
class ColoredFormatter(logging.Formatter):
    """Custom formatter with colors for console output."""
    
    FORMATS = {
        logging.DEBUG: Fore.CYAN + "%(asctime)s | DEBUG | %(message)s" + Style.RESET_ALL,
        logging.INFO: "%(asctime)s | INFO | %(message)s",
        logging.WARNING: Fore.YELLOW + "%(asctime)s | WARNING | %(message)s" + Style.RESET_ALL,
        logging.ERROR: Fore.RED + "%(asctime)s | ERROR | %(message)s" + Style.RESET_ALL,
        logging.CRITICAL: Fore.RED + Style.BRIGHT + "%(asctime)s | CRITICAL | %(message)s" + Style.RESET_ALL,
    }
    
    def format(self, record):
        log_fmt = self.FORMATS.get(record.levelno, self.FORMATS[logging.INFO])
        formatter = logging.Formatter(log_fmt)
        return formatter.format(record)

def setup_logging(cfg: Config) -> None:
    colorama_init(autoreset=True)  # Initialize colorama for Windows
    os.makedirs(os.path.dirname(cfg.log_file), exist_ok=True)
    level = getattr(logging, cfg.log_level.upper(), logging.INFO)

    # File handler (no colors)
    file_handler = logging.FileHandler(cfg.log_file, encoding="utf-8")
    file_handler.setFormatter(logging.Formatter("%(asctime)s | %(levelname)s | %(message)s"))
    
    # Console handler (with colors)
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(ColoredFormatter())
    
    logging.basicConfig(
        level=level,
        handlers=[file_handler, console_handler],
    )
    
    # Suppress HTTP request logs from Supabase client libraries
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)


# -----------------------------
# Simple file cache
# -----------------------------
def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def load_cache(path: str, ttl_minutes: int) -> Optional[Dict[str, Any]]:
    if not os.path.exists(path):
        return None

    age_sec = time.time() - os.path.getmtime(path)
    if age_sec > ttl_minutes * 60:
        return None

    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as ex:
        logging.warning(f"Cache read failed for {path}: {ex}")
        return None


def save_cache(path: str, data: Dict[str, Any]) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


# -----------------------------
# Supercell API helpers
# -----------------------------
class SupercellApi:
    def __init__(self, token: str):
        self.base = "https://api.clashroyale.com/v1"
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        })

    @staticmethod
    def encode_tag(tag: str) -> str:
        # Supercell expects URL encoded tags (# -> %23)
        return requests.utils.quote(tag, safe="")

    def get_clan_members(self, clan_tag: str) -> Dict[str, Any]:
        enc = self.encode_tag(clan_tag)
        url = f"{self.base}/clans/{enc}/members"
        r = self.session.get(url, timeout=30)
        r.raise_for_status()
        return r.json()

    def get_player_battlelog(self, player_tag: str) -> List[Dict[str, Any]]:
        enc = self.encode_tag(player_tag)
        url = f"{self.base}/players/{enc}/battlelog"
        r = self.session.get(url, timeout=30)
        r.raise_for_status()
        return r.json()


# -----------------------------
# Deterministic IDs / parsing
# -----------------------------
from typing import Dict, Any, List, Optional, Tuple, Set
from typing import Dict, Any, List, Optional, Tuple, Set

def load_card_cache(sb: Client) -> Dict[int, Dict[str, Any]]:
    """
    Loads all existing cards into memory once.
    Returns dict keyed by card_id.
    """
    res = sb.table("card").select("card_id,name").execute()
    cache: Dict[int, Dict[str, Any]] = {}
    for r in (res.data or []):
        try:
            cid = int(r["card_id"])
            cache[cid] = r
        except Exception:
            continue
    logging.info(f"Card cache loaded: {len(cache)} cards")
    return cache


def queue_missing_cards(
    cards: List[Dict[str, Any]],
    card_cache: Dict[int, Dict[str, Any]],
    pending_cards: Dict[int, Dict[str, Any]],
) -> None:
    """
    Adds new cards to pending_cards + card_cache (in-memory) so next battles don't hit DB.
    pending_cards is keyed by card_id to dedupe automatically.
    """
    for c in (cards or []):
        cid_raw = c.get("id")
        if cid_raw is None:
            continue
        try:
            cid = int(cid_raw)
        except Exception:
            continue

        if cid in card_cache:
            continue

        name = c.get("name") or f"Card {cid}"
        row = {
            "card_id": cid,
            "name": name,
            "raw_payload": c,
        }

        card_cache[cid] = row
        pending_cards[cid] = row


def flush_pending_cards(sb: Client, pending_cards: Dict[int, Dict[str, Any]]) -> int:
    """
    Single batched upsert for all new cards discovered in this scope.
    """
    if not pending_cards:
        return 0

    rows = list(pending_cards.values())
    sb.table("card").upsert(rows, on_conflict="card_id").execute()
    return len(rows)

def parse_battle_time(s: str) -> datetime:
    # Handle multiple formats:
    # - Supercell: "20201219T101010.000Z"
    # - ISO with timezone: "2026-03-05T11:06:19+00:00" or "2026-03-05T11:06:19Z"
    
    # Try Supercell format first
    try:
        return datetime.strptime(s, "%Y%m%dT%H%M%S.%fZ").replace(tzinfo=timezone.utc)
    except ValueError:
        pass
    
    # Try Supercell format without milliseconds
    try:
        return datetime.strptime(s, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc)
    except ValueError:
        pass
    
    # Try ISO 8601 format with timezone offset (e.g., 2026-03-05T11:06:19+00:00)
    try:
        return datetime.fromisoformat(s)
    except (ValueError, TypeError):
        pass
    
    # If all else fails, raise error with original string
    raise ValueError(f"Cannot parse battle time: {s}")


def stable_battle_id(battle_time: datetime, player_tags: List[str], game_mode: str, battle_type: str) -> str:
    # Deterministic UUID from key string -> md5 -> UUID-like (version 4-ish)
    # Good enough for uniqueness across your dataset.
    tags = ",".join(sorted([t.upper() for t in player_tags]))
    key = f"{battle_time.isoformat()}|{battle_type}|{game_mode}|{tags}"
    md5 = hashlib.md5(key.encode("utf-8")).hexdigest()
    # Format as UUID
    return f"{md5[0:8]}-{md5[8:12]}-{md5[12:16]}-{md5[16:20]}-{md5[20:32]}"


def extract_player_tags_from_battle(b: Dict[str, Any]) -> List[str]:
    tags: List[str] = []
    for side_key in ("team", "opponent"):
        for p in b.get(side_key, []):
            tag = p.get("tag")
            if tag:
                tags.append(tag)
    return tags


def is_incomplete_deck(b: Dict[str, Any]) -> bool:
    """
    Returns True if we detect missing cards in any player deck.
    Rules:
      - Non-round battles (classic 1v1): each player must have 8 cards in player['cards'].
      - Round battles (duel): for each round, each player must have 8 cards in round['cards'].
    """
    team = b.get("team") or []
    opp = b.get("opponent") or []

    # If we can detect rounds, validate rounds first.
    if battle_has_rounds(b, team, opp):
        return is_incomplete_deck_rounds(team, opp)

    # Otherwise validate classic cards
    return is_incomplete_deck_classic(team, opp)


def battle_has_rounds(b: Dict[str, Any], team: List[Dict[str, Any]], opp: List[Dict[str, Any]]) -> bool:
    # rounds can exist at player level (common) or rarely at battle level            
    for p in team + opp:
        r = p.get("rounds")
        if isinstance(r, list) and len(r) > 0:
            return True
    return False


def is_incomplete_deck_classic(team: List[Dict[str, Any]], opp: List[Dict[str, Any]]) -> bool:
    for p in team + opp:
        cards = p.get("cards") or []
        if len(cards) != 8:
            return True
    return False


def is_incomplete_deck_rounds(team: List[Dict[str, Any]], opp: List[Dict[str, Any]]) -> bool:
    expected_rounds = None

    for p in team + opp:
        rounds = p.get("rounds")

        if not isinstance(rounds, list) or len(rounds) == 0:
            return True

        if expected_rounds is None:
            expected_rounds = len(rounds)
        elif len(rounds) != expected_rounds:
            return True

        for r in rounds:
            cards = (r or {}).get("cards") or []
            if len(cards) != 8:
                return True

    return False


def detect_round_count(b: Dict[str, Any]) -> int:
    """
    Detect number of rounds in a battle.
    - Classic 1v1: returns 1
    - Duel: returns len(rounds) (usually 2 or 3)
    """
    team = b.get("team") or []

    for p in team:
        rounds = p.get("rounds")
        if isinstance(rounds, list) and len(rounds) > 0:
            return len(rounds)

    return 1


def detect_team_size(b: Dict[str, Any]) -> int:
    # 1v1 => 1 player per side; 2v2 => 2
    team = b.get("team") or []
    return len(team) if len(team) in (1, 2) else 1


# -----------------------------
# Supabase persistence helpers
# -----------------------------
def get_current_season_id(sb) -> str:
    res = (
        sb.table("season")
        .select("season_id")
        .eq("status", "ACTIVE")
        .limit(1)
        .execute()
    )
    if not res.data:
        raise RuntimeError("No active season found")
    return res.data[0]["season_id"]

def get_season_participant_tags(sb, season_id: str) -> set[str]:
    # 1) player_ids de season_team_player
    sz = (
        sb.table("season_zone")
        .select("zone_id")
        .eq("season_id", season_id)
        .execute()
    )
    zone_ids = [r["zone_id"] for r in (sz.data or []) if r.get("zone_id")]
    if not zone_ids:
        return set()
    
    stp = (
        sb.table("season_zone_team_player")
        .select("player_id")        
        .in_("zone_id", zone_ids)
        .execute()
    )
    player_ids = list({r["player_id"] for r in (stp.data or []) if r.get("player_id")})
    if not player_ids:
        return set()

    # 2) tags vigentes desde la view
    tags_res = (
        sb.table("v_player_current_tag")
        .select("player_id,player_tag")
        .in_("player_id", player_ids)
        .execute()
    )

    return {r["player_tag"] for r in (tags_res.data or []) if r.get("player_tag")}

def sb_upsert_players_if_missing(sb: Client, player_rows: List[Dict[str, Any]]) -> None:
    # Minimal insert: if nick exists we can keep unique; but safest is upsert by player_id.
    # Here we assume players are created/managed in Admin app.
    # For cron ingestion, we only ensure player_identity tags are present when possible.
    # We'll do nothing here for now (MVP). Hooks can be added later.
    return


def sb_get_known_player_ids_by_tag(sb: Client, tags: List[str]) -> Dict[str, str]:
    # Map player_tag -> player_id for active identities
    if not tags:
        return {}
    # Supabase PostgREST doesn't have IN for large easily; but for 30-50 it's fine.
    # We'll query in chunks to reduce URL size if needed.
    out: Dict[str, str] = {}
    chunk = 50
    for i in range(0, len(tags), chunk):
        sub = tags[i:i+chunk]
        res = sb.table("player_identity") \
            .select("player_id,player_tag") \
            .in_("player_tag", sub) \
            .is_("valid_to", "null") \
            .execute()
        for row in (res.data or []):
            out[row["player_tag"].upper()] = row["player_id"]
    return out


def sb_auto_create_missing_player_identities(sb: Client, tags: List[str], existing_mapping: Dict[str, str]) -> Dict[str, str]:
    """Create player_identity records for tags that don't exist yet."""
    if not tags:
        return existing_mapping
    
    tags_upper = {t.upper() for t in tags if t}
    missing_tags = {t for t in tags_upper if t not in existing_mapping}
    
    if not missing_tags:
        return existing_mapping
    
    # Create player and player_identity records for missing tags
    from uuid import uuid4
    new_mapping = dict(existing_mapping)
    
    for tag in sorted(missing_tags):
        try:
            player_id = str(uuid4())
            # Try to insert a new player
            sb.table("player").insert({"player_id": player_id, "nick": tag}).execute()
            # Create the player_identity record
            sb.table("player_identity").insert({
                "player_id": player_id,
                "player_tag": tag,
                "valid_from": datetime.now(timezone.utc).isoformat(),
            }).execute()
            new_mapping[tag] = player_id
            logging.info(f"Auto-created player_identity for tag: {tag}")
        except Exception as e:
            logging.warning(f"Failed to auto-create player_identity for tag {tag}: {e}")
    
    return new_mapping
    return out

def sb_get_battle(sb, battle_id: str, max_retries: int = 3):
    for attempt in range(max_retries):
        try:
            res = (
                sb.table("battle")
                .select("battle_id, needs_refresh, refresh_attempts")
                .eq("battle_id", battle_id)
                .limit(1)
                .execute()
            )
            row = res.data[0] if res.data else None

            if row is not None and not isinstance(row, dict):
                raise TypeError(f"sb_get_battle expected dict, got {type(row)}: {row!r}")

            return row
        except APIError as e:
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt  # Exponential backoff: 1, 2, 4 seconds
                logging.warning(f"API error getting battle {battle_id} (attempt {attempt + 1}/{max_retries}): {e}. Retrying in {wait_time}s...")
                time.sleep(wait_time)
            else:
                logging.error(f"Failed to get battle {battle_id} after {max_retries} attempts: {e}")
                raise


def sb_insert_battle_with_rounds(sb: Client, battle_row: Dict[str, Any],
                                rounds: List[Dict[str, Any]],
                                round_players: List[Dict[str, Any]], max_retries: int = 3) -> None:
    for attempt in range(max_retries):
        try:
            # Insert battle
            sb.table("battle").insert(battle_row).execute()

            # Insert rounds
            if rounds:
                sb.table("battle_round").insert(rounds).execute()

            # Insert round players
            if round_players:
                sb.table("battle_round_player").insert(round_players).execute()
            return
        except APIError as e:
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt
                logging.warning(f"API error inserting battle {battle_row.get('battle_id')} (attempt {attempt + 1}/{max_retries}): {e}. Retrying in {wait_time}s...")
                time.sleep(wait_time)
            else:
                logging.error(f"Failed to insert battle {battle_row.get('battle_id')} after {max_retries} attempts: {e}")
                raise


def sb_mark_battle_for_refresh(sb: Client, battle_id: str, reason: Dict[str, Any]) -> None:
    sb.table("battle").update({
        "sync_status": "INCOMPLETE",
        "needs_refresh": True,
        "data_quality": reason,
        "last_refresh_at": _now_utc().isoformat(),
    }).eq("battle_id", battle_id).execute()

def sb_delete_battle_children(sb: Client, battle_id: str) -> None:
    # Delete rounds for this battle; cascades to battle_round_player
    sb.table("battle_round").delete().eq("battle_id", battle_id).execute()


def sb_update_battle_repaired(sb: Client, battle_id: str, raw_payload: Dict[str, Any]) -> None:
    sb.table("battle").update({
        "sync_status": "REPAIRED",
        "needs_refresh": False,
        "data_quality": None,
        "raw_payload": raw_payload,
        "last_refresh_at": _now_utc().isoformat(),
    }).eq("battle_id", battle_id).execute()


def sb_update_battle_still_incomplete(sb: Client, battle_id: str, attempts: int, max_attempts: int) -> None:
    if attempts + 1 >= max_attempts:
        sb.table("battle").update({
            "sync_status": "GIVE_UP",
            "needs_refresh": False,
            "refresh_attempts": attempts + 1,
            "last_refresh_at": _now_utc().isoformat(),
        }).eq("battle_id", battle_id).execute()
    else:
        sb.table("battle").update({
            "sync_status": "INCOMPLETE",
            "needs_refresh": True,
            "refresh_attempts": attempts + 1,
            "last_refresh_at": _now_utc().isoformat(),
        }).eq("battle_id", battle_id).execute()


def sb_overwrite_battle_with_rounds(sb: Client, battle_id: str,
                                   raw_payload: Dict[str, Any],
                                   rounds_rows: List[Dict[str, Any]],
                                   round_players_rows: List[Dict[str, Any]]) -> None:
    # 1) delete children (rounds + players cascade)
    sb_delete_battle_children(sb, battle_id)

    # 2) insert fresh children
    if rounds_rows:
        sb.table("battle_round").insert(rounds_rows).execute()
    if round_players_rows:
        sb.table("battle_round_player").insert(round_players_rows).execute()

    # 3) mark repaired + store payload
    sb_update_battle_repaired(sb, battle_id, raw_payload)


# -----------------------------
# Daily Duel Auto-Linking Utilities
# -----------------------------
# Cache for admin user UUID (fetched once per sync run)
_admin_user_cache: Optional[str] = None


def get_cached_admin_user(sb: Client) -> Optional[str]:
    """
    Fetch the first admin app_user UUID (filter by role in ['SUPER_USER', 'SUPER_ADMIN'], order by created_at ASC).
    Cache result to avoid repeated queries during a sync run.
    """
    global _admin_user_cache
    if _admin_user_cache is not None:
        return _admin_user_cache
    
    try:
        res = sb.table("app_user") \
            .select("id") \
            .in_("role", ["SUPER_USER", "SUPER_ADMIN"]) \
            .order("created_at", desc=False) \
            .limit(1) \
            .execute()
        if res.data and len(res.data) > 0:
            _admin_user_cache = res.data[0]["id"]
            logging.info(f"Fetched admin user for auto-linking: {_admin_user_cache}")
            return _admin_user_cache
    except Exception as e:
        logging.error(f"Failed to fetch admin user: {e}")
    
    return None


def get_active_season(sb: Client) -> Optional[Dict[str, Any]]:
    """Fetch the active season with configuration."""
    try:
        res = sb.table("season") \
            .select("season_id,duel_start_date,duel_end_date,battle_cutoff_minutes,is_extreme_config_disabled") \
            .eq("status", "ACTIVE") \
            .limit(1) \
            .execute()
        if res.data and len(res.data) > 0:
            return res.data[0]
    except Exception as e:
        logging.error(f"Failed to fetch active season: {e}")
    
    return None


def convert_to_game_day(battle_time: datetime, season_config: Dict[str, Any]) -> date:
    """
    Convert battle_time to game day using cutoff logic.
    Game day boundary: 09:50 UTC (default: battle_cutoff_minutes = 600 = 10 hours)
    """
    cutoff_minutes = season_config.get("battle_cutoff_minutes", 600)
    cutoff_seconds = cutoff_minutes * 60
    
    # UTC time
    utc_time = battle_time if battle_time.tzinfo else battle_time.replace(tzinfo=timezone.utc)
    
    # Cutoff time for this day (09:50 UTC = 35400 seconds from midnight)
    day_start = datetime.combine(utc_time.date(), datetime.min.time(), tzinfo=timezone.utc)
    cutoff_time = day_start + timedelta(seconds=cutoff_seconds)
    
    # If battle is before cutoff, it belongs to previous day
    if utc_time < cutoff_time:
        return (utc_time - timedelta(days=1)).date()
    else:
        return utc_time.date()


def get_game_day_boundaries(battle_time: datetime, season_config: Dict[str, Any]) -> tuple[datetime, datetime]:
    """
    Get start and end of game day (both using cutoff logic).
    Returns (game_day_start_utc, game_day_end_utc)
    """
    cutoff_minutes = season_config.get("battle_cutoff_minutes", 600)
    cutoff_seconds = cutoff_minutes * 60
    
    # Get the game day
    game_day = convert_to_game_day(battle_time, season_config)
    
    # Game day starts at cutoff time of the day before
    day_start = datetime.combine(game_day, datetime.min.time(), tzinfo=timezone.utc)
    game_day_start = day_start + timedelta(seconds=cutoff_seconds)
    
    # Game day ends at cutoff time of current day
    game_day_end = datetime.combine(game_day + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)
    game_day_end = game_day_end + timedelta(seconds=cutoff_seconds)
    
    return game_day_start, game_day_end


def parse_season_datetime_utc(value: Any) -> Optional[datetime]:
    """Parse season datetime/date values to UTC-aware datetime."""
    if not value:
        return None

    if isinstance(value, datetime):
        return value.astimezone(timezone.utc) if value.tzinfo else value.replace(tzinfo=timezone.utc)

    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time(), tzinfo=timezone.utc)

    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return None

        # Handle explicit Z suffix used by ISO timestamps.
        if raw.endswith("Z"):
            raw = raw[:-1] + "+00:00"

        try:
            parsed = datetime.fromisoformat(raw)
        except ValueError:
            return None

        return parsed.astimezone(timezone.utc) if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)

    return None


def is_battle_within_duel_phase(battle_time: datetime, season_config: Dict[str, Any]) -> bool:
    """
    Verify battle's game day falls within [duel_start_date, duel_end_date].

    duel_start_date and duel_end_date are SQL DATE fields that represent named
    game days (not timestamps). They are compared directly as calendar dates
    without passing through convert_to_game_day — that function is for assigning
    a battle timestamp to a game day, not for interpreting date-type config fields.
    """
    duel_start_raw = season_config.get("duel_start_date")
    duel_start_dt = parse_season_datetime_utc(duel_start_raw)
    if not duel_start_dt:
        logging.warning("[DAILY_DUEL] Missing or invalid duel_start_date in active season config; skipping auto-link")
        return False

    battle_game_day = convert_to_game_day(battle_time, season_config)
    duel_start_game_day = duel_start_dt.date()  # treat as calendar game day, no cutoff conversion

    if battle_game_day < duel_start_game_day:
        logging.info(
            f"[DAILY_DUEL] Skipping auto-link (pre-season): "
            f"battle_game_day={battle_game_day}, duel_start_date={duel_start_game_day}"
        )
        return False

    duel_end_raw = season_config.get("duel_end_date")
    if duel_end_raw:
        duel_end_dt = parse_season_datetime_utc(duel_end_raw)
        if duel_end_dt:
            duel_end_game_day = duel_end_dt.date()
            if battle_game_day > duel_end_game_day:
                logging.info(
                    f"[DAILY_DUEL] Skipping auto-link (post-season): "
                    f"battle_game_day={battle_game_day}, duel_end_date={duel_end_game_day}"
                )
                return False

    return True


def get_player_zone(sb: Client, player_id: str, season_id: str) -> Optional[str]:
    """Fetch zone_id for player in given season."""
    try:
        # season_id is stored in season_zone, not in season_zone_team_player.
        season_zones = sb.table("season_zone") \
            .select("zone_id") \
            .eq("season_id", season_id) \
            .execute()

        zone_ids = [r["zone_id"] for r in (season_zones.data or []) if r.get("zone_id")]
        if not zone_ids:
            return None

        res = sb.table("season_zone_team_player") \
            .select("zone_id") \
            .eq("player_id", player_id) \
            .in_("zone_id", zone_ids) \
            .limit(1) \
            .execute()

        if res.data and len(res.data) > 0:
            return res.data[0].get("zone_id")
    except Exception as e:
        logging.warning(f"Failed to fetch zone for player {player_id}: {e}")
    
    return None


def find_existing_daily_match(sb: Client, player_id: str, game_day: date, season_id: str) -> Optional[Dict[str, Any]]:
    """
    Find existing scheduled_match for player/date with type='CW_DAILY'.
    Returns the match if found, None otherwise.
    """
    try:
        game_day_start = datetime.combine(game_day, datetime.min.time(), tzinfo=timezone.utc)
        res = sb.table("scheduled_match") \
            .select("scheduled_match_id,player_a_id,status,score_a,score_b") \
            .eq("player_a_id", player_id) \
            .eq("type", "CW_DAILY") \
            .eq("season_id", season_id) \
            .gte("scheduled_from", game_day_start.isoformat()) \
            .lt("scheduled_from", (game_day_start + timedelta(days=1)).isoformat()) \
            .limit(1) \
            .execute()
        if res.data and len(res.data) > 0:
            return res.data[0]
    except Exception as e:
        logging.error(f"Failed to find daily match for player {player_id}: {e}")
    
    return None


def calculate_daily_duel_result(sb: Client, battle_id: str, player_id: str) -> Optional[Dict[str, Any]]:
    """
    Calculate battle result for daily duel.
    Returns dict with: final_score_a, final_score_b, points_a, points_b
    """
    try:
        # Fetch TEAM rounds for this player - opponent result comes from opponent_crowns
        res = sb.table("battle_round_player") \
            .select("battle_round_id,player_id,side,crowns,opponent_crowns,battle_round!inner(battle_id)") \
            .eq("battle_round.battle_id", battle_id) \
            .eq("player_id", player_id) \
            .eq("side", "TEAM") \
            .execute()
        
        if not res.data or len(res.data) == 0:
            logging.warning(f"No round players found for battle {battle_id}")
            return None
        
        team_rounds = res.data

        if not team_rounds:
            logging.warning(f"Battle {battle_id} missing TEAM rounds for player {player_id}")
            return None
        
        # Count rounds won for each side (crowns > opponent_crowns)
        team_wins = 0
        opp_wins = 0
        
        for tr in team_rounds:
            player_crowns = tr.get("crowns", 0)
            opp_crowns = tr.get("opponent_crowns", 0)
            if player_crowns > opp_crowns:
                team_wins += 1
            elif opp_crowns > player_crowns:
                opp_wins += 1
        
        final_score_a = team_wins  # Our player's wins (TEAM side)
        final_score_b = opp_wins   # Opponent's wins
        
        # Map to points
        points_a, points_b = map_score_to_points(final_score_a, final_score_b)
        
        return {
            "final_score_a": final_score_a,
            "final_score_b": final_score_b,
            "points_a": points_a,
            "points_b": points_b
        }
    except Exception as e:
        logging.error(f"Failed to calculate result for battle {battle_id}: {e}")
    
    return None


def map_score_to_points(final_score_a: int, final_score_b: int) -> tuple[int, int]:
    """
    Map battle score to points using daily duel schema.
    Rules: 2-0=4-0, 2-1=3-1, 1-2=1-3, 0-2=0-4
    """
    if final_score_a == 2 and final_score_b == 0:
        return 4, 0
    elif final_score_a == 2 and final_score_b == 1:
        return 3, 1
    elif final_score_a == 1 and final_score_b == 2:
        return 1, 3
    elif final_score_a == 0 and final_score_b == 2:
        return 0, 4
    else:
        # Fallback for unexpected scores
        logging.warning(f"Unexpected score: {final_score_a}-{final_score_b}, defaulting to 0-0")
        return 0, 0


def create_daily_match_if_needed(sb: Client, player_id: str, battle_time: datetime, 
                                 season_id: str, season_config: Dict[str, Any]) -> Optional[str]:
    """
    Create scheduled_match for player if one doesn't exist for the game day.
    Returns scheduled_match_id (either created or existing).
    """
    try:
        game_day = convert_to_game_day(battle_time, season_config)
        
        # Check if match exists
        existing = find_existing_daily_match(sb, player_id, game_day, season_id)
        if existing:
            return existing["scheduled_match_id"]
        
        # Get zone
        zone_id = get_player_zone(sb, player_id, season_id)
        if not zone_id:
            logging.warning(f"Cannot create daily match: no zone found for player {player_id}")
            return None
        
        # Get game day boundaries
        game_day_start, game_day_end = get_game_day_boundaries(battle_time, season_config)
        
        # Create new scheduled_match
        from uuid import uuid4
        scheduled_match_id = str(uuid4())
        
        match_data = {
            "scheduled_match_id": scheduled_match_id,
            "season_id": season_id,
            "zone_id": zone_id,
            "player_a_id": player_id,
            "player_b_id": None,
            "type": "CW_DAILY",
            "stage": "CW_Duel_1v1",
            "best_of": 1,
            "status": "PENDING",
            "scheduled_from": game_day_start.isoformat(),
            "scheduled_to": game_day_end.isoformat(),
            "deadline_at": game_day_end.isoformat(),
        }
        
        sb.table("scheduled_match").insert(match_data).execute()
        logging.info(f"Created scheduled_match {scheduled_match_id} for player {player_id} on {game_day}")
        
        return scheduled_match_id
    except Exception as e:
        logging.error(f"Failed to create daily match for player {player_id}: {e}")
    
    return None


def link_battle_to_match(sb: Client, scheduled_match_id: str, battle_id: str, admin_user_id: str, verbose: bool = True) -> bool:
    """Create scheduled_match_battle_link record."""
    try:
        from uuid import uuid4
        link_id = str(uuid4())
        
        link_data = {
            "scheduled_match_battle_link_id": link_id,
            "scheduled_match_id": scheduled_match_id,
            "battle_id": battle_id,
            "linked_by_admin": admin_user_id,
        }
        
        sb.table("scheduled_match_battle_link").insert(link_data).execute()
        if verbose:
            logging.info(f"Linked battle {battle_id} to match {scheduled_match_id}")
        return True
    except Exception as e:
        logging.error(f"Failed to link battle {battle_id} to match {scheduled_match_id}: {e}")
    
    return False


def create_match_result(sb: Client, scheduled_match_id: str, result: Dict[str, Any], verbose: bool = True) -> bool:
    """Create scheduled_match_result record."""
    try:
        result_data = {
            "scheduled_match_id": scheduled_match_id,
            "final_score_a": result["final_score_a"],
            "final_score_b": result["final_score_b"],
            "points_a": result["points_a"],
            "points_b": result["points_b"],
            "decided_by": "ADMIN",
        }
        
        sb.table("scheduled_match_result").insert(result_data).execute()
        if verbose:
            logging.info(f"Created result for match {scheduled_match_id}: {result['final_score_a']}-{result['final_score_b']}")
        return True
    except Exception as e:
        logging.error(f"Failed to create result for match {scheduled_match_id}: {e}")
    
    return False


def update_match_with_scores(sb: Client, scheduled_match_id: str, final_score_a: int, final_score_b: int, verbose: bool = True) -> bool:
    """Update scheduled_match with scores and status."""
    try:
        sb.table("scheduled_match").update({
            "score_a": final_score_a,
            "score_b": final_score_b,
            "status": "OVERRIDDEN",
        }).eq("scheduled_match_id", scheduled_match_id).execute()
        return True
    except Exception as e:
        logging.error(f"Failed to update match {scheduled_match_id} with scores: {e}")
    
    return False


def is_daily_duel_battle(api_game_mode: str, api_battle_type: str) -> bool:
    """Check if a battle qualifies as a daily duel based on game mode and battle type."""
    return (api_game_mode == "CW_Duel_1v1" and 
            api_battle_type in ["riverRaceDuel", "riverRaceDuelColosseum"])


def process_daily_duel_battle(sb: Client, battle_id: str, battle_data: Dict[str, Any], 
                             tag_to_player_id: Dict[str, str], season_config: Dict[str, Any],
                             admin_user_id: str, verbose: bool = True) -> bool:
    """
    Main orchestration function for auto-linking daily duel battles.
    Returns True if processing succeeded, False otherwise.
    verbose: If False, suppresses intermediate log messages (for existing battle re-linking).
    """
    try:
        if verbose:
            logging.info(f"🎮 [DAILY_DUEL] Starting process_daily_duel_battle for battle_id={battle_id}, verbose={verbose}")
        
        # Verify this is a daily duel
        api_game_mode = battle_data.get("api_game_mode")
        api_battle_type = battle_data.get("api_battle_type")
        if verbose:
            logging.info(f"🎮 [DAILY_DUEL] Checking game mode: {api_game_mode}, battle type: {api_battle_type}")
        
        if not is_daily_duel_battle(api_game_mode, api_battle_type):
            if verbose:
                logging.warning(f"🎮 [DAILY_DUEL] Not a daily duel battle: {api_game_mode} / {api_battle_type}")
            return False
        
        if verbose:
            logging.info(f"🎮 [DAILY_DUEL] ✓ Battle type validated as daily duel")
        
        # Get season
        season_id = season_config.get("season_id")
        if not season_id:
            logging.error("🎮 [DAILY_DUEL] Cannot process daily duel: no active season")
            return False
        
        if verbose:
            logging.info(f"🎮 [DAILY_DUEL] Season ID: {season_id}")
        
        # Extract player from battle (TEAM side) and opponent payload fallback
        try:
            if verbose:
                logging.info(f"🎮 [DAILY_DUEL] Extracting player from battle_round_player...")
            res = sb.table("battle_round_player") \
            .select("player_id,opponent,battle_round!inner(battle_id)") \
                .eq("battle_round.battle_id", battle_id) \
                .eq("side", "TEAM") \
                .limit(1) \
                .execute()
            
            if not res.data or len(res.data) == 0:
                logging.warning(f"🎮 [DAILY_DUEL] Cannot find player for daily duel battle {battle_id}")
                return False
            
            team_row = res.data[0]
            player_id = team_row["player_id"]

            # Opponent may be unregistered; in that case use JSON payload stored in TEAM row
            opponent_payload = team_row.get("opponent") or []
            opponent_nick_from_payload = "Rival"
            opponent_tag_from_payload = None
            if isinstance(opponent_payload, list) and len(opponent_payload) > 0:
                first_opp = opponent_payload[0] or {}
                opponent_tag_from_payload = first_opp.get("tag")
                opponent_nick_from_payload = first_opp.get("name") or first_opp.get("tag") or "Rival"
        except Exception as e:
            logging.error(f"Failed to extract player from battle {battle_id}: {e}")
            return False
        
        # Parse battle time
        try:
            battle_time = parse_battle_time(battle_data.get("battle_time", ""))
        except Exception as e:
            logging.error(f"Failed to parse battle time for {battle_id}: {e}")
            return False

        # Guard: do not link battles outside the duel phase window.
        if not is_battle_within_duel_phase(battle_time, season_config):
            return False
        
        # Create match if needed
        scheduled_match_id = create_daily_match_if_needed(sb, player_id, battle_time, season_id, season_config)
        if not scheduled_match_id:
            logging.warning(f"Failed to create/find daily match for battle {battle_id}")
            return False
        
        # Link battle
        if not link_battle_to_match(sb, scheduled_match_id, battle_id, admin_user_id, verbose):
            if verbose:
                logging.warning(f"Failed to link battle {battle_id}")
            return False
        
        # Calculate result
        result = calculate_daily_duel_result(sb, battle_id, player_id)
        if not result:
            if verbose:
                logging.warning(f"Failed to calculate result for battle {battle_id}")
            return False
        
        # Create result record
        if not create_match_result(sb, scheduled_match_id, result, verbose):
            if verbose:
                logging.warning(f"Failed to create result for match {scheduled_match_id}")
            return False
        
        # Update match with scores
        if not update_match_with_scores(sb, scheduled_match_id, result["final_score_a"], result["final_score_b"], verbose):
            if verbose:
                logging.warning(f"Failed to update match scores for {scheduled_match_id}")
            return False
        
        # Send Discord notifications (supports unregistered opponents via opponent JSON payload)
        if verbose:
            logging.info(f"📢 Discord check for battle {battle_id} - DISCORD_ENABLED: {DISCORD_ENABLED}")
        if DISCORD_ENABLED:
            try:
                if verbose:
                    logging.info(f"📢 [Step 1] Fetching player info for player_id={player_id}")
                # Get player nick and discord_user_id
                player_res = sb.table("player").select("nick,discord_user_id").eq("player_id", player_id).execute()
                player_nick = player_res.data[0]["nick"] if player_res.data else f"Player_{player_id[:8]}"
                player_discord_id = player_res.data[0].get("discord_user_id") if player_res.data else None
                if verbose:
                    logging.info(f"📢 [Step 1] Got player nick: {player_nick}, discord_id: {player_discord_id}")                
                    logging.info(f"📢 [Step 2] Getting player zone for season_id={season_id}, player_id={player_id}")                    
                player_zone_id = get_player_zone(sb, player_id, season_id)
                if verbose:
                    logging.info(f"📢 [Step 2] Player zone_id: {player_zone_id}")

                # Opponent data from battle_round_player.opponent payload
                opponent_nick = opponent_nick_from_payload
                opponent_zone_id = None
                opponent_discord_id = None
                if verbose:
                    logging.info(f"📢 [Step 3] Opponent nick from payload: {opponent_nick}, opponent_tag: {opponent_tag_from_payload}")

                # If opponent is registered, try to fetch their discord ID
                if opponent_tag_from_payload:
                    try:
                        opp_res = sb.table("player_identity") \
                            .select("player_id") \
                            .eq("player_tag", opponent_tag_from_payload) \
                            .is_("valid_to", "null") \
                            .limit(1) \
                            .execute()
                        if opp_res.data:
                            opp_player_id = opp_res.data[0].get("player_id")
                            if opp_player_id:
                                opp_player_res = sb.table("player").select("discord_user_id").eq("player_id", opp_player_id).execute()
                                opponent_discord_id = opp_player_res.data[0].get("discord_user_id") if opp_player_res.data else None
                                if verbose:
                                    logging.info(f"📢 [Step 3] Opponent discord_id: {opponent_discord_id}")
                    except Exception as e:
                        if verbose:
                            logging.warning(f"📢 [Step 3] Could not fetch opponent discord ID: {e}")

                # If player has no zone configured for season, skip notification
                if not player_zone_id:
                    logging.warning(f"📢 Discord SKIPPED for battle {battle_id}: no zone configured for player {player_id} in season {season_id}")
                    return True
                if verbose:
                    logging.info(f"📢 [Step 4] Determining winner for battle {battle_id}")
                    logging.info(f"📢 [Step 4] Score: player={result['final_score_a']}, opponent={result['final_score_b']}")
                
                # Determine winner and format score
                if result["final_score_a"] > result["final_score_b"]:
                    # Player won
                    score_str = f"{result['final_score_a']}-{result['final_score_b']}"
                    winner_nick = player_nick
                    winner_zone_id = player_zone_id
                    winner_discord_id = player_discord_id
                    loser_nick = opponent_nick
                    loser_zone_id = opponent_zone_id
                    loser_discord_id = opponent_discord_id
                    if verbose:
                        logging.info(f"📢 [Step 4] Player won: {winner_nick} (zone={winner_zone_id}) beat {loser_nick} (zone={loser_zone_id})")
                else:
                    # Opponent won
                    score_str = f"{result['final_score_b']}-{result['final_score_a']}"
                    winner_nick = opponent_nick
                    winner_zone_id = opponent_zone_id
                    winner_discord_id = opponent_discord_id
                    loser_nick = player_nick
                    loser_zone_id = player_zone_id
                    loser_discord_id = player_discord_id
                    if verbose:
                        logging.info(f"📢 [Step 4] Opponent won: {winner_nick} beat {loser_nick}")

                if opponent_tag_from_payload and opponent_nick == "Rival":
                    opponent_nick = opponent_tag_from_payload
                    if verbose:
                        logging.info(f"📢 [Step 4] Updated opponent nick from tag: {opponent_nick}")
                    if result["final_score_a"] > result["final_score_b"]:
                        loser_nick = opponent_nick
                    else:
                        winner_nick = opponent_nick
                
                # Send notifications
                if verbose:
                    logging.info(f"📢 [Step 5] CALLING notify_duel_result")
                    logging.info(f"📢 [Step 5] Parameters: winner={winner_nick}, winner_zone={winner_zone_id}, loser={loser_nick}, loser_zone={loser_zone_id}, score={score_str}")
                notify_duel_result(
                    winner_nick=winner_nick,
                    loser_nick=loser_nick,
                    score=score_str,
                    winner_zone_id=winner_zone_id,
                    loser_zone_id=loser_zone_id,
                    supabase_client=sb,
                    winner_discord_id=winner_discord_id,
                    loser_discord_id=loser_discord_id
                )                
                logging.info(f"📢 [Step 5] SUCCESS: notify_duel_result completed for battle {battle_id}")
            except Exception as e:
                logging.error(f"📢 ❌ Discord ERROR for battle {battle_id}: {e}", exc_info=True)
        else:
            if verbose:
                logging.info(f"Discord notification skipped for battle {battle_id}: DISCORD_ENABLED=False")
        
        if verbose:
            logging.info(f"Successfully auto-linked daily duel battle {battle_id}")
        return True
    except Exception as e:
        logging.error(f"Error in process_daily_duel_battle for {battle_id}: {e}", exc_info=True)
        return False

# -----------------------------
# Transform battlelog -> DB rows
# -----------------------------
def to_battle_rows(
    b: Dict[str, Any],
    battle_id: str,
    card_cache: Dict[int, Dict[str, Any]],
    pending_cards: Dict[int, Dict[str, Any]],
    tag_to_player_id: Optional[Dict[str, str]] = None,
) -> Tuple[Dict[str, Any], List[Dict[str, Any]], List[Dict[str, Any]]]:
    bt = parse_battle_time(b["battleTime"])
    battle_type = b.get("type", "unknown")
    game_mode = (b.get("gameMode") or {}).get("name") or (b.get("gameMode") or {}).get("id") or "unknown"

    team_size = detect_team_size(b)
    round_count = detect_round_count(b)

    battle_row = {
        "battle_id": battle_id,
        "battle_time": bt.isoformat(),
        "api_battle_type": battle_type,
        "api_game_mode": game_mode,
        "team_size": team_size,
        "round_count": round_count,
        "sync_status": "OK",
        "needs_refresh": False,
        "refresh_attempts": 0,
        "raw_payload": b,
    }

    rounds_rows: List[Dict[str, Any]] = []
    round_players_rows: List[Dict[str, Any]] = []

    team_players = b.get("team") or []
    opp_players = b.get("opponent") or []

    # Duel detection: in your data, rounds are inside each player object.
    # If at least one player has a "rounds" list, we treat as duel-style.
    def _has_player_rounds(players: List[Dict[str, Any]]) -> bool:
        for p in players:
            r = p.get("rounds")
            if isinstance(r, list) and len(r) > 0:
                return True
        return False

    is_duel = _has_player_rounds(team_players) or _has_player_rounds(opp_players)

    if is_duel:
        # Build round rows 1..round_count and extract per-player per-round cards/crowns
        for round_no in range(1, round_count + 1):
            br_id = str(uuid4_like())
            rounds_rows.append({
                "battle_round_id": br_id,
                "battle_id": battle_id,
                "round_no": round_no,
            })

            # For each side, for each player, take that round index if exists
            round_idx = round_no - 1

            for p in team_players:
                prounds = p.get("rounds") or []
                r = prounds[round_idx] if isinstance(prounds, list) and len(prounds) > round_idx else None
                cards = (r or {}).get("cards") or []
                crowns = (r or {}).get("crowns")
                round_players_rows.append(
                    make_round_player_row(br_id, p, "TEAM", card_cache, pending_cards, opponents=opp_players, tag_to_player_id=tag_to_player_id, cards_override=cards, crowns_override=crowns, round_no=round_no)
                )

            for p in opp_players:
                prounds = p.get("rounds") or []
                r = prounds[round_idx] if isinstance(prounds, list) and len(prounds) > round_idx else None
                cards = (r or {}).get("cards") or []
                crowns = (r or {}).get("crowns")
                round_players_rows.append(
                    make_round_player_row(br_id, p, "OPPONENT", card_cache, pending_cards, opponents=team_players, tag_to_player_id=tag_to_player_id, cards_override=cards, crowns_override=crowns, round_no=round_no)
                )

    else:
        # Normal battle: single round, use player-level cards/crowns
        br_id = str(uuid4_like())
        rounds_rows.append({
            "battle_round_id": br_id,
            "battle_id": battle_id,
            "round_no": 1,
        })

        for p in team_players:
            round_players_rows.append(make_round_player_row(br_id, p, "TEAM", card_cache, pending_cards, opponents=opp_players, tag_to_player_id=tag_to_player_id))

        for p in opp_players:
            round_players_rows.append(make_round_player_row(br_id, p, "OPPONENT", card_cache, pending_cards, opponents=team_players, tag_to_player_id=tag_to_player_id))

    return battle_row, rounds_rows, round_players_rows

def uuid4_like() -> str:
    # Avoid importing uuid.UUID for speed; we just need a random-ish id for child rows.
    import uuid
    return str(uuid.uuid4())


def make_round_player_row(
    battle_round_id: str,
    p: Dict[str, Any],
    side: str,
    card_cache: Dict[int, Dict[str, Any]],
    pending_cards: Dict[int, Dict[str, Any]],
    opponents: Optional[List[Dict[str, Any]]] = None,
    tag_to_player_id: Optional[Dict[str, str]] = None,
    cards_override: Optional[List[Dict[str, Any]]] = None,
    crowns_override: Optional[Any] = None,
    round_no: Optional[int] = None,
) -> Dict[str, Any]:
    cards = cards_override if cards_override is not None else (p.get("cards") or [])

    # 👇 registrar cartas nuevas en cache + batch pending
    queue_missing_cards(cards, card_cache, pending_cards)

    deck_cards = [
        {
            "name": c.get("name"),
            "id": c.get("id"),
            "level": c.get("level"),
            "evolution_level": int(c.get("evolutionLevel") or 0),
        }
        for c in cards
    ]

    crowns_val = crowns_override if crowns_override is not None else p.get("crowns")

    # Process opponent information - only for unregistered opponents
    opponent_data = None
    opponent_crowns = None
    if opponents and len(opponents) > 0:
        if tag_to_player_id is None:
            tag_to_player_id = {}
        
        # Store info for opponents that are NOT registered (not in tag_to_player_id)
        opponent_list = []
        for opp in opponents:
            opp_tag = (opp.get("tag") or "").upper()
            # Only add to opponent field if this opponent is NOT registered
            if opp_tag not in tag_to_player_id:
                # Get cards from the specific round if round_no is provided (duel battles)
                opp_cards = []
                opp_crowns = 0
                
                if round_no is not None:
                    # Duel battle: get cards and crowns from opponent.rounds
                    opp_rounds = opp.get("rounds") or []
                    round_idx = round_no - 1
                    if isinstance(opp_rounds, list) and len(opp_rounds) > round_idx:
                        round_data = opp_rounds[round_idx] or {}
                        opp_cards = round_data.get("cards") or []
                        opp_crowns = round_data.get("crowns") or 0
                else:
                    # Normal battle: get cards from player level
                    opp_cards = opp.get("cards") or []
                    opp_crowns = opp.get("crowns") or 0
                
                queue_missing_cards(opp_cards, card_cache, pending_cards)
                
                opponent_list.append({
                    "tag": opp.get("tag"),
                    "name": opp.get("name"),
                    "deck_cards": [
                        {
                            "name": c.get("name"),
                            "id": c.get("id"),
                            "level": c.get("level"),
                            "evolution_level": int(c.get("evolutionLevel") or 0),
                        }
                        for c in opp_cards
                    ]
                })
                
                # Store opponent_crowns (sum of all unregistered opponents' crowns)
                if opponent_crowns is None:
                    opponent_crowns = 0
                opponent_crowns += int(opp_crowns)
        
        if opponent_list:
            opponent_data = opponent_list

    result = {
        "battle_round_id": battle_round_id,
        "player_id": None,
        "side": side,
        "crowns": int(crowns_val or 0),
        "deck_cards": deck_cards,
        "elixir_avg": p.get("elixirAverage"),
        "opponent": opponent_data,
        "_player_tag": p.get("tag"),
    }
    
    # Add opponent_crowns only if we have opponent data
    if opponent_crowns is not None:
        result["opponent_crowns"] = opponent_crowns
    
    return result

def assign_player_ids(round_players_rows: List[Dict[str, Any]], tag_to_player_id: Dict[str, str]) -> List[Dict[str, Any]]:
    out = []
    missing_tags = []
    for r in round_players_rows:
        tag = (r.get("_player_tag") or "").upper()
        pid = tag_to_player_id.get(tag)
        if not pid:
            missing_tags.append(tag)
            continue
        r2 = dict(r)
        r2["player_id"] = pid
        r2.pop("_player_tag", None)
        out.append(r2)
    if missing_tags:
        logging.warning(f"Skipped round_player rows due to missing player_identity mapping for tags: {sorted(set(missing_tags))}")
    return out


# -----------------------------
# Main cron flow
# -----------------------------
CYCLE_INTERVAL_SECONDS = 30 * 60
_standings_module: Optional[Any] = None


def _load_standings_module() -> Any:
    global _standings_module

    if _standings_module is not None:
        return _standings_module

    standings_path = Path(__file__).resolve().parents[1] / "standings-cron" / "standings_cron.py"
    spec = importlib.util.spec_from_file_location("liga_standings_cron", standings_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load standings cron module from {standings_path}")

    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    _standings_module = module
    return module


def run_standings_once_from_sync(sync_cfg: Config) -> Dict[str, int]:
    standings_module = _load_standings_module()

    previous_url = os.environ.get("SUPABASE_URL")
    previous_key = os.environ.get("SUPABASE_KEY")

    os.environ["SUPABASE_URL"] = sync_cfg.supabase_url
    os.environ["SUPABASE_KEY"] = sync_cfg.supabase_key

    try:
        standings_cfg = standings_module.load_config()
        standings_sb = create_client(standings_cfg.supabase_url, standings_cfg.supabase_key)
        return standings_module.run_standings_once(standings_cfg, standings_sb)
    finally:
        if previous_url is None:
            os.environ.pop("SUPABASE_URL", None)
        else:
            os.environ["SUPABASE_URL"] = previous_url

        if previous_key is None:
            os.environ.pop("SUPABASE_KEY", None)
        else:
            os.environ["SUPABASE_KEY"] = previous_key


def run_sync_once(cfg: Config, sb: Client, api: 'SupercellApi', card_cache: Dict[int, Dict[str, Any]]) -> bool:
    """Run a single sync cycle."""
    global _admin_user_cache
    
    logging.info("=== CRON START: Supercell sync ===")

    # 0) temporada actual
    season_id = get_current_season_id(sb)
    season_player_tags  = get_season_participant_tags(sb, season_id)
    logging.info(f"Season participants (tags): {len(season_player_tags)}")
    
    # 0a) Get active season config + admin user for daily duel auto-linking
    season_config = get_active_season(sb)
    if not season_config:
        logging.error("Cannot proceed: no active season configuration found")
        return False
    
    admin_user_id = get_cached_admin_user(sb)
    if not admin_user_id:
        logging.warning("Cannot auto-link daily duels: admin user not found")
    
    # Reset cache for this sync run
    _admin_user_cache = None

    # 1) Repair queue primero (OK)
    run_repairs(sb, api, cfg, card_cache)

    # 2) Sync battlelogs SOLO para season participants
    total_new = 0
    total_skipped = 0
    total_incomplete = 0
    total_daily_linked = 0
    
    for tag in sorted(season_player_tags):
        try:
            new, skipped, incomplete, daily_linked = sync_player_battlelog(
                sb, api, cfg, tag, card_cache, season_player_tags, season_config, admin_user_id
            )
            total_new += new
            total_skipped += skipped
            total_incomplete += incomplete
            total_daily_linked += daily_linked
        except APIError as e:
            logging.error(f"API error syncing battlelog for {tag}: {e}. Continuing with next player...")
        except Exception as e:
            logging.error(f"Unexpected error syncing battlelog for {tag}: {e}", exc_info=True)
    
    logging.info(f"=== CRON COMPLETE: Sync finished - New: {total_new}, Skipped: {total_skipped}, Incomplete: {total_incomplete}, Daily Linked: {total_daily_linked} ===")
    return True


def main() -> None:
    cfg = load_config()
    setup_logging(cfg)

    os.makedirs(cfg.cache_dir, exist_ok=True)
    import socket
    socket.setdefaulttimeout(30)
    socket.has_ipv6 = False
    sb = create_client(cfg.supabase_url, cfg.supabase_key)
    api = SupercellApi(cfg.supercell_token)

    card_cache = load_card_cache(sb)
    
    logging.info("Starting continuous sync - running sync + standings every 30 minutes")
    
    while True:
        cycle_started_at = time.perf_counter()
        try:
            logging.info("=== CRON CYCLE START ===")

            sync_started_at = time.perf_counter()
            logging.info("--- PHASE START: sync ---")
            sync_completed = run_sync_once(cfg, sb, api, card_cache)
            sync_duration = time.perf_counter() - sync_started_at
            logging.info(f"--- PHASE END: sync ({sync_duration:.2f}s) ---")

            # Reload card cache after each sync
            card_cache = load_card_cache(sb)

            if sync_completed:
                try:
                    standings_started_at = time.perf_counter()
                    logging.info("--- PHASE START: standings ---")
                    standings_result = run_standings_once_from_sync(cfg)
                    standings_duration = time.perf_counter() - standings_started_at
                    logging.info(
                        "--- PHASE END: standings (%.2fs) - Seasons: %s, Ledger rows: %s, Snapshot rows: %s ---",
                        standings_duration,
                        standings_result.get("season_count", 0),
                        standings_result.get("ledger_rows", 0),
                        standings_result.get("snapshot_rows", 0),
                    )
                except Exception as standings_error:
                    logging.error(f"Standings phase failed: {standings_error}", exc_info=True)
            else:
                logging.warning("Skipping standings phase because sync did not complete successfully")

            cycle_duration = time.perf_counter() - cycle_started_at
            logging.info(f"=== CRON CYCLE COMPLETE ({cycle_duration:.2f}s) ===")
            
            logging.info("Waiting 30 minutes before next cycle...")
            time.sleep(CYCLE_INTERVAL_SECONDS)
        except KeyboardInterrupt:
            logging.info("Sync stopped by user")
            break
        except Exception as e:
            logging.error(f"Fatal error during sync cycle: {e}", exc_info=True)
            logging.warning("Skipping standings for this cycle because sync did not complete")
            logging.info("Waiting 30 minutes before retry...")
            time.sleep(CYCLE_INTERVAL_SECONDS)


def run_repairs(sb: Client, api: SupercellApi, cfg: Config, card_cache: Dict[int, Dict[str, Any]]) -> None:
    # Load battles that need refresh (bounded)
    res = sb.table("battle") \
        .select("battle_id,raw_payload,refresh_attempts") \
        .eq("needs_refresh", True) \
        .order("last_refresh_at", desc=False) \
        .limit(cfg.repair_batch_size) \
        .execute()

    rows = res.data or []
    if not rows:
        logging.info("Repair queue is empty.")
        return

    logging.info(f"Repairing {len(rows)} battles from refresh queue...")

    for b in rows:
        battle_id = b["battle_id"]
        attempts = int(b.get("refresh_attempts") or 0)
        if attempts >= cfg.repair_max_attempts:
            logging.warning(f"Battle {battle_id} reached max attempts; setting GIVE_UP.")
            sb.table("battle").update({
                "sync_status": "GIVE_UP",
                "needs_refresh": False,
                "last_refresh_at": _now_utc().isoformat(),
            }).eq("battle_id", battle_id).execute()
            continue

        # NOTE: Supercell does not offer "get battle by id" endpoint.
        # The only way to "refresh" is to re-fetch battlelogs of involved players and see if now it contains more info.
        # Since we stored raw_payload, we can re-check if incomplete, but to fix missing cards we need to re-ingest from player battlelogs.
        # Minimal approach here: just mark an attempt and let next per-player sync overwrite by detecting a newer payload.
        sb.table("battle").update({
            "sync_status": "REPAIR_QUEUED",
            "refresh_attempts": attempts + 1,
            "last_refresh_at": _now_utc().isoformat(),
        }).eq("battle_id", battle_id).execute()

    logging.info("Repair marking complete. (Actual repair happens during player battlelog re-sync)")


def sync_player_battlelog(sb: Client, api: SupercellApi, cfg: Config, player_tag: str, card_cache: Dict[int, Dict[str, Any]], season_player_tags: Optional[List[str]] = None, season_config: Optional[Dict[str, Any]] = None, admin_user_id: Optional[str] = None) -> Tuple[int, int, int, int]:
    cache_path = os.path.join(cfg.cache_dir, f"battlelog_{player_tag.replace('#','')}.json")
    data = load_cache(cache_path, cfg.cache_ttl_battlelog_min)
    pending_cards: Dict[int, Dict[str, Any]] = {}

    if data is None:
        logging.info(f"Fetching battlelog for player {player_tag}...")
        battles = api.get_player_battlelog(player_tag)
        save_cache(cache_path, {"items": battles})
    else:
        battles = data.get("items") or []
        logging.info(f"Using cached battlelog for {player_tag} ({len(battles)} battles)")

    inserted = 0
    skipped = 0
    marked_incomplete = 0
    daily_linked = 0

    # Collect all tags involved for mapping to player_id
    all_tags = []
    for b in battles:
        all_tags.extend(extract_player_tags_from_battle(b))
    
    # Only query/create identities for season participants
    if season_player_tags is None:
        season_player_tags = []
    season_tags_upper = {t.upper() for t in season_player_tags if t}
    tags_to_map = list({t.upper() for t in all_tags if t and t.upper() in season_tags_upper})
    
    tag_to_player_id = sb_get_known_player_ids_by_tag(sb, tags_to_map)
    # Auto-create missing player identities ONLY for season participants
    tag_to_player_id = sb_auto_create_missing_player_identities(sb, tags_to_map, tag_to_player_id)

    for b in battles:
        try:
            # Filter out types you don't want
            btype = b.get("type")
            if btype in ("pathOfLegend", "boatBattle", "PvP", "trail"):
                # Silently skip unwanted battle types
                skipped += 1
                continue

            bt = parse_battle_time(b["battleTime"])
            battle_type = b.get("type", "unknown")
            game_mode = (b.get("gameMode") or {}).get("name") or (b.get("gameMode") or {}).get("id") or "unknown"
            tags = extract_player_tags_from_battle(b)
            if not tags:
                # Silently skip battles without player tags
                skipped += 1
                continue

            battle_id = stable_battle_id(bt, tags, game_mode, battle_type)

            existing = sb_get_battle(sb, battle_id)
        except (APIError, Exception) as e:
            logging.error(f"Error processing battle for player {player_tag}: {e}")
            skipped += 1
            continue
        incomplete = is_incomplete_deck(b)

        if existing is None:
            # Create battle + rounds
            battle_row, rounds_rows, round_players_rows = to_battle_rows(b, battle_id, card_cache, pending_cards, tag_to_player_id)

            if incomplete:
                battle_row["sync_status"] = "INCOMPLETE"
                battle_row["needs_refresh"] = True
                battle_row["data_quality"] = {"missing_cards": True, "reason": "deck_cards_count_not_8"}
                marked_incomplete += 1

            # Assign player_id FK
            round_players_rows2 = assign_player_ids(round_players_rows, tag_to_player_id)
            # If we couldn't map all players, we skip inserting those rows; if none, skip battle insert
            if not round_players_rows2:
                # Silently skip battles that can't be mapped to player_id
                skipped += 1
                continue

            # Remove None player_id (should be gone)
            for rp in round_players_rows2:
                if rp.get("player_id") is None:
                    raise RuntimeError("player_id mapping failed unexpectedly")

            sb_insert_battle_with_rounds(sb, battle_row, rounds_rows, round_players_rows2)
            inserted += 1
            
            # Log successful battle insertion
            player_tag_display = tags[0] if tags else "Unknown"
            logging.info(f"{Fore.GREEN}✓ Battle recorded: {player_tag_display} | {game_mode} | {battle_type}{Style.RESET_ALL}")
            
            # Try to auto-link as daily duel if applicable
            if season_config and admin_user_id and not incomplete:
                api_game_mode = battle_row.get("api_game_mode")
                api_battle_type = battle_row.get("api_battle_type")
                if is_daily_duel_battle(api_game_mode, api_battle_type):
                    logging.debug(f"Attempting auto-link for NEW battle {battle_id}")
                    battle_data = {
                        "api_game_mode": api_game_mode,
                        "api_battle_type": api_battle_type,
                        "battle_time": battle_row.get("battle_time"),
                    }
                    if process_daily_duel_battle(sb, battle_id, battle_data, tag_to_player_id, season_config, admin_user_id):
                        daily_linked += 1
        else:
            # Battle exists.
            # Rule: do NOT touch existing battles, EXCEPT the explicit repair flow.
            needs_refresh = bool(existing.get("needs_refresh"))
            attempts = int(existing.get("refresh_attempts") or 0)

            if needs_refresh:
                if not incomplete:
                    # Payload is now complete -> overwrite children and mark REPAIRED
                    logging.info(f"Repairing battle by overwrite (now complete): {battle_id}")

                    battle_row, rounds_rows, round_players_rows = to_battle_rows(b, battle_id, card_cache, pending_cards, tag_to_player_id)

                    # Map tags -> player_id (FK required)
                    round_players_rows2 = assign_player_ids(round_players_rows, tag_to_player_id)
                    if not round_players_rows2:
                        logging.warning(f"Repair skipped for {battle_id}: cannot map tags to player_id (player_identity missing).")
                        # keep it in queue, count as still incomplete attempt
                        sb_update_battle_still_incomplete(sb, battle_id, attempts, cfg.repair_max_attempts)
                        marked_incomplete += 1
                    else:
                        sb_overwrite_battle_with_rounds(sb, battle_id, b, rounds_rows, round_players_rows2)
                else:
                    # Still incomplete -> increase attempts / maybe GIVE_UP
                    logging.info(f"Battle still incomplete, keeping in repair queue: {battle_id}")
                    sb_update_battle_still_incomplete(sb, battle_id, attempts, cfg.repair_max_attempts)
                    marked_incomplete += 1

            else:
                # Normal existing battle path (no changes)
                if incomplete:
                    logging.info(f"Battle exists but appears incomplete; marking for refresh: {battle_id}")
                    sb_mark_battle_for_refresh(sb, battle_id, {"missing_cards": True, "reason": "re-detected_incomplete"})
                    marked_incomplete += 1
                else:
                    # Check if this existing battle should be linked as daily duel
                    if season_config and admin_user_id and is_daily_duel_battle(game_mode, battle_type):
                        # Check if link already exists
                        try:
                            link_check = sb.table("scheduled_match_battle_link") \
                                .select("scheduled_match_battle_link_id") \
                                .eq("battle_id", battle_id) \
                                .limit(1) \
                                .execute()
                            
                            if not link_check.data or len(link_check.data) == 0:
                                # No link exists - try to create it (without notification)
                                logging.info(f"Attempting auto-link for EXISTING battle {battle_id} (Discord will be disabled)")
                                battle_data = {
                                    "api_game_mode": game_mode,
                                    "api_battle_type": battle_type,
                                    "battle_time": bt.isoformat(),
                                }
                                
                                # Temporarily disable Discord for re-sync to avoid duplicate notifications
                                global DISCORD_ENABLED
                                original_discord_state = DISCORD_ENABLED
                                DISCORD_ENABLED = False
                                
                                try:
                                    if process_daily_duel_battle(sb, battle_id, battle_data, tag_to_player_id, season_config, admin_user_id, verbose=False):
                                        daily_linked += 1
                                        logging.info(f"{Fore.GREEN}✓ Linked existing battle to daily duel: {battle_id}{Style.RESET_ALL}")
                                finally:
                                    DISCORD_ENABLED = original_discord_state
                        except Exception as e:
                            logging.warning(f"Failed to check/link existing battle {battle_id}: {e}")

            skipped += 1
    inserted_cards = flush_pending_cards(sb, pending_cards)
    if inserted_cards:
        logging.info(f"Inserted/Upserted new cards: {inserted_cards}")
    return inserted, skipped, marked_incomplete, daily_linked


if __name__ == "__main__":
    main()
