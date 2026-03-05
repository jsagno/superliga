# Discord Notifications - Phase 4 Testing Guide

## Pre-Testing Checklist

✅ Phase 1: Database migration created (20260304_add_zone_discord_webhook.sql)
✅ Phase 2: CRON modules implemented (discord_messages.py, discord_notifications.py)
✅ Phase 3: Admin UI created (ZoneDiscordWebhooks.jsx)
⏳ Phase 4: Testing & validation (THIS GUIDE)

---

## Manual Testing Steps

### Step 1: Database Migration (if not already done)

```bash
cd d:\LigaInterna
supabase db push
```

Verify table was created:
```sql
SELECT * FROM zone_discord_webhook LIMIT 1;
-- Should return empty table (OK) or error if table doesn't exist
```

### Step 2: Create Test Discord Server & Webhook

1. Go to Discord and create a test server (or use existing)
2. Right-click channel → Edit Channel → Integrations → Webhooks → Create Webhook
3. Copy webhook URL (looks like: `https://discord.com/api/webhooks/123456789/abcdefg...`)
4. **Don't share this URL** - it's like a password

### Step 3: Configure Webhook in Admin UI

1. Navigate to Admin → 🔔 Discord
2. Select a season
3. Choose a zone
4. Click "Configurar" button
5. Paste webhook URL
6. Check "Activar webhook"
7. Click "🧪 Prueba de Conexión" - should see success message
8. Click "Guardar"

### Step 4: Verify Data in Database

```sql
SELECT zone_id, webhook_url, is_active, created_at 
FROM zone_discord_webhook 
WHERE is_active = TRUE;
```

You should see your zone with webhook URL.

### Step 5: Test CRON with Mock Daily Duel Battle

Run CRON and monitor output:

```bash
cd d:\LigaInterna\packages\cron
python cron_clash_sync.py
```

Watch for log lines like:
```
2026-03-04 23:45:32 | INFO | Discord notification posted successfully
2026-03-04 23:45:32 | INFO | Duel result notifications: winner=True, loser=True
```

If you see daily duel battles being processed, you should see **Discord notifications in your test channel**.

### Step 6: Verify Discord Messages

In your Discord test channel, you should see embeds like:

```
🏆 ¡VICTORIA EN DUELO DIARIO! 🏆
¡[WINNER_NICK] DESTRUYÓ COMPLETAMENTE A [LOSER_NICK]! [SCORE] 💪 ¡Hora de celebrar!

Ganador: **[WINNER_NICK]**
Perdedor: **[LOSER_NICK]**
Puntuación: **2-0**
```

---

## Test Cases to Validate

### ✓ Basic Functionality

- [ ] Webhook URL stored in database
- [ ] Webhook URL is masked in admin UI
- [ ] Can enable/disable webhook with toggle
- [ ] Can delete webhook
- [ ] Test connection button works

### ✓ Discord Messages

- [ ] Messages appear in Discord channel
- [ ] Winner gets "VICTORIA" (green) message
- [ ] Loser gets "LOSS" (red) message
- [ ] Random messages vary (not same every time)
- [ ] All messages are in Spanish
- [ ] Player names and scores are correct

### ✓ Error Handling

- [ ] Invalid webhook URL rejected with error message
- [ ] Network timeout retries (should try 3 times)
- [ ] If webhook fails, CRON continues processing
- [ ] Zone without webhook doesn't crash CRON
- [ ] Special characters in names handled correctly

### ✓ Edge Cases

- [ ] Two zones in same season each get their own messages
- [ ] Multiple battles in one CRON run post multiple messages
- [ ] Very long player names are displayed properly
- [ ] Messages with emoji display correctly
- [ ] Webhook with special characters in URL handled

---

## Debugging Tips

### Check CRON Logs

```bash
# Watch real-time logs
tail -f d:\LigaInterna\packages\cron\logs\cron.log

# Search for Discord errors
grep -i "discord" d:\LigaInterna\packages\cron\logs\cron.log
```

### Test Webhook Manually (Python)

```python
import requests

webhook_url = "YOUR_WEBHOOK_URL_HERE"

embed = {
    "title": "🧪 Test",
    "description": "This is a test message",
    "color": 0xFF00FF
}

response = requests.post(webhook_url, json={"embeds": [embed]})
print(f"Status: {response.status_code}")  # Should be 204
```

### Check Database Configuration

```python
from supabase import create_client
from dotenv import load_dotenv
import os

load_dotenv(r'd:\LigaInterna\packages\cron\.env')
sb = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)

# List all webhooks
webhooks = sb.table("zone_discord_webhook").select("*").execute()
print(f"Found {len(webhooks.data)} webhooks")
for w in webhooks.data:
    print(f"  - Zone: {w['zone_id']}, Active: {w['is_active']}")
```

---

## Expected Webhook Response

When CRON posts to Discord webhook, Discord should respond with HTTP 204 (No Content), which means:
- ✅ Message posted successfully
- ✅ Discord doesn't return any body
- ✅ CRON treats 204 as success

If you see different status codes:
- 401/404: Invalid or expired webhook URL
- 429: Rate limited (decrease frequency)
- 500: Discord server error (temporary)

---

## Load Testing (Optional)

To test multiple notifications at once:

```python
import requests
import concurrent.futures

webhook_urls = [
    "ZONE_1_WEBHOOK_URL",
    "ZONE_2_WEBHOOK_URL",
    "ZONE_3_WEBHOOK_URL",
]

def post_message(url, zone_num):
    embed = {
        "title": f"Test {zone_num}",
        "description": f"Zone {zone_num} notification",
        "color": 0x0000FF
    }
    requests.post(url, json={"embeds": [embed]}, timeout=10)

# Post to all webhooks concurrently
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
    for i, url in enumerate(webhook_urls):
        executor.submit(post_message, url, i + 1)
    
print("Load test complete")
```

---

## Common Issues & Solutions

### Issue: Webhook URL shows as "(null)"

**Solution**: Webhook might have failed to save. Try:
1. Reload the page
2. Check database for webhook record
3. Verify you clicked "Guardar" button

### Issue: "Invalid Discord webhook URL" error

**Solution**: 
- Copy URL exactly from Discord
- Make sure it starts with `https://discord.com/api/webhooks/`
- Check for extra spaces

### Issue: Messages not appearing in Discord

**Solution** (check in order):
1. Verify webhook is created in correct channel
2. Run test button - does it work?
3. Check CRON logs for errors
4. Verify zone_id matches in configuration
5. Check if daily duel battles are being detected

### Issue: CRON crashes after Discord code

**Solution**: Discord module has error handling, but:
1. Check CRON logs
2. Verify discord_messages.py and discord_notifications.py exist in `/packages/cron/`
3. Try running CRON with older code if critical

---

## Success Criteria for Phase 4

✅ All manual tests pass  
✅ Discord messages appear with correct format and content  
✅ Retry logic works (test by temporarily disabling webhook)  
✅ No CRON crashes due to Discord errors  
✅ Error messages are user-friendly  
✅ Load test with 5+ zones succeeds  

When all criteria are met, **Phase 4 is complete** and we can proceed to Phase 5 (Deployment).
