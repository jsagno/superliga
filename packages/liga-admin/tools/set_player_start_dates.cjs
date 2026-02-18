const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setStartDates() {
  console.log('Setting start_date to 2026-01-15 for all players without dates...\n');

  try {
    // First, check how many records need updating
    const { data: toUpdate, error: checkError } = await supabase
      .from('season_zone_team_player')
      .select('season_zone_team_player_id, player_id, team_id, start_date')
      .is('start_date', null);

    if (checkError) {
      console.error('Error checking records:', checkError);
      process.exit(1);
    }

    const count = toUpdate ? toUpdate.length : 0;
    console.log('Found ' + count + ' players without start_date');

    if (!toUpdate || toUpdate.length === 0) {
      console.log('✓ All players already have start dates!');
      return;
    }

    // Update all records without start_date
    const { data, error } = await supabase
      .from('season_zone_team_player')
      .update({ start_date: '2026-01-15' })
      .is('start_date', null)
      .select();

    if (error) {
      console.error('Error updating records:', error);
      process.exit(1);
    }

    const updated = data ? data.length : 0;
    console.log('✓ Successfully updated ' + updated + ' player records');
    console.log('\nAll players now have start_date = 2026-01-15');
    
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

setStartDates();
