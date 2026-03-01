-- Add days_per_round configuration column to season table
-- Enables configurable round grouping in daily points grid
-- Tournament admins can adjust round length per season (default: 4 days)

ALTER TABLE public.season
ADD COLUMN IF NOT EXISTS days_per_round INT DEFAULT 4;

-- Add constraint to ensure valid range (1-14 days per round)
ALTER TABLE public.season
ADD CONSTRAINT days_per_round_range CHECK (days_per_round >= 1 AND days_per_round <= 14);

COMMENT ON COLUMN season.days_per_round IS
  'Number of days per tournament round for daily points grid grouping.
   Default: 4 days per round.
   Used in SeasonDailyPoints view to display "Ronda N" headers spanning multiple day columns.
   Valid range: 1-14 days.
   Configurable per season to match tournament structure.';
