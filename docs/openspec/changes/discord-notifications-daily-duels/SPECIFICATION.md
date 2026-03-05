# Discord Notifications for Daily Duels - Specification

**Status**: Draft  
**Date**: 2026-03-04  
**Author**: Development Team

---

## Overview

Extend the CRON auto-linking system to post match results to Discord channels when daily duel battles are auto-linked. Each zone has its own Discord channel, and the system sends random "crazy" messages celebrating wins or commiserating losses.

---

## Features

### FR1: Discord Webhook Configuration per Zone

- Admin can configure Discord webhook URLs for each zone via the admin UI
- Webhooks stored in `zone_discord_webhook` table
- Each zone can have one active webhook URL
- Webhooks can be enabled/disabled per zone

### FR2: Automatic Discord Message on Match Creation

- When CRON auto-links a daily duel battle, extract result details
- Determine winner and loser
- Post message to the appropriate zone's Discord channel
- Include player names, final score, game mode
- Each message uses a randomly selected "crazy" template

### FR3: Randomized Celebratory/Sad Messages

- **Win Messages**: Celebratory, emoji-filled, hype messages (50+ variations)
- **Loss Messages**: Funny, sympathetic, or sarcastic messages (50+ variations)
- Messages are randomly selected with each battle result
- Messages include player nick, opponent nick, score, and zone name

### FR4: Error Handling & Retry

- Failed webhook posts logged with full context
- Retry mechanism with exponential backoff (up to 3 attempts)
- System continues even if Discord post fails
- Webhook health check on startup

---

## Data Model

### New Table: `zone_discord_webhook`

```sql
CREATE TABLE zone_discord_webhook (
  zone_discord_webhook_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID NOT NULL REFERENCES season_zone(zone_id),
  webhook_url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_admin_id UUID NOT NULL REFERENCES admin_user(admin_user_id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by_admin_id UUID REFERENCES admin_user(admin_user_id)
);

CREATE INDEX idx_zone_discord_webhook_zone_id ON zone_discord_webhook(zone_id, is_active);
```

---

## Implementation

### CRON Integration

1. **Load zone webhooks** on startup → cache in memory
2. **In `process_daily_duel_battle()`**:
   - After creating `scheduled_match_result`, extract result details
   - Get player zones
   - Look up Discord webhooks for each zone
   - Post victory message to winner's zone channel
   - Post defeat message to loser's zone channel

3. **New function: `send_discord_notification()`**:
   - Takes: player_nick, opponent_nick, score, result_type (WIN/LOSS), zone_id
   - Selects random template based on result type
   - Formats message with emoji and player names
   - Posts to webhook with retry logic

### Message Templates

#### Mensajes de Victoria (Selección Aleatoria)
- 🔥 ¡**{{player}}** DESTRUYÓ COMPLETAMENTE A {{opponent}}! {{score}} 💪 ¡Hora de celebrar! 
- 🎉 ¡YOOO {{player}} ENVIÓ A {{opponent}} DE VUELTA AL SPAWN! {{score}} ¡VAMOS!
- 👑 ¡{{player}} ES UNA BESTIA ABSOLUTA! ¡{{opponent}} NUNCA TUVO OPORTUNIDAD! {{score}} 🏆
- ⚡ ¡{{player}} CON EL BARRIDO LIMPIO! {{score}} 🌪️ ¡{{opponent}} SIN AIRE!
- 🚀 ¡{{player}} LITERALMENTE VOLÓ POR EL ARENA Y DESTROZÓ A {{opponent}}! {{score}}
- 💎 ¡{{player}} ES INVENCIBLE! ¡{{opponent}} ACABA DE VER LA GRANDEZA! {{score}} ✨
- 😤 ¡{{player}} DIJO "HOY NO" Y LE DIO UNA MASTERCLASS A {{opponent}}! {{score}}
- 🎯 ¡EJECUCIÓN PERFECTA DE {{player}}! ¡{{opponent}} SIGUE RECUPERÁNDOSE! {{score}} 💥
- 🌟 ¡TEATRO ABSOLUTO! ¡{{player}} HIZO VER NOVATO A {{opponent}}! {{score}} 🔥
- 🏅 ¡RENDIMIENTO DOMINANTE DE {{player}}! ¡{{opponent}} NECESITA DESCANSAR! {{score}}

