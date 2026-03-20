import { supabase } from '../supabaseClient.js'

const E2E_AUTH_BYPASS_ENABLED = import.meta.env.VITE_E2E_AUTH_BYPASS === 'true'
const LINKING_SCENARIO_STORAGE_KEY = 'ligaJugador:e2eLinkingScenario'

const E2E_UNLINKED_FIXTURES = {
  default: [
    {
      battleId: 'battle-501',
      result: 'WIN',
      score: '2 - 1',
      scoreLeft: 2,
      scoreRight: 1,
      titleLeft: 'Jugador A',
      titleRight: 'Rival Uno',
      battleTime: '2026-03-15T16:20:00.000Z',
      relativeTime: 'Hace 23 min',
      typeLabel: 'Duelo Diario',
      rivalName: 'Rival Uno',
      apiGameMode: 'CW_BATTLE_1V1',
      apiBattleType: 'riverRaceDuelColosseum',
      roundCount: 3,
    },
    {
      battleId: 'battle-502',
      result: 'LOSS',
      score: '1 - 2',
      scoreLeft: 1,
      scoreRight: 2,
      titleLeft: 'Jugador A',
      titleRight: 'Rival Uno',
      battleTime: '2026-03-15T14:00:00.000Z',
      relativeTime: 'Hace 2 horas',
      typeLabel: 'Duelo Diario',
      rivalName: 'Rival Uno',
      apiGameMode: 'CW_BATTLE_1V1',
      apiBattleType: 'riverRaceDuelColosseum',
      roundCount: 3,
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

async function fetchScheduledMatchContext(scheduledMatchId) {
  const { data, error } = await supabase
    .from('scheduled_match')
    .select(
      'scheduled_match_id, season_id, competition_id, stage, type, player_a_id, player_b_id, scheduled_from, scheduled_to',
    )
    .eq('scheduled_match_id', scheduledMatchId)
    .maybeSingle()

  if (error) throw error
  return data ?? null
}

async function fetchConfiguredGameMode(match) {
  if (!match?.season_id || !match?.competition_id || !match?.stage) return null

  const { data, error } = await supabase
    .from('season_competition_config')
    .select('api_game_mode')
    .eq('season_id', match.season_id)
    .eq('competition_id', match.competition_id)
    .eq('stage', match.stage)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data?.api_game_mode ?? null
}

function collectValidBattleIdsByPlayers(rounds, roundPlayers, playerAId, playerBId) {
  const playerSetByRoundId = new Map()
  for (const row of roundPlayers ?? []) {
    if (!playerSetByRoundId.has(row.battle_round_id)) {
      playerSetByRoundId.set(row.battle_round_id, new Set())
    }
    playerSetByRoundId.get(row.battle_round_id).add(row.player_id)
  }

  const playerSetByBattleId = new Map()
  for (const round of rounds ?? []) {
    const roundPlayersSet = playerSetByRoundId.get(round.battle_round_id)
    if (!roundPlayersSet) continue
    if (!playerSetByBattleId.has(round.battle_id)) {
      playerSetByBattleId.set(round.battle_id, new Set())
    }
    const battlePlayersSet = playerSetByBattleId.get(round.battle_id)
    for (const pid of roundPlayersSet) {
      battlePlayersSet.add(pid)
    }
  }

  return new Set(
    [...playerSetByBattleId.entries()]
      .filter(([, set]) => set.has(playerAId) && set.has(playerBId))
      .map(([battleId]) => battleId),
  )
}

function buildBattleDisplayData({
  battle,
  rounds,
  roundPlayers,
  playerAId,
  playerBId,
  playerNameById,
}) {
  const battleRounds = (rounds ?? []).filter((r) => r.battle_id === battle.battle_id)
  const roundNos = [...new Set(battleRounds.map((r) => r.round_no))].sort((a, b) => a - b)

  let playerAWins = 0
  let playerBWins = 0
  let playerATotalCrowns = 0
  let playerBTotalCrowns = 0

  for (const roundNo of roundNos) {
    const roundIds = battleRounds.filter((r) => r.round_no === roundNo).map((r) => r.battle_round_id)
    const roundPlayerData = (roundPlayers ?? []).filter((rp) => roundIds.includes(rp.battle_round_id))

    const playerARow = roundPlayerData.find((rp) => rp.player_id === playerAId)
    const playerBRow = roundPlayerData.find((rp) => rp.player_id === playerBId)

    let crownsA = null
    let crownsB = null

    // Prefer explicit A/B rows; fallback to opponent_crowns when only one row exists.
    if (playerARow && playerBRow) {
      crownsA = playerARow.crowns ?? 0
      crownsB = playerBRow.crowns ?? 0
    } else if (playerARow) {
      crownsA = playerARow.crowns ?? 0
      crownsB = playerARow.opponent_crowns ?? 0
    } else if (playerBRow) {
      crownsB = playerBRow.crowns ?? 0
      crownsA = playerBRow.opponent_crowns ?? 0
    }

    if (crownsA == null || crownsB == null) continue

    playerATotalCrowns += crownsA
    playerBTotalCrowns += crownsB

    if (crownsA > crownsB) playerAWins += 1
    else if (crownsB > crownsA) playerBWins += 1
  }

  const titleLeft = playerNameById.get(playerAId) ?? 'Jugador A'
  const titleRight = playerNameById.get(playerBId) ?? 'Jugador B'
  const useRounds = (battle.round_count ?? 1) > 1
  const scoreLeft = useRounds ? playerAWins : playerATotalCrowns
  const scoreRight = useRounds ? playerBWins : playerBTotalCrowns

  return {
    titleLeft,
    titleRight,
    scoreLeft,
    scoreRight,
    result: scoreLeft > scoreRight ? 'WIN' : scoreLeft < scoreRight ? 'LOSS' : 'DRAW',
    score: `${scoreLeft} - ${scoreRight}`,
  }
}

export async function fetchUnlinkedBattles(matchContext, limit = 10, viewerPlayerId = null) {
  const scenario = getE2ELinkingScenario()
  if (scenario) {
    const fixture = E2E_UNLINKED_FIXTURES[scenario] ?? E2E_UNLINKED_FIXTURES.default
    return fixture.slice(0, limit)
  }

  if (!matchContext?.scheduledMatchId) {
    return []
  }

  const scheduledMatch = await fetchScheduledMatchContext(matchContext.scheduledMatchId)
  if (!scheduledMatch?.player_a_id || !scheduledMatch?.player_b_id) {
    return []
  }

  const expectedGameMode = await fetchConfiguredGameMode(scheduledMatch)
  if (scheduledMatch.type === 'CUP_MATCH' && !expectedGameMode) {
    return []
  }

  const { data: links, error: linksError } = await supabase
    .from('scheduled_match_battle_link')
    .select('battle_id')

  if (linksError) throw linksError

  const linkedIds = new Set((links ?? []).map((row) => row.battle_id))

  let battlesQuery = supabase
    .from('battle')
    .select('battle_id, battle_time, api_game_mode, api_battle_type, round_count')
    .order('battle_time', { ascending: false })

  if (expectedGameMode) {
    battlesQuery = battlesQuery.eq('api_game_mode', expectedGameMode)
  }
  if (scheduledMatch.scheduled_from) {
    battlesQuery = battlesQuery.gte('battle_time', scheduledMatch.scheduled_from)
  }
  if (scheduledMatch.scheduled_to) {
    battlesQuery = battlesQuery.lte('battle_time', scheduledMatch.scheduled_to)
  }

  const candidatePool = Math.max(limit * 12, 60)
  const { data: battles, error: battlesError } = await battlesQuery.limit(candidatePool)

  if (battlesError) throw battlesError

  const candidateBattleIds = (battles ?? []).map((b) => b.battle_id)
  if (candidateBattleIds.length === 0) return []

  const { data: rounds, error: roundsError } = await supabase
    .from('battle_round')
    .select('battle_round_id, battle_id, round_no')
    .in('battle_id', candidateBattleIds)

  if (roundsError) throw roundsError

  const candidateRoundIds = (rounds ?? []).map((r) => r.battle_round_id)
  if (candidateRoundIds.length === 0) return []

  const { data: roundPlayers, error: roundPlayersError } = await supabase
    .from('battle_round_player')
    .select('battle_round_id, player_id, side, crowns, opponent_crowns')
    .in('battle_round_id', candidateRoundIds)
    .in('player_id', [scheduledMatch.player_a_id, scheduledMatch.player_b_id])

  if (roundPlayersError) throw roundPlayersError

  const { data: playerData, error: playerError } = await supabase
    .from('player')
    .select('player_id, name, nick')
    .in('player_id', [scheduledMatch.player_a_id, scheduledMatch.player_b_id])

  if (playerError) throw playerError

  const playerNameById = new Map(
    (playerData ?? []).map((p) => [p.player_id, p.nick || p.name || p.player_id]),
  )

  const validBattleIds = collectValidBattleIdsByPlayers(
    rounds,
    roundPlayers,
    scheduledMatch.player_a_id,
    scheduledMatch.player_b_id,
  )

  const canOrientToViewer =
    viewerPlayerId &&
    (viewerPlayerId === scheduledMatch.player_a_id || viewerPlayerId === scheduledMatch.player_b_id)

  const leftPlayerId = canOrientToViewer ? viewerPlayerId : scheduledMatch.player_a_id
  const rightPlayerId = canOrientToViewer
    ? (viewerPlayerId === scheduledMatch.player_a_id ? scheduledMatch.player_b_id : scheduledMatch.player_a_id)
    : scheduledMatch.player_b_id

  return (battles ?? [])
    .filter((battle) => !linkedIds.has(battle.battle_id) && validBattleIds.has(battle.battle_id))
    .slice(0, limit)
    .map((battle) => {
      const display = buildBattleDisplayData({
        battle,
        rounds,
        roundPlayers,
        playerAId: leftPlayerId,
        playerBId: rightPlayerId,
        playerNameById,
      })

      return {
        battleId: battle.battle_id,
        result: display.result,
        score: display.score,
        scoreLeft: display.scoreLeft,
        scoreRight: display.scoreRight,
        titleLeft: display.titleLeft,
        titleRight: display.titleRight,
        battleTime: battle.battle_time,
        relativeTime: toRelativeTime(battle.battle_time),
        typeLabel: scheduledMatch.type === 'CUP_MATCH' ? 'Copa de Liga' : 'Duelo Diario',
        rivalName: matchContext?.rivalName ?? 'Rival',
        apiGameMode: battle.api_game_mode,
        apiBattleType: battle.api_battle_type,
        roundCount: battle.round_count,
      }
    })
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
    .in('status', ['LINKED', 'CONFIRMED', 'OVERRIDDEN', 'OVERRIDEN'])
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
    .in('status', ['LINKED', 'CONFIRMED', 'OVERRIDDEN', 'OVERRIDEN'])

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

