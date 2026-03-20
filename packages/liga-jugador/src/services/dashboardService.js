// SPEC: docs/openspec/changes/liga-jugador/specs/dashboard-jugador.md
// SPEC: docs/openspec/changes/liga-jugador/tasks.md — Task 4.1

import { supabase } from '../supabaseClient.js'
import {
  getBattleDateKeyWithCutoff,
  getCurrentBattleDateKey,
  getNextCutoffIso,
} from './duelDayUtils.js'

const E2E_AUTH_BYPASS_ENABLED = import.meta.env.VITE_E2E_AUTH_BYPASS === 'true'
const DASHBOARD_SCENARIO_STORAGE_KEY = 'ligaJugador:e2eDashboardScenario'
const DAILY_DUEL_STAGES = ['SW_Duel_1v1', 'CW_Duel_1v1']
const DAILY_LINKED_STATUSES = new Set(['LINKED', 'CONFIRMED', 'OVERRIDDEN', 'OVERRIDEN'])

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
      duelEndDate: '2026-03-16',
      ladderStartDate: '2026-03-17T00:00:00.000Z',
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
      duelEndDate: '2026-03-16',
      ladderStartDate: '2026-03-17T00:00:00.000Z',
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
      duelEndDate: '2099-04-09',
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
      duelEndDate: '2026-03-16',
      ladderStartDate: '2026-03-17T00:00:00.000Z',
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
  duelsCompleted: {
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
      duelEndDate: '2026-03-16',
      ladderStartDate: '2026-03-17T00:00:00.000Z',
    },
    stats: {
      position: 1,
      wins: 16,
      losses: 0,
      winRate: 100,
      pointsTotal: 48,
      deltaPosition: 5,
    },
    pendingMatches: [],
  },
  duelsFirstDay: {
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
      duelStartDate: '2026-03-19T00:00:00.000Z',
      duelEndDate: '2026-04-03',
      ladderStartDate: '2026-04-04T00:00:00.000Z',
    },
    stats: {
      position: 10,
      wins: 0,
      losses: 0,
      winRate: 0,
      pointsTotal: 0,
      deltaPosition: 0,
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

function buildVirtualDailyPending(todayKey, deadlineAt) {
  return {
    scheduledMatchId: `virtual-cw-daily-${todayKey}`,
    type: 'CW_DAILY',
    deadlineAt: deadlineAt || null,
    scheduledFrom: deadlineAt || null,
    rivalName: null,
    competitionName: 'Duelo Diario',
    isVirtual: true,
    linkDisabled: true,
    status: 'PENDING',
  }
}

async function getResolvedDailyMatchIds(matchIds) {
  if (!matchIds || matchIds.length === 0) return new Set()

  const uniqueIds = [...new Set(matchIds.filter(Boolean))]
  if (uniqueIds.length === 0) return new Set()

  const [{ data: links, error: linksError }, { data: results, error: resultsError }] = await Promise.all([
    supabase
      .from('scheduled_match_battle_link')
      .select('scheduled_match_id')
      .in('scheduled_match_id', uniqueIds),
    supabase
      .from('scheduled_match_result')
      .select('scheduled_match_id')
      .in('scheduled_match_id', uniqueIds),
  ])

  if (linksError && resultsError) return new Set()

  const resolved = new Set()
  for (const row of links ?? []) resolved.add(row.scheduled_match_id)
  for (const row of results ?? []) resolved.add(row.scheduled_match_id)
  return resolved
}

async function filterOutLinkedDailyPending(rows) {
  const dailyRows = rows.filter((row) => row.type === 'CW_DAILY')

  if (dailyRows.length === 0) return rows

  const matchIds = dailyRows.map((row) => row.scheduled_match_id).filter(Boolean)
  if (matchIds.length === 0) return rows

  const resolvedDailyIds = await getResolvedDailyMatchIds(matchIds)
  if (resolvedDailyIds.size === 0) return rows

  return rows.filter(
    (row) => !(row.type === 'CW_DAILY' && resolvedDailyIds.has(row.scheduled_match_id)),
  )
}

async function enrichDailyRivalsFromLinkedBattles(rows) {
  const targetRows = rows.filter((r) => r.type === 'CW_DAILY' && !r.rivalName)
  if (targetRows.length === 0) return rows

  const matchIds = targetRows.map((r) => r.scheduledMatchId).filter(Boolean)
  if (matchIds.length === 0) return rows

  const { data: links, error: linksError } = await supabase
    .from('scheduled_match_battle_link')
    .select('scheduled_match_id, battle_id')
    .in('scheduled_match_id', matchIds)

  if (linksError || !links || links.length === 0) return rows

  const battleIds = [...new Set(links.map((l) => l.battle_id).filter(Boolean))]
  if (battleIds.length === 0) return rows

  const { data: battleRounds, error: roundsError } = await supabase
    .from('battle_round')
    .select('battle_round_id, battle_id')
    .in('battle_id', battleIds)

  if (roundsError || !battleRounds || battleRounds.length === 0) return rows

  const roundIds = battleRounds.map((r) => r.battle_round_id)
  const { data: roundPlayers, error: playersError } = await supabase
    .from('battle_round_player')
    .select('battle_round_id, side, opponent')
    .in('battle_round_id', roundIds)
    .eq('side', 'TEAM')

  if (playersError || !roundPlayers || roundPlayers.length === 0) return rows

  const battleOpponentName = new Map()
  for (const br of battleRounds) {
    const rp = roundPlayers.find((row) => row.battle_round_id === br.battle_round_id)
    if (!rp?.opponent) continue
    const opponentData = Array.isArray(rp.opponent) ? rp.opponent[0] : rp.opponent
    const opponentName = opponentData?.name || opponentData?.tag || null
    if (opponentName && !battleOpponentName.has(br.battle_id)) {
      battleOpponentName.set(br.battle_id, opponentName)
    }
  }

  const matchOpponentName = new Map()
  for (const link of links) {
    const name = battleOpponentName.get(link.battle_id)
    if (name && !matchOpponentName.has(link.scheduled_match_id)) {
      matchOpponentName.set(link.scheduled_match_id, name)
    }
  }

  return rows.map((row) => {
    if (row.rivalName) return row
    const fromLinked = matchOpponentName.get(row.scheduledMatchId)
    return fromLinked ? { ...row, rivalName: fromLinked } : row
  })
}

async function shouldInjectVirtualDailyPending(activeSeason, playerId) {
  const todayKey = getCurrentBattleDateKey(activeSeason)
  const startKey = getBattleDateKeyWithCutoff(activeSeason.duel_start_date, activeSeason)
  const endKey = getBattleDateKeyWithCutoff(activeSeason.duel_end_date, activeSeason)

  if (!startKey || !endKey) return null
  if (todayKey < startKey || todayKey > endKey) return null

  const { data, error } = await supabase
    .from('scheduled_match')
    .select('scheduled_match_id, scheduled_from, scheduled_to, deadline_at, status')
    .eq('season_id', activeSeason.season_id)
    .eq('type', 'CW_DAILY')
    .or(`player_a_id.eq.${playerId},player_b_id.eq.${playerId}`)
    .limit(100)

  if (error) throw error

  const nowMs = Date.now()
  const isWithinWindow = (row) => {
    const fromMs = row.scheduled_from ? new Date(row.scheduled_from).getTime() : Number.NaN
    const toMsRaw = row.scheduled_to ? new Date(row.scheduled_to).getTime() : Number.NaN
    const deadlineMs = row.deadline_at ? new Date(row.deadline_at).getTime() : Number.NaN
    const toMs = Number.isFinite(toMsRaw) ? toMsRaw : deadlineMs
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return false
    return nowMs >= fromMs && nowMs <= toMs
  }

  const todayRows = (data ?? []).filter((row) => {
    const fromKey = getBattleDateKeyWithCutoff(row.scheduled_from, activeSeason)
    const toKey = getBattleDateKeyWithCutoff(row.scheduled_to || row.deadline_at, activeSeason)
    return fromKey === todayKey || toKey === todayKey || isWithinWindow(row)
  })

  const resolvedDailyIds = await getResolvedDailyMatchIds(
    todayRows.map((row) => row.scheduled_match_id),
  )

  const hasTodayPendingDaily = todayRows.some(
    (row) => row.status === 'PENDING' && !resolvedDailyIds.has(row.scheduled_match_id),
  )
  const hasTodayLinkedDaily = todayRows.some(
    (row) => DAILY_LINKED_STATUSES.has(row.status) || resolvedDailyIds.has(row.scheduled_match_id),
  )

  if (hasTodayPendingDaily || hasTodayLinkedDaily) return null

  return buildVirtualDailyPending(todayKey, getNextCutoffIso(activeSeason))
}

async function fetchActiveSeason() {
  const { data, error } = await supabase
    .from('season')
    .select('season_id, description, duel_start_date, duel_end_date, ladder_start_date, battle_cutoff_minutes, battle_cutoff_tz_offset')
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
    duelEndDate: activeSeason.duel_end_date ?? null,
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
      stage,
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
    .limit(20)

  if (error) throw error

  const matches = await filterOutLinkedDailyPending(data ?? [])
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

  const mapped = matches.map((sm) => {
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

  const enriched = await enrichDailyRivalsFromLinkedBattles(mapped)

  const virtualDaily = await shouldInjectVirtualDailyPending(activeSeason, playerId)
  const combined = virtualDaily ? [virtualDaily, ...enriched] : enriched
  return combined.slice(0, 3)
}
