-- Schema Comparison Report: Local vs Production Requirements
-- Purpose: Verify that local database schema matches production

-- Note: If you see this running locally, it's checking the current structure
-- To fully sync, run: supabase db push

DO $$ 
DECLARE
  v_local_table_count INTEGER;
  v_production_tables TEXT;
BEGIN
  -- Count local tables
  SELECT COUNT(*) INTO v_local_table_count
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
  
  RAISE NOTICE 'Local database has % tables in public schema', v_local_table_count;
  
  -- List all tables with column count
  RAISE NOTICE 'Table Structure:';
  FOR v_production_tables IN
    SELECT format('  - %s (%s columns)', t.tablename, COUNT(*))
    FROM pg_tables t
    LEFT JOIN information_schema.columns c ON c.table_name = t.tablename AND c.table_schema = t.schemaname
    WHERE t.schemaname = 'public'
    GROUP BY t.tablename
    ORDER BY t.tablename
  LOOP
    RAISE NOTICE '%', v_production_tables;
  END LOOP;
END
$$;

-- Report required tables for CRON auto-linking feature
SELECT 'REQUIRED TABLES FOR CRON AUTO-LINKING' as section;

-- Check critical tables exist
SELECT 
  t.tablename as table_name,
  CASE WHEN t.tablename IS NOT NULL THEN '✓ EXISTS' ELSE '✗ MISSING' END as status,
  COUNT(c.column_name) as column_count
FROM (
  VALUES 
    ('scheduled_match'),
    ('scheduled_match_battle_link'),
    ('scheduled_match_result'),
    ('battle'),
    ('battle_round'),
    ('battle_round_player'),
    ('season'),
    ('season_zone_team_player'),
    ('admin_user')
) AS required_tables(name)
LEFT JOIN pg_tables t ON t.tablename = required_tables.name AND t.schemaname = 'public'
LEFT JOIN information_schema.columns c ON c.table_name = t.tablename AND c.table_schema = 'public'
GROUP BY t.tablename, required_tables.name
ORDER BY required_tables.name;

-- Check specific columns needed for auto-linking
SELECT 'REQUIRED COLUMNS FOR CRON AUTO-LINKING' as section;

-- scheduled_match columns
SELECT 
  'scheduled_match' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'scheduled_match'
  AND column_name IN ('scheduled_match_id', 'season_id', 'player_a_id', 'type', 'status', 'score_a', 'score_b')
ORDER BY table_name, column_name;

-- scheduled_match_battle_link columns
SELECT 
  'scheduled_match_battle_link' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'scheduled_match_battle_link'
  AND column_name IN ('schedule_match_battle_link_id', 'scheduled_match_id', 'battle_id', 'linked_by_admin')
ORDER BY table_name, column_name;

-- scheduled_match_result columns
SELECT 
  'scheduled_match_result' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'scheduled_match_result'
  AND column_name IN ('scheduled_match_result_id', 'scheduled_match_id', 'final_score_a', 'final_score_b', 'points_a', 'points_b', 'decided_by')
ORDER BY table_name, column_name;

-- season columns
SELECT 
  'season' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'season'
  AND column_name IN ('season_id', 'status', 'battle_cutoff_minutes', 'is_extreme_config_disabled')
ORDER BY table_name, column_name;

-- admin_user columns
SELECT 
  'admin_user' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'admin_user'
  AND column_name IN ('user_id', 'created_at')
ORDER BY table_name, column_name;

-- Final status
SELECT 'SYNC STATUS' as section;
SELECT 
  CASE 
    WHEN COUNT(*) = 9 THEN '✓ ALL REQUIRED TABLES PRESENT'
    ELSE '✗ SOME TABLES MISSING - Run: supabase db push'
  END as status
FROM (
  SELECT 'scheduled_match' as table_name WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'scheduled_match')
  UNION
  SELECT 'scheduled_match_battle_link' WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'scheduled_match_battle_link')
  UNION
  SELECT 'scheduled_match_result' WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'scheduled_match_result')
  UNION
  SELECT 'battle' WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'battle')
  UNION
  SELECT 'battle_round' WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'battle_round')
  UNION
  SELECT 'battle_round_player' WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'battle_round_player')
  UNION
  SELECT 'season' WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'season')
  UNION
  SELECT 'season_zone_team_player' WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'season_zone_team_player')
  UNION
  SELECT 'admin_user' WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_user')
) t;