#### Mensajes de Derrota (Selección Aleatoria)
- 😅 RIP {{player}}... {{opponent}} FUE MUY FUERTE. ¡LA PRÓXIMA SERÁ LA TUYA! {{score}}
- 💔 ¡{{player}} PERDIÓ HOY PERO SEGUIMOS AMÁNDOTE! ¡MEJOR SUERTE LA PRÓXIMA! {{score}}
- 🍂 ¡{{player}} CAYÓ ANTE {{opponent}}! ¡HORA DE REVISAR LAS REPETICIONES! {{score}} 📽️
- 😤 ¡{{opponent}} TENÍA UNA MISIÓN HOY... PERO ¡{{player}} PELEÓ CON TODO! {{score}}
- 🎭 ¡OHHH NO! ¡{{player}} CAMINÓ AL TERRITORIO DE {{opponent}}! {{score}} 💀
- 🌪️ ¡{{opponent}} LLEGÓ COMO UN HURACÁN! ¡POBRE {{player}}...! {{score}}
- 😭 ¡{{player}} LO DIO TODO PERO {{opponent}} TENÍA OTROS PLANES! {{score}}
- ⚰️ ¡{{opponent}} SELLÓ EL DESTINO DE {{player}} HOY! ¡SIN RENCORES AUNQUE! {{score}}
- 🎪 ¡QUÉ ESPECTÁCULO! ¡{{opponent}} ROBÓ LOS REFLECTORES DE {{player}}! {{score}} 🌟
- 📉 ¡LAS ESTADÍSTICAS NO MIENTEN! ¡{{opponent}} > {{player}} HOY, PERO ¡ESTAMOS EN ESTE VIAJE! {{score}}

---

## Admin UI Integration

### Zone Configuration Page

- **Location**: Admin Dashboard → Zones → Zone Settings
- **Fields**:
  - Zone Name (read-only)
  - Discord Webhook URL (text input, masked)
  - Enable/Disable toggle
  - Test Connection button (validates webhook)
  - Last Updated timestamp

### Workflow

1. Admin navigates to zone settings
2. Pastes Discord webhook URL from their server
3. Clicks "Test Connection" to validate
4. Saves configuration
5. Receives confirmation message
6. Future match results auto-post to that channel

---

## Alert on Startup

CRON logs on startup:
```
2026-03-04 22:05:00 | INFO | Discord notification system loaded
2026-03-04 22:05:00 | INFO | Zones with webhooks: 2 (Zone A, Zone B)
2026-03-04 22:05:00 | INFO | Total message templates: 100 (50 win, 50 loss)
```

---

## Error Handling

### Webhook Failures

1. **First attempt fails**: Log as WARNING, schedule retry
2. **Retry succeeds**: Log as INFO "Discord notification sent after retry"
3. **All retries fail**: Log as ERROR with webhook URL & error details, continue sync
4. **Invalid webhook URL**: Log as ERROR, disable webhook until admin fixes it

### Example Logs

```
2026-03-04 22:05:15 | INFO | Successfully posted discord notification for player_id:abc123 (Zone A)
2026-03-04 22:05:20 | WARNING | Discord webhook post failed for Zone B, retrying... (attempt 2/3)
2026-03-04 22:05:25 | INFO | Discord webhook retry succeeded for Zone B
2026-03-04 22:05:30 | ERROR | Discord webhook permanently failed for Zone C after 3 attempts. Webhook may be invalid.
```

---

## Security

- Webhook URLs stored in database (encrypted at rest via Supabase)
- Only service_role can create/update webhooks
- Webhook URLs never logged or displayed in full
- Messages sanitize player names (no Discord markdown injection)

---

## Testing

### Test Data Setup

1. Create test zone in database
2. Create Discord webhook (use Discord.test server)
3. Simulate daily duel result
4. Verify message appears in Discord channel

### Test Cases

- [ ] Win message posts to Discord
- [ ] Loss message posts to Discord
- [ ] Random message selected each time
- [ ] Webhook validation works
- [ ] Failed webhook disables gracefully
- [ ] Multiple zones don't interfere
- [ ] Player names sanitized in messages

---

## Dependencies

- Python `requests` library (already in CRON requirements)
- Discord server with webhook permissions
- Supabase table migration for `zone_discord_webhook`

---

## Rollback Plan

1. Remove webhook URLs from all zones (via admin UI)
2. CRON gracefully handles missing webhooks (logs INFO, continues)
3. Messages stop posting but data remains valid
4. Can re-enable by adding webhooks again

---

## Success Criteria

✅ Discord messages post automatically when battles are auto-linked  
✅ Each zone can have its own Discord channel  
✅ Messages are random and fun  
✅ No impact on core auto-linking functionality  
✅ System continues if Discord unavailable  
✅ Admin UI allows configuration  
✅ All error cases handled gracefully
