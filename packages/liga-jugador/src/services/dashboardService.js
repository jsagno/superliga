// SPEC: docs/openspec/changes/liga-jugador/specs/dashboard-jugador.md
// SPEC: docs/openspec/changes/liga-jugador/tasks.md — Task 4.1

import { supabase } from '../supabaseClient.js'

const E2E_AUTH_BYPASS_ENABLED = import.meta.env.VITE_E2E_AUTH_BYPASS === 'true'
const DASHBOARD_SCENARIO_STORAGE_KEY = 'ligaJugador:e2eDashboardScenario'

const E2E_DASHBOARD_FIXTURES = {
  default: {
    profile: {
      playerId: 'e2e-player',
      name: 'Jugador Test',
      nick: 'JT',
      league: 'A',
      teamId: 'team-1',
      teamName: 'Berserk',
      teamLogo: null,
      zoneId: 'zone-1',
      zoneName: 'Zona 1',
      seasonId: 'season-1',
      seasonName: 'Temporada 1',
      duelStartDate: '2026-03-01T00:00:00.000Z',
      ladderStartDate: '2026-03-25T00:00:00.000Z',
    },
    stats: {
      position: 4,
      wins: 7,
      losses: 3,
      winRate: 70,
      pointsTotal: 21,
      deltaPosition: 1,
    },
    pendingMatches: [
      {
        scheduledMatchId: 'sm-1',
        type: 'CW_DAILY',
        deadlineAt: '2026-03-20T18:00:00.000Z',
        scheduledFrom: '2026-03-16T12:00:00.000Z',
        rivalName: 'Rival Uno',
        competitionName: 'Duelo Diario',
      },
      {
        scheduledMatchId: 'sm-2',
        type: 'CUP_MATCH',
        deadlineAt: '2026-03-21T18:00:00.000Z',
        scheduledFrom: '2026-03-16T14:00:00.000Z',
        rivalName: 'Rival Dos',
        competitionName: 'Copa de Liga',
      },
    ],
  },
  noPending: {
    profile: {
      playerId: 'e2e-player',
      name: 'Jugador Test',
      nick: 'JT',
      league: 'A',
      teamId: 'team-1',
      teamName: 'Berserk',
      teamLogo: null,
      zoneId: 'zone-1',
      zoneName: 'Zona 1',
      seasonId: 'season-1',
      seasonName: 'Temporada 1',
      duelStartDate: '2026-03-01T00:00:00.000Z',
      ladderStartDate: '2026-03-25T00:00:00.000Z',
    },
    stats: {
      position: 8,
      wins: 2,
      losses: 4,
      winRate: 33,
      pointsTotal: 6,
      deltaPosition: 0,
    },
    pendingMatches: [],
  },
  preDuelStart: {
    profile: {
      playerId: 'e2e-player',
      name: 'Jugador Test',
      nick: 'JT',
      league: 'A',
      teamId: 'team-1',
      teamName: 'Berserk',
      teamLogo: null,
      zoneId: 'zone-1',
      zoneName: 'Zona 1',
      seasonId: 'season-1',
      seasonName: 'Temporada 1',
      duelStartDate: '2099-03-25T00:00:00.000Z',
      ladderStartDate: '2099-04-10T00:00:00.000Z',
    },
    stats: {
      position: 6,
      wins: 4,
      losses: 2,
      winRate: 67,
      pointsTotal: 12,
      deltaPosition: 1,
    },
    pendingMatches: [],
  },
  noSeason: {
    profile: null,
    stats: null,
    pendingMatches: [],
  },
  winRateZero: {
    profile: {
      playerId: 'e2e-player',
      name: 'Jugador Test',
      nick: 'JT',
      league: 'B',
      teamId: 'team-2',
      teamName: 'Anubis',
      teamLogo: null,
      zoneId: 'zone-2',
      zoneName: 'Zona 2',
      seasonId: 'season-1',
      seasonName: 'Temporada 1',
      duelStartDate: '2026-03-01T00:00:00.000Z',
      ladderStartDate: '2026-03-25T00:00:00.000Z',
    },
    stats: {
      position: 12,
      wins: 0,
      losses: 5,
      winRate: 0,
      pointsTotal: 0,
      deltaPosition: -2,
    },
    pendingMatches: [],
  },
}

function getE2EDashboardScenario() {
  if (!E2E_AUTH_BYPASS_ENABLED || typeof window === 'undefined') return null
  return window.localStorage.getItem(DASHBOARD_SCENARIO_STORAGE_KEY) ?? null
}

function getE2EDashboardFixture() {
  const scenario = getE2EDashboardScenario()
  if (!scenario) return null
  if (scenario === 'networkError') throw new Error('E2E forced dashboard error')
  return E2E_DASHBOARD_FIXTURES[scenario] ?? E2E_DASHBOARD_FIXTURES.default
}

