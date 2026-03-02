-- Manually add the is_extreme_config_disabled column to season table
-- This is needed because the migration was marked as applied but never actually ran

-- Check if column exists first
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'season' 
        AND column_name = 'is_extreme_config_disabled'
    ) THEN
        -- Add the column
        ALTER TABLE public.season
        ADD COLUMN is_extreme_config_disabled BOOLEAN DEFAULT FALSE NOT NULL;
        
        -- Add comment
        COMMENT ON COLUMN public.season.is_extreme_config_disabled IS 'When true, extreme/risky deck validation is disabled for this season. Decks will not be checked against extreme composition rules.';
        
        -- Create index
        CREATE INDEX idx_season_extreme_config_disabled ON public.season(is_extreme_config_disabled);
        
        RAISE NOTICE 'Column is_extreme_config_disabled added successfully';
    ELSE
        RAISE NOTICE 'Column is_extreme_config_disabled already exists';
    END IF;
END $$;
