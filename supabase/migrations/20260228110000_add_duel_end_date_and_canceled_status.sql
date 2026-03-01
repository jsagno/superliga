-- Add duel-specific end date for season scheduling boundaries
ALTER TABLE public.season
ADD COLUMN IF NOT EXISTS duel_end_date date;

-- Backfill duel_end_date for existing seasons when possible
UPDATE public.season
SET duel_end_date = COALESCE(
  duel_end_date,
  (season_end_at AT TIME ZONE 'UTC')::date,
  ladder_start_date,
  duel_start_date
)
WHERE duel_end_date IS NULL;

-- Extend scheduled_match status check to include CANCELED for reconciliation flow
ALTER TABLE public.scheduled_match
DROP CONSTRAINT IF EXISTS scheduled_match_status_check;

ALTER TABLE public.scheduled_match
ADD CONSTRAINT scheduled_match_status_check
CHECK (
  status = ANY (
    ARRAY[
      'PENDING'::text,
      'LINKED'::text,
      'CONFIRMED'::text,
      'OVERRIDDEN'::text,
      'CANCELED'::text
    ]
  )
);
