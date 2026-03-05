# Discord Notifications Feature - Implementation Tasks

## Phase 1: Database Setup

- [x] **T1.1**: Create migration `20260304_add_zone_discord_webhook.sql`
  - Create `zone_discord_webhook` table
  - Add indexes and constraints
  - Enable RLS policies

- [x] **T1.2**: Add Supabase migration
  - Run migration to create table
  - Verify table structure in Supabase

## Phase 2: CRON Core Implementation

- [x] **T2.1**: Create Discord utility module in CRON
  - File: `packages/cron/discord_notifications.py`
  - Functions:
    - `get_discord_webhooks()` - Load all zone webhooks on startup
    - `select_random_message(result_type)` - Pick random template
    - `format_discord_message()` - Build embed with player names & score
    - `post_to_discord()` - POST to webhook with retry logic

- [x] **T2.2**: Add message template library
  - File: `packages/cron/discord_messages.py`
  - WIN_MESSAGES list (50+ variations)
  - LOSS_MESSAGES list (50+ variations)
  - Format validation

- [x] **T2.3**: Integrate with auto-linking workflow
  - In `process_daily_duel_battle()`: After creating result
  - Extract: winner_nick, loser_nick, winner_zone_id, loser_zone_id, score
  - Call `send_discord_notifications()`

- [x] **T2.4**: Error handling & logging
  - Webhook validation on startup
  - Retry logic with exponential backoff
  - Comprehensive error logging

## Phase 3: Admin UI Integration

- [x] **T3.1**: Create zone webhook configuration component
  - File: `packages/liga-admin/src/pages/admin/ZoneDiscordWebhooks.jsx`
  - Input for webhook URL (masked)
  - Enable/disable toggle
  - Test Connection button
  - Error/success messages

- [x] **T3.2**: Add zone webhook management page
  - File: `packages/liga-admin/src/pages/admin/ZoneDiscordWebhooks.jsx`
  - List all zones with webhook status
  - Edit/delete webhooks
  - Add new webhook

- [x] **T3.3**: Integrate into admin navigation
  - Add menu item to admin dashboard (🔔 Discord)
  - Link to webhook configuration page
  - Route: `/admin/discord-webhooks`

## Phase 4: Testing & Validation

- [ ] **T4.1**: Unit tests for message formatting
  - Test message template selection
  - Test player name sanitization
  - Test score formatting

- [ ] **T4.2**: Integration tests with mock Discord API
  - Mock webhook responses
  - Test retry logic
  - Test error handling

- [ ] **T4.3**: Manual testing with real Discord
  - Create test Discord server
  - Configure webhook URL
  - Run auto-link on test data
  - Verify messages appear

- [ ] **T4.4**: Load testing
  - Simulate 10+ concurrent zone notifications
  - Verify no rate limiting issues
  - Check webhook timeout handling

## Phase 5: Deployment & Monitoring

- [ ] **T5.1**: Database migration deployment
  - Apply migration to production
  - Verify table exists
  - Check indexes are created

- [ ] **T5.2**: CRON deployment
  - Update CRON code with discord_notifications module
  - Update requirements.txt (add requests if needed)
  - Deploy to production

- [ ] **T5.3**: Admin UI deployment
  - Build and deploy React changes
  - Verify UI components render
  - Test webhook configuration workflow

- [ ] **T5.4**: Monitoring setup
  - Log webhook successes/failures
  - Set up alerts for repeated failures
  - Monitor webhook response times

## Implementation Notes

### Database Migration

```sql
-- 20260304_add_zone_discord_webhook.sql
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

-- Políticas RLS
ALTER TABLE zone_discord_webhook ENABLE ROW LEVEL SECURITY;

CREATE POLICY zone_discord_webhook_admin_select ON zone_discord_webhook
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM admin_user WHERE admin_user.admin_user_id = auth.uid()
    )
  );

CREATE POLICY zone_discord_webhook_admin_update ON zone_discord_webhook
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM admin_user WHERE admin_user.admin_user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_user WHERE admin_user.admin_user_id = auth.uid()
    )
  );
```

### CRON Integration Point

In `process_daily_duel_battle()`, after creating result:

```python
# Send Discord notifications
if winner_zone_id:
    send_discord_notification(
        winner_nick, loser_nick, score,
        result_type="WIN", zone_id=winner_zone_id
    )
if loser_zone_id:
    send_discord_notification(
        winner_nick, loser_nick, score,
        result_type="LOSS", zone_id=loser_zone_id
    )
```

### Admin UI Endpoints

- GET `/api/zones/:zoneId/discord-webhook` - Get webhook status
- POST `/api/zones/:zoneId/discord-webhook` - Create/update webhook
- DELETE `/api/zones/:zoneId/discord-webhook` - Remove webhook
- POST `/api/zones/:zoneId/discord-webhook/test` - Test connection

---

## Estimated Effort

- Phase 1 (Database): 1 hour
- Phase 2 (CRON): 2-3 hours
- Phase 3 (Admin UI): 2 hours
- Phase 4 (Testing): 1-2 hours
- Phase 5 (Deployment): 1 hour

**Total**: ~8-10 hours

## Start Date

Ready to begin Phase 1 once specifications are approved.
