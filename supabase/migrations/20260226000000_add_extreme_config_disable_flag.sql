-- Migration: Add is_extreme_config_disabled flag to seasons table
-- Purpose: Allow admins to disable extreme configuration validation per-season

-- Add column to seasons table with default value (extreme config enabled by default)
ALTER TABLE public.seasons
ADD COLUMN is_extreme_config_disabled BOOLEAN DEFAULT FALSE NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.seasons.is_extreme_config_disabled IS 'When true, extreme/risky deck validation is disabled for this season. Decks will not be checked against extreme composition rules.';

-- Create index for performance (in case we query by this flag)
CREATE INDEX idx_seasons_extreme_config_disabled ON public.seasons(is_extreme_config_disabled);

-- Update RLS policy to allow admin (service_role) to update this column
-- Note: Existing RLS policies should already restrict to service_role for updates
-- Verify with: SELECT * FROM pg_policies WHERE tablename = 'seasons';
