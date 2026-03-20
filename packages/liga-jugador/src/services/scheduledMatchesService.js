import { supabase } from '../supabaseClient.js'
import {
  getBattleDateKeyWithCutoff,
  getCurrentBattleDateKey,
  getNextCutoffIso,
} from './duelDayUtils.js'

const E2E_AUTH_BYPASS_ENABLED = import.meta.env.VITE_E2E_AUTH_BYPASS === 'true'
const PENDING_SCENARIO_STORAGE_KEY = 'ligaJugador:e2ePendingScenario'

const FIXTURE_PENDING = [
  {
    scheduledMatchId: 'sm-101',
    type: 'CW_DAILY',
    deadlineAt: '2026-03-20T18:00:00.000Z',
    scheduledFrom: '2026-03-18T12:00:00.000Z',
    scheduledTo: '2026-03-20T18:00:00.000Z',
    rivalName: 'Rival Uno',
    competitionName: 'Duelo Diario',
    status: 'PENDING',
  },
  {
    scheduledMatchId: 'sm-102',
    type: 'CUP_MATCH',
    deadlineAt: '2026-03-21T18:00:00.000Z',
    scheduledFrom: '2026-03-19T10:00:00.000Z',
    scheduledTo: '2026-03-21T18:00:00.000Z',
    rivalName: 'Rival Dos',
    competitionName: 'Copa de Liga',
    status: 'PENDING',
  },
  {
    scheduledMatchId: 'sm-103',
    type: 'CW_DAILY',
    deadlineAt: null,
    scheduledFrom: '2026-03-17T09:00:00.000Z',
    scheduledTo: null,
    rivalName: null,
    competitionName: 'Duelo Diario',
    status: 'PENDING',
  },
]

function getE2EPendingScenario() {
  if (!E2E_AUTH_BYPASS_ENABLED || typeof window === 'undefined') return null
  return window.localStorage.getItem(PENDING_SCENARIO_STORAGE_KEY) ?? 'default'
}

function filterByType(rows, filterType) {
  if (filterType === 'ALL') return rows
  if (filterType === 'CUP') return rows.filter((row) => row.type === 'CUP_MATCH')
  if (filterType === 'DAILY') return rows.filter((row) => row.type === 'CW_DAILY')
  return rows
}

function getFixtureRows(filterType) {
  const scenario = getE2EPendingScenario()
  if (!scenario) return null

  if (scenario === 'empty') return []
  if (scenario === 'dailyOnly') return filterByType(FIXTURE_PENDING, 'DAILY')
  if (scenario === 'cupOnly') return filterByType(FIXTURE_PENDING, 'CUP')

  return filterByType(FIXTURE_PENDING, filterType)
}

async function fetchActiveSeasonId() {
  const { data, error } = await supabase
    .from('season')
    .select('season_id, duel_start_date, duel_end_date')
    .eq('status', 'ACTIVE')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data ?? null
}

function buildVirtualDailyPending(todayKey, deadlineAt) {
  return {
    scheduledMatchId: `virtual-cw-daily-${todayKey}`,
    type: 'CW_DAILY',
    status: 'PENDING',
    deadlineAt: deadlineAt || null,
    scheduledFrom: deadlineAt || null,
    scheduledTo: deadlineAt || null,
    rivalName: null,
    competitionName: 'Duelo Diario',
    isVirtual: true,
    linkDisabled: true,
  }
}

