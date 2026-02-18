// src/services/playersService.js
// Service para acceso a datos de jugadores vía Supabase
import { supabase } from '../lib/supabaseClient';

export async function fetchPlayers() {
  const { data, error } = await supabase
    .from('player')
    .select('*, player_identity(*)')
    .order('nick');
  if (error) throw error;
  return data;
}
