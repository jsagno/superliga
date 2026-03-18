"""
Discord Notifications Module for Daily Duel Results

Handles all Discord integration:
- Loading zone webhook URLs from database
- Selecting and formatting random Spanish messages
- Posting to Discord with retry logic
- Error handling and logging
"""

import time
import logging
import re
import requests
from typing import Optional, List
from discord_messages import get_random_win_message, get_random_loss_message, format_message

logger = logging.getLogger(__name__)

# Cache for webhook URLs (zone_id -> webhook_url)
# Will be populated from database on first use
WEBHOOK_CACHE = {}
WEBHOOK_CACHE_TIMESTAMP = 0
WEBHOOK_CACHE_TTL = 300  # Refresh cache every 5 minutes


def normalize_discord_user_id(discord_user_id: Optional[str]) -> Optional[str]:
    """Return a clean numeric Discord user ID or None if invalid."""
    if not discord_user_id:
        return None

    value = str(discord_user_id).strip()
    # Accept raw IDs and mention-like values such as <@123...> or <@!123...>
    match = re.search(r"(\d{17,20})", value)
    return match.group(1) if match else None


def to_discord_mention(discord_user_id: Optional[str], fallback_nick: str) -> str:
    """Build a Discord mention when ID is valid; otherwise fallback to nick."""
    clean_id = normalize_discord_user_id(discord_user_id)
    return f"<@{clean_id}>" if clean_id else f"**{fallback_nick}**"


def refresh_webhook_cache(supabase_client):
    """
    Load all active zone Discord webhooks from database.
    
    Args:
        supabase_client: Supabase client instance
        
    Returns:
        Dict mapping zone_id to webhook_url
    """
    global WEBHOOK_CACHE, WEBHOOK_CACHE_TIMESTAMP
    
    try:
        response = supabase_client.table("zone_discord_webhook").select(
            "zone_id,webhook_url"
        ).eq("is_active", True).execute()
        
        # Build cache dict
        WEBHOOK_CACHE = {}
        for row in response.data:
            WEBHOOK_CACHE[row["zone_id"]] = row["webhook_url"]
        
        WEBHOOK_CACHE_TIMESTAMP = time.time()
        logger.info(f"Discord webhook cache refreshed: {len(WEBHOOK_CACHE)} active webhooks")
        return WEBHOOK_CACHE
        
    except Exception as e:
        logger.error(f"Failed to refresh webhook cache: {e}", exc_info=True)
        return {}


def get_webhook_url(zone_id: str, supabase_client) -> Optional[str]:
    """
    Get Discord webhook URL for a zone.
    Uses cache, refreshes if stale.
    
    Args:
        zone_id: UUID of the season_zone
        supabase_client: Supabase client instance
        
    Returns:
        Webhook URL string or None if not configured
    """
    global WEBHOOK_CACHE, WEBHOOK_CACHE_TIMESTAMP
    
    logger.info(f"📢 [WEBHOOK] get_webhook_url - Fetching webhook for zone_id={zone_id}")
    
    # Refresh cache if older than TTL
    cache_age = time.time() - WEBHOOK_CACHE_TIMESTAMP
    if cache_age > WEBHOOK_CACHE_TTL:
        logger.info(f"📢 [WEBHOOK] Cache is stale ({cache_age:.0f}s > {WEBHOOK_CACHE_TTL}s), refreshing...")
        refresh_webhook_cache(supabase_client)
    else:
        logger.info(f"📢 [WEBHOOK] Cache is fresh ({cache_age:.0f}s old), current cache size: {len(WEBHOOK_CACHE)}")
    
    # Return from cache or None
    webhook_url = WEBHOOK_CACHE.get(zone_id)
    if webhook_url:
        logger.info(f"📢 [WEBHOOK] ✓ Found webhook for zone {zone_id}")
    else:
        logger.warning(f"📢 [WEBHOOK] ❌ No webhook found for zone {zone_id}. Available zones in cache: {list(WEBHOOK_CACHE.keys())}")
    return webhook_url