async function shouldInjectVirtualDailyPending(activeSeason, playerId) {
  const todayKey = getCurrentBattleDateKey(activeSeason)
  const startKey = getBattleDateKeyWithCutoff(activeSeason.duel_start_date, activeSeason)
  const endKey = getBattleDateKeyWithCutoff(activeSeason.duel_end_date, activeSeason)

  if (!startKey || !endKey) return null
  if (todayKey < startKey || todayKey > endKey) return null

  const { data, error } = await supabase
    .from('scheduled_match')
    .select('scheduled_match_id, scheduled_from')
    .eq('season_id', activeSeason.season_id)
    .eq('type', 'CW_DAILY')
    .eq('stage', 'SW_Duel_1v1')
    .or(`player_a_id.eq.${playerId},player_b_id.eq.${playerId}`)
    .limit(100)

  if (error) throw error

  const hasTodayDaily = (data ?? []).some(
    (row) => getBattleDateKeyWithCutoff(row.scheduled_from, activeSeason) === todayKey,
  )
  if (hasTodayDaily) return null

  return buildVirtualDailyPending(todayKey, getNextCutoffIso(activeSeason))
}

/**
 * Returns pending scheduled matches for the authenticated player in the active season.
 * filterType: ALL | CUP | DAILY
 */
export async function fetchPendingMatches(playerId, filterType = 'ALL') {
  const fixtureRows = getFixtureRows(filterType)
  if (fixtureRows) return fixtureRows

  const activeSeason = await fetchActiveSeasonId()
  if (!activeSeason?.season_id) return []

  const { data, error } = await supabase
    .from('scheduled_match')
    .select(`
      scheduled_match_id,
      type,
      status,
      deadline_at,
      scheduled_from,
      scheduled_to,
      player_a_id,
      player_b_id,
      competition:competition_id ( name )
    `)
    .eq('season_id', activeSeason.season_id)
    .or(`player_a_id.eq.${playerId},player_b_id.eq.${playerId}`)
    .eq('status', 'PENDING')
    .order('deadline_at', { ascending: true, nullsFirst: false })
    .order('scheduled_from', { ascending: true, nullsFirst: false })

  if (error) throw error

  const rows = data ?? []
  const rivalIds = [
    ...new Set(
      rows
        .map((row) => (row.player_a_id === playerId ? row.player_b_id : row.player_a_id))
        .filter(Boolean),
    ),
  ]

  let rivalNameById = new Map()
  if (rivalIds.length > 0) {
    const { data: rivals, error: rivalsError } = await supabase
      .from('player')
      .select('player_id, name')
      .in('player_id', rivalIds)

    if (rivalsError) throw rivalsError
    rivalNameById = new Map((rivals ?? []).map((r) => [r.player_id, r.name]))
  }

  const mapped = rows.map((row) => {
    const rivalId = row.player_a_id === playerId ? row.player_b_id : row.player_a_id
    return {
      scheduledMatchId: row.scheduled_match_id,
      type: row.type,
      status: row.status,
      deadlineAt: row.deadline_at,
      scheduledFrom: row.scheduled_from,
      scheduledTo: row.scheduled_to,
      rivalName: rivalId ? rivalNameById.get(rivalId) ?? null : null,
      competitionName: row.competition?.name ?? null,
    }
  })

  let filtered = filterByType(mapped, filterType)
  if (filterType !== 'CUP') {
    const virtualDaily = await shouldInjectVirtualDailyPending(activeSeason, playerId)
    if (virtualDaily) {
      filtered = [virtualDaily, ...filtered]
    }
  }

  return filtered
}

export async function fetchPendingMatchesCount(playerId) {
  const fixtureRows = getFixtureRows('ALL')
  if (fixtureRows) return fixtureRows.length

  const activeSeason = await fetchActiveSeasonId()
  if (!activeSeason?.season_id) return 0

  const { count, error } = await supabase
    .from('scheduled_match')
    .select('scheduled_match_id', { count: 'exact', head: true })
    .eq('season_id', activeSeason.season_id)
    .or(`player_a_id.eq.${playerId},player_b_id.eq.${playerId}`)
    .eq('status', 'PENDING')

  if (error) throw error

  const virtualDaily = await shouldInjectVirtualDailyPending(activeSeason, playerId)
  return (count ?? 0) + (virtualDaily ? 1 : 0)
}
