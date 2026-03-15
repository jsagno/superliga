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

  return { linkedCount: battleIds.length }
}
