import os
import json
import time
import hashlib
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

import requests
from dotenv import load_dotenv
from supabase import create_client, Client
from postgrest.exceptions import APIError


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
        cache_ttl_battlelog_min=int(os.environ.get("CACHE_TTL_BATTLELOG_MIN", "60")),
        repair_max_attempts=int(os.environ.get("REPAIR_MAX_ATTEMPTS", "5")),
        repair_batch_size=int(os.environ.get("REPAIR_BATCH_SIZE", "25")),
        log_file=os.environ.get("LOG_FILE", "./logs/cron.log"),
        log_level=os.environ.get("LOG_LEVEL", "INFO"),
    )


# -----------------------------
# Logging
# -----------------------------
def setup_logging(cfg: Config) -> None:
    os.makedirs(os.path.dirname(cfg.log_file), exist_ok=True)
    level = getattr(logging, cfg.log_level.upper(), logging.INFO)

    logging.basicConfig(
        level=level,
        format="%(asctime)s | %(levelname)s | %(message)s",
        handlers=[
            logging.FileHandler(cfg.log_file, encoding="utf-8"),
            logging.StreamHandler(),
        ],
    )


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
    # Supercell battleTime format like "20201219T101010.000Z"
    # We'll support both with/without milliseconds.
    try:
        return datetime.strptime(s, "%Y%m%dT%H%M%S.%fZ").replace(tzinfo=timezone.utc)
    except ValueError:
        return datetime.strptime(s, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc)


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
def run_sync_once(cfg: Config, sb: Client, api: 'SupercellApi', card_cache: Dict[int, Dict[str, Any]]) -> None:
    """Run a single sync cycle."""
    logging.info("=== CRON START: Supercell sync ===")

    # 0) temporada actual    
    season_id = get_current_season_id(sb)
    season_player_tags  = get_season_participant_tags(sb, season_id)
    logging.info(f"Season participants (tags): {len(season_player_tags )}")

    # 1) Repair queue primero (OK)
    run_repairs(sb, api, cfg, card_cache)

    # 2) Sync battlelogs SOLO para season participants
    total_new = 0
    total_skipped = 0
    total_incomplete = 0
    for tag in sorted(season_player_tags):
        try:
            new, skipped, incomplete = sync_player_battlelog(sb, api, cfg, tag, card_cache, season_player_tags)
            total_new += new
            total_skipped += skipped
            total_incomplete += incomplete
        except APIError as e:
            logging.error(f"API error syncing battlelog for {tag}: {e}. Continuing with next player...")
        except Exception as e:
            logging.error(f"Unexpected error syncing battlelog for {tag}: {e}", exc_info=True)
    
    logging.info(f"=== CRON COMPLETE: Sync finished - New: {total_new}, Skipped: {total_skipped}, Incomplete: {total_incomplete} ===")


def main() -> None:
    cfg = load_config()
    setup_logging(cfg)

    os.makedirs(cfg.cache_dir, exist_ok=True)
    import socket
    socket.setdefaulttimeout(30)
    socket.has_ipv6 = False
    logging.info(f"SUPABASE_URL repr: {repr(os.getenv('SUPABASE_URL'))}")
    logging.info(f"SUPABASE_KEY present: {bool(os.getenv('SUPABASE_SERVICE_ROLE_KEY'))}")

    logging.info(f"SUPABASE_URL2 repr: {repr(cfg.supabase_url)}")
    logging.info(f"SUPABASE_KEY2 present: {bool(cfg.supabase_key)}")

    sb = create_client(cfg.supabase_url, cfg.supabase_key)
    api = SupercellApi(cfg.supercell_token)

    card_cache = load_card_cache(sb)
    
    logging.info("Starting continuous sync - running every 30 minutes")
    
    while True:
        try:
            run_sync_once(cfg, sb, api, card_cache)
            # Reload card cache after each sync
            card_cache = load_card_cache(sb)
            
            logging.info("Waiting 30 minutes before next sync...")
            time.sleep(30 * 60)  # Sleep for 30 minutes
        except KeyboardInterrupt:
            logging.info("Sync stopped by user")
            break
        except Exception as e:
            logging.error(f"Error during sync: {e}", exc_info=True)
            logging.info("Waiting 30 minutes before retry...")
            time.sleep(30 * 60)


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


def sync_player_battlelog(sb: Client, api: SupercellApi, cfg: Config, player_tag: str, card_cache: Dict[int, Dict[str, Any]], season_player_tags: Optional[List[str]] = None) -> Tuple[int, int, int]:
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
                logging.info(f"Skipped battle because of type: {btype}")
                skipped += 1
                continue

            bt = parse_battle_time(b["battleTime"])
            battle_type = b.get("type", "unknown")
            game_mode = (b.get("gameMode") or {}).get("name") or (b.get("gameMode") or {}).get("id") or "unknown"
            tags = extract_player_tags_from_battle(b)
            if not tags:
                logging.warning("Skipped battle because no player tags were found.")
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
                logging.warning(f"Skipped battle insert {battle_id} because no round player rows could be mapped to player_id.")
                skipped += 1
                continue

            # Remove None player_id (should be gone)
            for rp in round_players_rows2:
                if rp.get("player_id") is None:
                    raise RuntimeError("player_id mapping failed unexpectedly")

            sb_insert_battle_with_rounds(sb, battle_row, rounds_rows, round_players_rows2)
            inserted += 1
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

            skipped += 1
    inserted_cards = flush_pending_cards(sb, pending_cards)
    if inserted_cards:
        logging.info(f"Inserted/Upserted new cards: {inserted_cards}")
    return inserted, skipped, marked_incomplete


if __name__ == "__main__":
    main()