def build_discord_embed(winner_nick: str, loser_nick: str, score: str, result_type: str, winner_discord_id: Optional[str] = None, loser_discord_id: Optional[str] = None):
    """
    Build Discord embed message for duel result.
    
    Args:
        winner_nick: Winner's player nick
        loser_nick: Loser's player nick
        score: Final score (e.g., "2-0")
        result_type: "WIN" or "LOSS"
        winner_discord_id: Winner's Discord user ID (for tagging)
        loser_discord_id: Loser's Discord user ID (for tagging)
        
    Returns:
        Dict with Discord embed data
    """
    # Format names with Discord mentions if IDs are available
    winner_display = to_discord_mention(winner_discord_id, winner_nick)
    loser_display = to_discord_mention(loser_discord_id, loser_nick)
    
    # Get random message
    if result_type == "WIN":
        message_template = get_random_win_message()
        # For this embed, we're showing from perspective of the winner
        formatted_message = format_message(message_template, winner_nick, loser_nick, score)
        color = 0x00FF00  # Green for win
        title = "🏆 ¡VICTORIA EN DUELO DIARIO! 🏆"
    else:  # LOSS
        message_template = get_random_loss_message()
        # For loss message, player is loser, opponent is winner
        formatted_message = format_message(message_template, loser_nick, winner_nick, score)
        color = 0xFF0000  # Red for loss
        title = "😢 Resultado de Duelo Diario 😢"
    
    embed = {
        "title": title,
        "description": formatted_message,
        "color": color,
        "fields": [
            {
                "name": "🏆 Ganador",
                "value": winner_display,
                "inline": True
            },
            {
                "name": "😤 Perdedor",
                "value": loser_display,
                "inline": True
            },
            {
                "name": "📊 Puntuación",
                "value": f"**{score}**",
                "inline": False
            }
        ],
        "footer": {
            "text": "LigaInterna Daily Duels",
            "icon_url": "https://raw.githubusercontent.com/royale-con-cheese/LigaInterna/main/logos/logo-with-text.png"
        },
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }
    
    return embed


def post_to_discord_with_retry(
    webhook_url: str,
    embed_data: dict,
    content: Optional[str] = None,
    mention_user_ids: Optional[List[str]] = None,
    max_attempts: int = 3,
) -> bool:
    """
    POST Discord embed to webhook with retry logic.
    
    Implements exponential backoff:
    - Attempt 1: Immediate
    - Attempt 2: After 2 seconds
    - Attempt 3: After 4 seconds
    
    Args:
        webhook_url: Discord webhook URL
        embed_data: Discord embed dictionary
        max_attempts: Maximum number of retry attempts
        
    Returns:
        True if successful, False otherwise
    """
    payload = {
        "embeds": [embed_data],
        "username": "⚔️ Arena de Duelos"
    }

    if content:
        payload["content"] = content

    if mention_user_ids:
        payload["allowed_mentions"] = {
            "parse": [],
            "users": mention_user_ids,
        }
    
    headers = {
        "Content-Type": "application/json"
    }
    
    logger.info(f"📢 [POST] Starting post_to_discord_with_retry - max_attempts={max_attempts}")
    logger.debug(f"📢 [POST] Webhook URL: {webhook_url[:50]}...")  # Log first 50 chars of URL for safety
    logger.debug(f"📢 [POST] Payload title: {embed_data.get('title', 'N/A')}")
    
    for attempt in range(1, max_attempts + 1):
        try:
            logger.info(f"📢 [POST] Attempt {attempt}/{max_attempts}: Posting to Discord...")
            response = requests.post(
                webhook_url,
                json=payload,
                headers=headers,
                timeout=10
            )
            
            logger.info(f"📢 [POST] Attempt {attempt}: Received status code {response.status_code}")
            
            if response.status_code == 204:  # Success (Discord returns 204 No Content)
                logger.info(f"📢 [POST] ✅ SUCCESS on attempt {attempt}/{max_attempts}")
                # Import colorama at module level if needed for colored logging
                try:
                    from colorama import Fore, Style
                    logger.info(f"{Fore.YELLOW}📢 Discord notification sent (attempt {attempt}/{max_attempts}){Style.RESET_ALL}")
                except ImportError:
                    logger.info(f"Discord notification posted successfully (attempt {attempt}/{max_attempts})")
                return True
            elif response.status_code == 429:  # Rate limit
                retry_after = response.headers.get("Retry-After", "60")
                logger.warning(f"📢 [POST] ⚠️ Discord rate limited. Retry after {retry_after}s")
                if attempt < max_attempts:
                    time.sleep(float(retry_after))
                    continue
            else:
                logger.warning(f"📢 [POST] Status {response.status_code}: {response.text[:200]}")
                if attempt < max_attempts:
                    # Exponential backoff: 2s, 4s
                    wait_time = 2 ** (attempt - 1)
                    logger.info(f"📢 [POST] Waiting {wait_time}s before retry...")
                    time.sleep(wait_time)
                    continue
                    
        except requests.Timeout:
            logger.warning(f"📢 [POST] ⏱️ Timeout on attempt {attempt}/{max_attempts}")
            if attempt < max_attempts:
                wait_time = 2 ** (attempt - 1)
                logger.info(f"📢 [POST] Waiting {wait_time}s before retry...")
                time.sleep(wait_time)
                continue
                
        except Exception as e:
            logger.error(f"📢 [POST] ❌ Exception on attempt {attempt}/{max_attempts}: {e}", exc_info=True)
            if attempt < max_attempts:
                wait_time = 2 ** (attempt - 1)
                logger.info(f"📢 [POST] Waiting {wait_time}s before retry...")
                time.sleep(wait_time)
                continue
    
    logger.error(f"📢 [POST] ❌ Failed to post to Discord after {max_attempts} attempts")
    return False


