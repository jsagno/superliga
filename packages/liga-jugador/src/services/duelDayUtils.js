const DEFAULT_BATTLE_CUTOFF_MINUTES = 600

function parseTzOffsetToMinutes(offsetText) {
  if (typeof offsetText !== 'string') return 0
  const match = offsetText.trim().match(/^([+-])(\d{2}):(\d{2})$/)
  if (!match) return 0
  const sign = match[1] === '-' ? -1 : 1
  const hours = Number(match[2])
  const minutes = Number(match[3])
  return sign * (hours * 60 + minutes)
}

function normalizeCutoffMinutes(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return DEFAULT_BATTLE_CUTOFF_MINUTES
  return parsed
}

function toShiftedDate(timestamp, tzOffsetMinutes) {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return null
  return new Date(date.getTime() + tzOffsetMinutes * 60_000)
}

export function getBattleDateKeyWithCutoff(timestamp, seasonConfig) {
  if (!timestamp || !seasonConfig) return null

  const tzOffsetMinutes = parseTzOffsetToMinutes(seasonConfig.battle_cutoff_tz_offset || '+00:00')
  const cutoffMinutes = normalizeCutoffMinutes(seasonConfig.battle_cutoff_minutes)

  const shifted = toShiftedDate(timestamp, tzOffsetMinutes)
  if (!shifted) return null

  shifted.setUTCMinutes(shifted.getUTCMinutes() - cutoffMinutes)
  return shifted.toISOString().split('T')[0]
}

export function getCurrentBattleDateKey(seasonConfig) {
  return getBattleDateKeyWithCutoff(new Date().toISOString(), seasonConfig)
}

export function getNextCutoffIso(seasonConfig) {
  if (!seasonConfig) return null

  const tzOffsetMinutes = parseTzOffsetToMinutes(seasonConfig.battle_cutoff_tz_offset || '+00:00')
  const cutoffMinutes = normalizeCutoffMinutes(seasonConfig.battle_cutoff_minutes)

  const nowUtc = Date.now()
  const nowLocalMs = nowUtc + tzOffsetMinutes * 60_000
  const localNow = new Date(nowLocalMs)

  const localDayStartMs = Date.UTC(
    localNow.getUTCFullYear(),
    localNow.getUTCMonth(),
    localNow.getUTCDate(),
    0,
    0,
    0,
    0,
  )

  const cutoffTodayLocalMs = localDayStartMs + cutoffMinutes * 60_000
  const cutoffTodayUtcMs = cutoffTodayLocalMs - tzOffsetMinutes * 60_000

  const nextCutoffUtcMs = nowUtc < cutoffTodayUtcMs
    ? cutoffTodayUtcMs
    : cutoffTodayUtcMs + 24 * 60 * 60 * 1000

  return new Date(nextCutoffUtcMs).toISOString()
}
