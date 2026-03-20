import { supabase } from '../supabaseClient.js'
import {
  getBattleDateKeyWithCutoff,
  getCurrentBattleDateKey,
  getNextCutoffIso,
} from './duelDayUtils.js'

const E2E_AUTH_BYPASS_ENABLED = import.meta.env.VITE_E2E_AUTH_BYPASS === 'true'
const PENDING_SCENARIO_STORAGE_KEY = 'ligaJugador:e2ePendingScenario'
const DAILY_DUEL_STAGES = ['SW_Duel_1v1', 'CW_Duel_1v1']
const DAILY_LINKED_STATUSES = new Set(['LINKED', 'CONFIRMED', 'OVERRIDDEN', 'OVERRIDEN'])

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
      stage,
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

  const rows = await filterOutLinkedDailyPending(data ?? [])
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

  const enriched = await enrichDailyRivalsFromLinkedBattles(mapped)

  let filtered = filterByType(enriched, filterType)
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

  const { data, error } = await supabase
    .from('scheduled_match')
    .select('scheduled_match_id, type, stage')
    .eq('season_id', activeSeason.season_id)
    .or(`player_a_id.eq.${playerId},player_b_id.eq.${playerId}`)
    .eq('status', 'PENDING')

  if (error) throw error

  const rows = await filterOutLinkedDailyPending(data ?? [])

  const virtualDaily = await shouldInjectVirtualDailyPending(activeSeason, playerId)
  return rows.length + (virtualDaily ? 1 : 0)
}