def send_discord_notification(
    winner_nick: str,
    loser_nick: str,
    score: str,
    zone_id: str,
    result_type: str,
    supabase_client,
    winner_discord_id: Optional[str] = None,
    loser_discord_id: Optional[str] = None
) -> bool:
    """
    Send Discord notification for daily duel result.
    
    Main orchestration function that:
    1. Gets the webhook URL for the zone
    2. Builds the embed message
    3. Posts to Discord with retry logic
    
    Args:
        winner_nick: Nick of the winner
        loser_nick: Nick of the loser
        score: Final score (e.g., "2-0", "2-1")
        zone_id: UUID of the season_zone
        result_type: "WIN" (from winner's perspective) or "LOSS" (from loser's perspective)
        supabase_client: Supabase client instance
        winner_discord_id: Winner's Discord user ID (optional for tagging)
        loser_discord_id: Loser's Discord user ID (optional for tagging)
        
    Returns:
        True if notification sent successfully, False otherwise
    """
    try:
        logger.info(f"📢 [SEND] Starting send_discord_notification for zone_id={zone_id}, result_type={result_type}, winner={winner_nick}, loser={loser_nick}, score={score}")
        
        # Get webhook URL for this zone
        logger.info(f"📢 [SEND] Step 1: Getting webhook URL...")
        webhook_url = get_webhook_url(zone_id, supabase_client)
        
        if not webhook_url:
            logger.warning(f"📢 [SEND] ❌ No Discord webhook configured for zone {zone_id} - SKIPPING notification")
            return False
        
        logger.info(f"📢 [SEND] Step 2: Building embed message for {result_type}...")
        # Build embed with Discord IDs if available
        winner_id_clean = normalize_discord_user_id(winner_discord_id)
        loser_id_clean = normalize_discord_user_id(loser_discord_id)
        embed_data = build_discord_embed(winner_nick, loser_nick, score, result_type, winner_id_clean, loser_id_clean)
        logger.info(f"📢 [SEND] Step 2: Embed built successfully")

        mention_user_ids = []
        if winner_id_clean:
            mention_user_ids.append(winner_id_clean)
        if loser_id_clean and loser_id_clean != winner_id_clean:
            mention_user_ids.append(loser_id_clean)

        mention_content = None
        if mention_user_ids:
            mention_content = " ".join([f"<@{uid}>" for uid in mention_user_ids])
        
        logger.info(f"📢 [SEND] Step 3: Posting to Discord with retry logic...")
        # Post with retry
        success = post_to_discord_with_retry(
            webhook_url,
            embed_data,
            content=mention_content,
            mention_user_ids=mention_user_ids,
        )
        
        if success:
            logger.info(f"📢 [SEND] ✅ SUCCESS: Discord notification posted: {winner_nick} vs {loser_nick} ({score}) - {result_type}")
            try:
                from colorama import Fore, Style
                logger.info(f"{Fore.YELLOW}📢 Discord: {winner_nick} vs {loser_nick} ({score}) - {result_type}{Style.RESET_ALL}")
            except ImportError:
                pass
        else:
            logger.warning(f"📢 [SEND] ❌ FAILED: Discord notification failed for {winner_nick} vs {loser_nick} ({score}) - {result_type}")
        
        return success
        
    except Exception as e:
        logger.error(f"📢 [SEND] ❌ EXCEPTION in send_discord_notification: {e}", exc_info=True)
        return False


