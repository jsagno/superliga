-- Add battle cutoff configuration columns to season table
-- Allows admins to configure season-specific battle-to-date cutoff times
-- instead of hardcoded 590-minute (09:50 UTC) offset

ALTER TABLE public.season
ADD COLUMN IF NOT EXISTS battle_cutoff_minutes INT DEFAULT 590,
ADD COLUMN IF NOT EXISTS battle_cutoff_tz_offset TEXT DEFAULT '-03:00';

COMMENT ON COLUMN season.battle_cutoff_minutes IS
  'Minutes to subtract from battle timestamp to determine game date. 
   Default 590 = 09:50 UTC cutoff (battles before this count as previous day).
   Configurable per season for regional/league variations.
   Valid range: 0-1440 minutes (0-24 hours).';

COMMENT ON COLUMN season.battle_cutoff_tz_offset IS
  'Timezone offset for display purposes only (does not affect calculation).
   Examples: ''-03:00'' (Argentina UTC-3), ''-05:00'' (US Eastern), ''+00:00'' (UTC).
   Used in admin UI to show local time equivalent of cutoff.
   Format: ±HH:MM (ISO 8601).';
