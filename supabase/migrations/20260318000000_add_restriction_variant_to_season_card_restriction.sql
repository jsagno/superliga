-- Migration: Add restriction_variant to season_card_restriction
-- Purpose: Allow RES restrictions to target specific card variants (normal, evolution, hero)
-- Date: 2026-03-18

ALTER TABLE public.season_card_restriction
ADD COLUMN IF NOT EXISTS restriction_variant TEXT;

UPDATE public.season_card_restriction
SET restriction_variant = 'all'
WHERE restriction_variant IS NULL;

ALTER TABLE public.season_card_restriction
ALTER COLUMN restriction_variant SET NOT NULL;

ALTER TABLE public.season_card_restriction
ALTER COLUMN restriction_variant SET DEFAULT 'normal';

ALTER TABLE public.season_card_restriction
DROP CONSTRAINT IF EXISTS unique_season_player_card;

ALTER TABLE public.season_card_restriction
DROP CONSTRAINT IF EXISTS season_card_restriction_variant_check;

ALTER TABLE public.season_card_restriction
ADD CONSTRAINT season_card_restriction_variant_check
CHECK (restriction_variant IN ('all', 'normal', 'evolution', 'hero'));

ALTER TABLE public.season_card_restriction
ADD CONSTRAINT unique_season_player_card_variant
UNIQUE (season_id, player_id, card_id, restriction_variant);

CREATE INDEX IF NOT EXISTS idx_restriction_season_player_variant
    ON public.season_card_restriction(season_id, player_id, restriction_variant);

COMMENT ON COLUMN public.season_card_restriction.restriction_variant IS 'Restricted card variant: all (legacy), normal, evolution, or hero';