def notify_duel_result(
    winner_nick: str,
    loser_nick: str,
    score: str,
    winner_zone_id: Optional[str],
    loser_zone_id: Optional[str],
    supabase_client,
    winner_discord_id: Optional[str] = None,
    loser_discord_id: Optional[str] = None
) -> dict:
    """
    Send Discord notifications to both winner and loser zones.
    
    This is the high-level function called from process_daily_duel_battle().
    It sends WIN notification to winner's zone and LOSS notification to loser's zone.
    
    Args:
        winner_nick: Nick of the winner
        loser_nick: Nick of the loser
        score: Final score (e.g., "2-0")
        winner_zone_id: UUID of winner's zone (None if not in a zone)
        loser_zone_id: UUID of loser's zone (None if not in a zone)
        supabase_client: Supabase client instance
        winner_discord_id: Winner's Discord user ID (optional for tagging)
        loser_discord_id: Loser's Discord user ID (optional for tagging)
        
    Returns:
        Dict with notification results: {"winner": bool, "loser": bool}
    """
    results = {
        "winner": False,
        "loser": False
    }
    
    try:
        logger.info(f"📢 [NOTIFY] Starting notify_duel_result: winner={winner_nick} ({winner_zone_id}), loser={loser_nick} ({loser_zone_id}), score={score}")
        
        # Send WIN notification to winner's zone
        if winner_zone_id:
            logger.info(f"📢 [NOTIFY] Sending WIN notification to winner zone {winner_zone_id}")
            results["winner"] = send_discord_notification(
                winner_nick=winner_nick,
                loser_nick=loser_nick,
                score=score,
                zone_id=winner_zone_id,
                result_type="WIN",
                supabase_client=supabase_client,
                winner_discord_id=winner_discord_id,
                loser_discord_id=loser_discord_id
            )
        else:
            logger.warning(f"📢 [NOTIFY] Winner {winner_nick} has no zone, skipping WIN notification")
        
        # Send LOSS notification to loser's zone
        if loser_zone_id:
            logger.info(f"📢 [NOTIFY] Sending LOSS notification to loser zone {loser_zone_id}")
            results["loser"] = send_discord_notification(
                winner_nick=winner_nick,
                loser_nick=loser_nick,
                score=score,
                zone_id=loser_zone_id,
                result_type="LOSS",
                supabase_client=supabase_client,
                winner_discord_id=winner_discord_id,
                loser_discord_id=loser_discord_id
            )
        else:
            logger.warning(f"📢 [NOTIFY] Loser {loser_nick} has no zone, skipping LOSS notification")
        
        logger.info(f"📢 [NOTIFY] ✓ notify_duel_result complete: winner={results['winner']}, loser={results['loser']}")
        return results
        
    except Exception as e:
        logger.error(f"📢 [NOTIFY] ❌ EXCEPTION in notify_duel_result: {e}", exc_info=True)
        return results
