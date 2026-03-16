import { supabase } from '../supabaseClient.js'

const E2E_AUTH_BYPASS_ENABLED = import.meta.env.VITE_E2E_AUTH_BYPASS === 'true'
const LINKING_SCENARIO_STORAGE_KEY = 'ligaJugador:e2eLinkingScenario'

const E2E_UNLINKED_FIXTURES = {
  default: [
    {
      battleId: 'battle-501',
      result: 'WIN',
      score: '2 - 1',
      battleTime: '2026-03-15T16:20:00.000Z',
      relativeTime: 'Hace 23 min',
      typeLabel: 'Duelo Diario',
      rivalName: 'Rival Uno',
    },
    {
      battleId: 'battle-502',
      result: 'LOSS',
      score: '1 - 2',
      battleTime: '2026-03-15T14:00:00.000Z',
      relativeTime: 'Hace 2 horas',
      typeLabel: 'Duelo Diario',
      rivalName: 'Rival Uno',
    },
  ],
  empty: [],
}

function getE2ELinkingScenario() {
  if (!E2E_AUTH_BYPASS_ENABLED || typeof window === 'undefined') return null
  return window.localStorage.getItem(LINKING_SCENARIO_STORAGE_KEY) ?? 'default'
}

function toRelativeTime(isoDate) {
  if (!isoDate) return 'Hace un momento'
  const diffMs = Date.now() - new Date(isoDate).getTime()
  const mins = Math.max(1, Math.floor(diffMs / 60_000))
  if (mins < 60) return `Hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Hace ${hours} hora${hours === 1 ? '' : 's'}`
  const days = Math.floor(hours / 24)
  return `Hace ${days} dia${days === 1 ? '' : 's'}`
}

export async function fetchUnlinkedBattles(matchContext, limit = 10) {
  const scenario = getE2ELinkingScenario()
  if (scenario) {
    const fixture = E2E_UNLINKED_FIXTURES[scenario] ?? E2E_UNLINKED_FIXTURES.default
    return fixture.slice(0, limit)
  }

  const { data: links, error: linksError } = await supabase
    .from('scheduled_match_battle_link')
    .select('battle_id')

  if (linksError) throw linksError

  const linkedIds = new Set((links ?? []).map((row) => row.battle_id))

  const { data: battles, error: battlesError } = await supabase
    .from('battle')
    .select('battle_id, battle_time, api_game_mode')
    .order('battle_time', { ascending: false })
    .limit(limit * 3)

  if (battlesError) throw battlesError

  return (battles ?? [])
    .filter((battle) => !linkedIds.has(battle.battle_id))
    .slice(0, limit)
    .map((battle) => ({
      battleId: battle.battle_id,
      result: 'WIN',
      score: '0 - 0',
      battleTime: battle.battle_time,
      relativeTime: toRelativeTime(battle.battle_time),
      typeLabel: matchContext?.type === 'CUP_MATCH' ? 'Copa de Liga' : 'Duelo Diario',
      rivalName: matchContext?.rivalName ?? 'Rival',
    }))
}

export async function linkBattlesToScheduledMatch(scheduledMatchId, battleIds, appUserId) {
  if (!battleIds || battleIds.length === 0) {
    throw new Error('Debes seleccionar al menos una batalla')
  }

  if (getE2ELinkingScenario()) {
    return { linkedCount: battleIds.length }
  }

  const rows = battleIds.map((battleId) => ({
    scheduled_match_id: scheduledMatchId,
    battle_id: battleId,
    linked_by_player: appUserId,
  }))

  const { error: insertError } = await supabase
    .from('scheduled_match_battle_link')
    .insert(rows)

  if (insertError) throw insertError

  const { error: updateError } = await supabase
    .from('scheduled_match')
    .update({ status: 'LINKED' })
    .eq('scheduled_match_id', scheduledMatchId)

  if (updateError) throw updateError
}

// ─── History & Stats ──────────────────────────────────────────────────────────

const E2E_HISTORY_SCENARIO_KEY = 'ligaJugador:e2eHistoryScenario'

const HISTORY_TYPE_FILTER_MAP = {
  ALL: null,
  CW_DAILY: 'CW_DAILY',
  CUP_MATCH: 'CUP_MATCH',
  REVENGE: 'REVENGE',
}

const E2E_HISTORY_FIXTURES = [
  {
    scheduledMatchId: 'sm-201',
    type: 'CW_DAILY',
    competitionName: 'Duelo Diario',
    battleTime: '2026-03-15T14:00:00.000Z',
    result: 'WIN',
    scoreA: 2,
    scoreB: 0,
    rivalName: 'Rival Uno',
    battleIds: ['battle-201'],
  },
  {
    scheduledMatchId: 'sm-202',
    type: 'CUP_MATCH',
    competitionName: 'Copa de Liga',
    battleTime: '2026-03-14T10:00:00.000Z',
    result: 'LOSS',
    scoreA: 1,
    scoreB: 2,
    rivalName: 'Rival Dos',
    battleIds: ['battle-202'],
  },
  {
    scheduledMatchId: 'sm-203',
    type: 'CW_DAILY',
    competitionName: 'Duelo Diario',
    battleTime: '2026-03-13T16:30:00.000Z',
    result: 'WIN',
    scoreA: 2,
    scoreB: 1,
    rivalName: 'Rival Tres',
    battleIds: ['battle-203'],
  },
]

