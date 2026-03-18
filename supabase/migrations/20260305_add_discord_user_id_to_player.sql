-- Add discord_user_id field to player table for Discord mentions/tagging
ALTER TABLE public.player 
ADD COLUMN IF NOT EXISTS discord_user_id TEXT UNIQUE;

COMMENT ON COLUMN public.player.discord_user_id IS 'Discord user ID for tagging players in Discord notifications';
