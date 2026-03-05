-- Migration: Add Discord Webhook Support for Zone Notifications
-- Date: 2026-03-04
-- Purpose: Enable automatic Discord notifications when daily duels are auto-linked

-- Create zone_discord_webhook table
CREATE TABLE IF NOT EXISTS public.zone_discord_webhook (
  zone_discord_webhook_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID NOT NULL REFERENCES public.season_zone(zone_id) ON DELETE CASCADE,
  webhook_url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by_admin_id UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_by_admin_id UUID,
  
  CONSTRAINT zone_discord_webhook_unique_zone UNIQUE(zone_id)
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_zone_discord_webhook_zone_id 
  ON public.zone_discord_webhook(zone_id, is_active);

CREATE INDEX IF NOT EXISTS idx_zone_discord_webhook_created_by 
  ON public.zone_discord_webhook(created_by_admin_id);

-- Add comments for documentation
COMMENT ON TABLE public.zone_discord_webhook 
  IS 'Stores Discord webhook URLs for each zone to enable automatic match result notifications';

COMMENT ON COLUMN public.zone_discord_webhook.zone_id 
  IS 'Reference to the season zone that will use this webhook';

COMMENT ON COLUMN public.zone_discord_webhook.webhook_url 
  IS 'Discord webhook URL - used to post messages to the zone''s Discord channel';

COMMENT ON COLUMN public.zone_discord_webhook.is_active 
  IS 'When false, notifications will not be sent to this webhook';

COMMENT ON COLUMN public.zone_discord_webhook.created_by_admin_id 
  IS 'Admin user who created this webhook configuration';

COMMENT ON COLUMN public.zone_discord_webhook.updated_by_admin_id 
  IS 'Admin user who last updated this webhook configuration';

-- Enable Row Level Security
ALTER TABLE public.zone_discord_webhook ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS zone_discord_webhook_admin_select ON public.zone_discord_webhook;
DROP POLICY IF EXISTS zone_discord_webhook_admin_insert ON public.zone_discord_webhook;
DROP POLICY IF EXISTS zone_discord_webhook_admin_update ON public.zone_discord_webhook;
DROP POLICY IF EXISTS zone_discord_webhook_admin_delete ON public.zone_discord_webhook;
DROP POLICY IF EXISTS zone_discord_webhook_select ON public.zone_discord_webhook;
DROP POLICY IF EXISTS zone_discord_webhook_write ON public.zone_discord_webhook;
DROP POLICY IF EXISTS zone_discord_webhook_update ON public.zone_discord_webhook;
DROP POLICY IF EXISTS zone_discord_webhook_delete ON public.zone_discord_webhook;

-- Simple RLS for service role access (CRON + any service)
CREATE POLICY zone_discord_webhook_service_all ON public.zone_discord_webhook
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

