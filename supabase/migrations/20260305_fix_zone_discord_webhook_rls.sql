-- Fix RLS policies for zone_discord_webhook
-- Allow authenticated users (Admin UI) to access the table

-- Drop the restrictive service_role-only policy
DROP POLICY IF EXISTS zone_discord_webhook_service_all ON public.zone_discord_webhook;

-- Allow authenticated users to SELECT (Admin UI reads)
CREATE POLICY zone_discord_webhook_authenticated_select ON public.zone_discord_webhook
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to INSERT (Admin UI creates webhooks)
CREATE POLICY zone_discord_webhook_authenticated_insert ON public.zone_discord_webhook
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to UPDATE (Admin UI edits webhooks)
CREATE POLICY zone_discord_webhook_authenticated_update ON public.zone_discord_webhook
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to DELETE (Admin UI deletes webhooks)
CREATE POLICY zone_discord_webhook_authenticated_delete ON public.zone_discord_webhook
  FOR DELETE
  TO authenticated
  USING (true);

-- Also allow service_role for CRON access
CREATE POLICY zone_discord_webhook_service_all ON public.zone_discord_webhook
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
