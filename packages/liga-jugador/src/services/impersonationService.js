import { supabase } from '../supabaseClient.js'

/**
 * Fetches the most recent selectable seasons (up to 10).
 * Returns [{ id, name }] ordered by most recent first.
 */
export async function fetchSelectableSeasons() {
  const { data, error } = await supabase
    .from('season')
    .select('id, name')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) throw error
  return data ?? []
}

/**
 * Fetches valid players in a season roster from season_zone_team_player
 * joined with player profile data.
 * Returns [{ playerId, name, nick, teamName, zoneName }] ordered by name.
 */
export async function fetchSeasonPlayers(seasonId) {
  const { data, error } = await supabase
    .from('season_zone_team_player')
    .select(`
      player_id,
      player:player_id ( name, nick ),
      team:team_id ( name ),
      season_zone:season_zone_id ( zone:zone_id ( name ) )
    `)
    .eq('season_id', seasonId)

  if (error) throw error

  // De-duplicate by player_id (a player can appear in multiple teams/zones across seasons)
  const seen = new Set()
  const rows = []
  for (const row of data ?? []) {
    if (seen.has(row.player_id)) continue
    seen.add(row.player_id)
    rows.push({
      playerId: row.player_id,
      name: row.player?.name ?? '—',
      nick: row.player?.nick ?? null,
      teamName: row.team?.name ?? null,
      zoneName: row.season_zone?.zone?.name ?? null,
    })
  }

  rows.sort((a, b) => a.name.localeCompare(b.name))
  return rows
}
