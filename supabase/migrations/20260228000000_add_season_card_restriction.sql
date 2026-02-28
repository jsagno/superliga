-- Migration: Add season_card_restriction table for RES (Card Restrictions) system
-- Purpose: Allow admins to prohibit specific players from using specific cards within a season
-- Author: LigaInterna Team
-- Date: 2026-02-28

-- Create season_card_restriction table
CREATE TABLE IF NOT EXISTS public.season_card_restriction (
    restriction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id UUID NOT NULL REFERENCES public.season(season_id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES public.player(player_id) ON DELETE CASCADE,
    card_id BIGINT NOT NULL REFERENCES public.card(card_id) ON DELETE CASCADE,
    reason TEXT,
    created_by UUID REFERENCES public.player(player_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Prevent duplicate restrictions (same player + card + season)
    CONSTRAINT unique_season_player_card UNIQUE(season_id, player_id, card_id)
);

-- Add indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_restriction_season_player 
    ON public.season_card_restriction(season_id, player_id);

CREATE INDEX IF NOT EXISTS idx_restriction_season 
    ON public.season_card_restriction(season_id);

CREATE INDEX IF NOT EXISTS idx_restriction_player 
    ON public.season_card_restriction(player_id);

-- Add comments for documentation
COMMENT ON TABLE public.season_card_restriction IS 'Card restrictions per player per season - prevents specific players from using specific cards';
COMMENT ON COLUMN public.season_card_restriction.restriction_id IS 'Unique identifier for the restriction';
COMMENT ON COLUMN public.season_card_restriction.season_id IS 'Season in which the restriction applies';
COMMENT ON COLUMN public.season_card_restriction.player_id IS 'Player who is restricted from using the card';
COMMENT ON COLUMN public.season_card_restriction.card_id IS 'Card that the player is restricted from using';
COMMENT ON COLUMN public.season_card_restriction.reason IS 'Optional explanation for why the restriction was applied';
COMMENT ON COLUMN public.season_card_restriction.created_by IS 'Admin who created the restriction';
COMMENT ON COLUMN public.season_card_restriction.created_at IS 'Timestamp when the restriction was created';

-- Note: RLS not enabled to match existing table architecture in the database
-- The existing system does not use RLS policies on any tables
-- Application-level security is used instead via Supabase client configuration
-- All admin operations are authenticated at the application layer (liga-admin frontend)

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.season_card_restriction TO authenticated;
GRANT SELECT ON public.season_card_restriction TO anon;

