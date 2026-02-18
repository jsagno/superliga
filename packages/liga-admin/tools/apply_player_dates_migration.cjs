const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  console.log('Adding start_date and end_date columns to season_zone_team_player...\n');

  const sql = `
-- Add start_date and end_date columns to season_zone_team_player table
ALTER TABLE season_zone_team_player 
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE;

-- Add check constraint: end_date must be after start_date
ALTER TABLE season_zone_team_player
DROP CONSTRAINT IF EXISTS check_start_end_dates;

ALTER TABLE season_zone_team_player
ADD CONSTRAINT check_start_end_dates 
CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date);

-- Add comments
COMMENT ON COLUMN season_zone_team_player.start_date IS 'Fecha de inicio del jugador en el equipo para esta temporada';
COMMENT ON COLUMN season_zone_team_player.end_date IS 'Fecha de fin del jugador en el equipo (NULL = activo)';
  `;

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.error('Error executing migration:', error);
      console.log('\nYou may need to run the SQL manually. Check tools/add_player_dates.sql');
      process.exit(1);
    }

    console.log('✓ Migration applied successfully!');
    console.log('\nChanges made:');
    console.log('- Added start_date column (DATE)');
    console.log('- Added end_date column (DATE)');
    console.log('- Added check constraint for date validation');
    console.log('\nNote: Existing records will have NULL dates. You can set them manually in the UI.');
    
  } catch (err) {
    console.error('Unexpected error:', err);
    console.log('\nPlease run the SQL manually from tools/add_player_dates.sql');
    process.exit(1);
  }
}

applyMigration();