const E2E_STATS_FIXTURES = {
  default: { wins: 5, losses: 2, total: 7, winRate: 71 },
  empty: { wins: 0, losses: 0, total: 0, winRate: 0 },
}

function getE2EHistoryScenario() {
  if (!E2E_AUTH_BYPASS_ENABLED || typeof window === 'undefined') return null
  return window.localStorage.getItem(E2E_HISTORY_SCENARIO_KEY) ?? 'default'
}

/**
 * Returns paginated battle history for the player in the given season.
 * typeFilter: 'ALL' | 'CW_DAILY' | 'CUP_MATCH' | 'REVENGE'
 * Returns { items, hasMore }
 */
export async function fetchPlayerBattleHistory(playerId, seasonId, { typeFilter = 'ALL', page = 0, limit = 20 } = {}) {
  const scenario = getE2EHistoryScenario()
  if (scenario !== null) {
    const all = scenario === 'empty' ? [] : E2E_HISTORY_FIXTURES
    const typed = HISTORY_TYPE_FILTER_MAP[typeFilter]
      ? all.filter((i) => i.type === HISTORY_TYPE_FILTER_MAP[typeFilter])
      : all
    const slice = typed.slice(page * limit, (page + 1) * limit)
    return { items: slice, hasMore: typed.length > (page + 1) * limit }
  }

  if (!seasonId) return { items: [], hasMore: false }

  let query = supabase
    .from('scheduled_match')
    .select(`
      scheduled_match_id,
      type,
      player_a_id,
      player_b_id,
      updated_at,
      competition:competition_id ( name ),
      links:scheduled_match_battle_link ( battle_id, battle:battle_id ( battle_time ) ),
      result:scheduled_match_result ( final_score_a, final_score_b )
    `)
    .eq('season_id', seasonId)
    .or(`player_a_id.eq.${playerId},player_b_id.eq.${playerId}`)
    .in('status', ['LINKED', 'CONFIRMED', 'OVERRIDDEN'])
    .order('updated_at', { ascending: false })
    .range(page * limit, (page + 1) * limit)

  const typeValue = HISTORY_TYPE_FILTER_MAP[typeFilter]
  if (typeValue) query = query.eq('type', typeValue)

  const { data, error } = await query
  if (error) throw error

  const rows = data ?? []
  const hasMore = rows.length > limit
  const pageRows = rows.slice(0, limit)

  // Resolve rival names
  const rivalIds = [
    ...new Set(
      pageRows
        .map((sm) => (sm.player_a_id === playerId ? sm.player_b_id : sm.player_a_id))
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

  const items = pageRows.map((sm) => {
    const isA = sm.player_a_id === playerId
    const rivalId = isA ? sm.player_b_id : sm.player_a_id
    const myScore = sm.result ? (isA ? sm.result.final_score_a : sm.result.final_score_b) : null
    const theirScore = sm.result ? (isA ? sm.result.final_score_b : sm.result.final_score_a) : null
    const battleLinks = sm.links ?? []
    const firstBattleTime = battleLinks.length > 0 ? (battleLinks[0].battle?.battle_time ?? null) : null

    let result = null
    if (myScore !== null && theirScore !== null) {
      if (myScore > theirScore) result = 'WIN'
      else if (myScore < theirScore) result = 'LOSS'
      else result = 'DRAW'
    }

    return {
      scheduledMatchId: sm.scheduled_match_id,
      type: sm.type,
      competitionName: sm.competition?.name ?? null,
      battleTime: firstBattleTime ?? sm.updated_at,
      result,
      scoreA: myScore,
      scoreB: theirScore,
      rivalName: rivalId ? rivalNameById.get(rivalId) ?? null : null,
      battleIds: battleLinks.map((l) => l.battle_id),
    }
  })

  return { items, hasMore }
}

/**
 * Returns aggregated win/loss/total/winRate for the player in the given season.
 */
export async function fetchPlayerGlobalStats(playerId, seasonId) {
  const scenario = getE2EHistoryScenario()
  if (scenario !== null) {
    return E2E_STATS_FIXTURES[scenario] ?? E2E_STATS_FIXTURES.default
  }

  if (!seasonId) return { wins: 0, losses: 0, total: 0, winRate: 0 }

  const { data, error } = await supabase
    .from('scheduled_match')
    .select(`
      scheduled_match_id,
      player_a_id,
      player_b_id,
      result:scheduled_match_result ( final_score_a, final_score_b )
    `)
    .eq('season_id', seasonId)
    .or(`player_a_id.eq.${playerId},player_b_id.eq.${playerId}`)
    .in('status', ['LINKED', 'CONFIRMED', 'OVERRIDDEN'])

  if (error) throw error

  let wins = 0
  let losses = 0
  for (const sm of data ?? []) {
    if (!sm.result) continue
    const isA = sm.player_a_id === playerId
    const myScore = isA ? sm.result.final_score_a : sm.result.final_score_b
    const theirScore = isA ? sm.result.final_score_b : sm.result.final_score_a
    if (myScore > theirScore) wins++
    else if (myScore < theirScore) losses++
  }
  const total = wins + losses
  return { wins, losses, total, winRate: total > 0 ? Math.round((wins / total) * 100) : 0 }
}