async function fetchActiveSeason() {
  const { data, error } = await supabase
    .from('season')
    .select('season_id, description, duel_start_date, ladder_start_date')
    .eq('status', 'ACTIVE')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data ?? null
}

/**
 * Fetches the player profile and their active-season context:
 * zone, league, team, and current Clash tag.
 *
 * Returns null if the player has no assignment in an ACTIVE season.
 */
export async function fetchPlayerProfile(playerId) {
  const fixture = getE2EDashboardFixture()
  if (fixture) return fixture.profile

  const activeSeason = await fetchActiveSeason()
  if (!activeSeason) return null

  const { data, error } = await supabase
    .from('season_zone_team_player')
    .select(`
      league,
      start_date,
      end_date,
      team_id,
      team:team_id ( name, logo ),
      season_zone!zone_id!inner (
        zone_id,
        name,
        season_id
      ),
      player:player_id ( player_id, name, nick )
    `)
    .eq('player_id', playerId)
    .eq('season_zone.season_id', activeSeason.season_id)
    .order('end_date', { ascending: true, nullsFirst: true })
    .order('start_date', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error

  if (!data) return null

  const { player, team, season_zone, league } = data

  return {
    playerId: player.player_id,
    name: player.name,
    nick: player.nick,
    league,
    teamId: data.team_id,
    teamName: team?.name ?? null,
    teamLogo: team?.logo ?? null,
    zoneId: season_zone?.zone_id ?? null,
    zoneName: season_zone?.name ?? null,
    seasonId: activeSeason.season_id,
    seasonName: activeSeason.description ?? null,
    duelStartDate: activeSeason.duel_start_date ?? null,
    ladderStartDate: activeSeason.ladder_start_date ?? null,
  }
}

/**
 * Fetches the player's stats for the active season from player_standings_snapshot.
 * Falls back to zeroed stats if no snapshot exists yet.
 */
export async function fetchPlayerStats(playerId, seasonId, zoneId, league) {
  const fixture = getE2EDashboardFixture()
  if (fixture) return fixture.stats

  let query = supabase
    .from('player_standings_snapshot')
    .select('position, points_total, wins, losses, delta_position, league, scope')
    .eq('player_id', playerId)
    .eq('season_id', seasonId)
    .eq('zone_id', zoneId)
    .eq('scope', 'ZONE')

  if (league) {
    query = query.eq('league', league)
  }

  const { data, error } = await query.maybeSingle()

  if (error) throw error

  if (!data) {
    return { position: null, wins: 0, losses: 0, winRate: 0, pointsTotal: 0, deltaPosition: 0 }
  }

  const total = data.wins + data.losses
  const winRate = total > 0 ? Math.round((data.wins / total) * 100) : 0

  return {
    position: data.position,
    wins: data.wins,
    losses: data.losses,
    winRate,
    pointsTotal: data.points_total,
    deltaPosition: data.delta_position ?? 0,
  }
}

/**
 * Fetches up to 3 pending scheduled matches for the player,
 * ordered by deadline_at ASC NULLS LAST.
 * Resolves the rival player name from the opposite player column.
 */
export async function fetchPendingMatchesSummary(playerId) {
  const fixture = getE2EDashboardFixture()
  if (fixture) return fixture.pendingMatches

  const activeSeason = await fetchActiveSeason()
  if (!activeSeason) return []

  const { data, error } = await supabase
    .from('scheduled_match')
    .select(`
      scheduled_match_id,
      type,
      deadline_at,
      scheduled_from,
      status,
      player_a_id,
      player_b_id,
      competition:competition_id ( name )
    `)
    .eq('season_id', activeSeason.season_id)
    .or(`player_a_id.eq.${playerId},player_b_id.eq.${playerId}`)
    .eq('status', 'PENDING')
    .order('deadline_at', { ascending: true, nullsFirst: false })
    .order('scheduled_from', { ascending: true, nullsFirst: false })
    .limit(3)

  if (error) throw error

  const matches = data ?? []
  const rivalIds = [
    ...new Set(
      matches
        .map((sm) => (sm.player_a_id === playerId ? sm.player_b_id : sm.player_a_id))
        .filter(Boolean),
    ),
  ]

  let playerNameById = new Map()
  if (rivalIds.length > 0) {
    const { data: rivals, error: rivalsError } = await supabase
      .from('player')
      .select('player_id, name')
      .in('player_id', rivalIds)

    if (rivalsError) throw rivalsError

    playerNameById = new Map((rivals ?? []).map((player) => [player.player_id, player.name]))
  }

  return matches.map((sm) => {
    const rivalId = sm.player_a_id === playerId ? sm.player_b_id : sm.player_a_id

    return {
      scheduledMatchId: sm.scheduled_match_id,
      type: sm.type,
      deadlineAt: sm.deadline_at,
      scheduledFrom: sm.scheduled_from,
      rivalName: rivalId ? playerNameById.get(rivalId) ?? null : null,
      competitionName: sm.competition?.name ?? null,
    }
  })
}
