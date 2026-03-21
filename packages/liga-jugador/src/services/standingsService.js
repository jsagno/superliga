import { supabase } from '../supabaseClient.js'

const E2E_AUTH_BYPASS_ENABLED = import.meta.env.VITE_E2E_AUTH_BYPASS === 'true'
const STANDINGS_SCENARIO_STORAGE_KEY = 'ligaJugador:e2eStandingsScenario'
const E2E_PLAYER_ID = import.meta.env.VITE_E2E_PLAYER_ID ?? 'e2e-player'

function createFixtureRow({
  playerId,
  position,
  pointsTotal,
  wins,
  losses,
  deltaPosition,
  league,
  zoneId,
  zoneName,
  teamName,
  nick,
  name,
  currentTag,
  initialPoints = 0,
  bonusPoints = 0,
  duelsPoints = 0,
  cupPoints = 0,
}) {
  return {
    playerId,
    position,
    pointsTotal,
    wins,
    losses,
    deltaPosition,
    league,
    zoneId,
    zoneName,
    teamName,
    teamLogo: null,
    name,
    nick,
    currentTag,
    rankingSeed: position,
    initialPoints,
    bonusPoints,
    duelsPoints,
    cupPoints,
  }
}

function buildZoneRows(zoneId, zoneName, league, count, offset = 0) {
  return Array.from({ length: count }, (_, index) => {
    const position = index + 1
    const wins = Math.max(0, 14 - position + offset)
    const losses = Math.max(0, position - 1)
    return createFixtureRow({
      playerId: `${zoneId}-player-${position}`,
      position,
      pointsTotal: 42 - position - offset,
      wins,
      losses,
      deltaPosition: position % 3 === 0 ? 0 : position % 2 === 0 ? -1 : 1,
      league,
      zoneId,
      zoneName,
      teamName: `Clan ${zoneName.split(' ').pop()}`,
      nick: `${zoneName.replace('Zona ', 'Z')}${position}`,
      name: `Jugador ${zoneName} ${position}`,
      currentTag: `#TAG${String(position + offset).padStart(4, '0')}`,
    })
  })
}

const FIXTURE_ZONE_1 = buildZoneRows('zone-1', 'Zona 1', 'A', 8, 0)
const FIXTURE_ZONE_2 = buildZoneRows('zone-2', 'Zona 2', 'B', 8, 10)
const FIXTURE_ZONE_3 = buildZoneRows('zone-3', 'Zona 3', 'A', 16, 20)
const FIXTURE_ZONE_4 = buildZoneRows('zone-4', 'Zona 4', 'B', 8, 30)

FIXTURE_ZONE_3[11] = createFixtureRow({
  playerId: E2E_PLAYER_ID,
  position: 12,
  pointsTotal: 19,
  wins: 8,
  losses: 6,
  deltaPosition: 2,
  league: 'A',
  zoneId: 'zone-3',
  zoneName: 'Zona 3',
  teamName: 'Berserk',
  nick: 'Rauldaggs',
  name: 'Raul Daggs',
  currentTag: '#PLYR0001',
})

const FIXTURE_LEAGUE_A = [
  createFixtureRow({
    playerId: 'league-a-1',
    position: 1,
    pointsTotal: 48,
    wins: 16,
    losses: 1,
    deltaPosition: 1,
    league: 'A',
    zoneId: 'zone-1',
    zoneName: 'Zona 1',
    teamName: 'Lions',
    nick: 'Apex',
    name: 'Apex Prime',
    currentTag: '#A0001',
  }),
  createFixtureRow({
    playerId: 'league-a-2',
    position: 2,
    pointsTotal: 44,
    wins: 15,
    losses: 2,
    deltaPosition: 0,
    league: 'A',
    zoneId: 'zone-3',
    zoneName: 'Zona 3',
    teamName: 'Berserk',
    nick: 'Pifast',
    name: 'Pifast',
    currentTag: '#A0002',
  }),
  createFixtureRow({
    playerId: 'league-a-3',
    position: 3,
    pointsTotal: 39,
    wins: 13,
    losses: 4,
    deltaPosition: -1,
    league: 'A',
    zoneId: 'zone-1',
    zoneName: 'Zona 1',
    teamName: 'Anubis',
    nick: 'Justin',
    name: 'Justin',
    currentTag: '#A0003',
  }),
  createFixtureRow({
    playerId: E2E_PLAYER_ID,
    position: 9,
    pointsTotal: 21,
    wins: 8,
    losses: 6,
    deltaPosition: 2,
    league: 'A',
    zoneId: 'zone-3',
    zoneName: 'Zona 3',
    teamName: 'Berserk',
    nick: 'Rauldaggs',
    name: 'Raul Daggs',
    currentTag: '#PLYR0001',
  }),
  createFixtureRow({
    playerId: 'league-a-10',
    position: 10,
    pointsTotal: 20,
    wins: 7,
    losses: 7,
    deltaPosition: 0,
    league: 'A',
    zoneId: 'zone-3',
    zoneName: 'Zona 3',
    teamName: 'Titans',
    nick: 'Orcoxx',
    name: 'Orcoxx',
    currentTag: '#A0010',
  }),
]

const FIXTURE_LEAGUE_B = [
  createFixtureRow({
    playerId: 'league-b-1',
    position: 1,
    pointsTotal: 41,
    wins: 14,
    losses: 2,
    deltaPosition: 1,
    league: 'B',
    zoneId: 'zone-2',
    zoneName: 'Zona 2',
    teamName: 'Oracles',
    nick: 'Nova',
    name: 'Nova',
    currentTag: '#B0001',
  }),
  createFixtureRow({
    playerId: 'league-b-2',
    position: 2,
    pointsTotal: 38,
    wins: 13,
    losses: 3,
    deltaPosition: 0,
    league: 'B',
    zoneId: 'zone-4',
    zoneName: 'Zona 4',
    teamName: 'Sharks',
    nick: 'Mako',
    name: 'Mako',
    currentTag: '#B0002',
  }),
  createFixtureRow({
    playerId: 'league-b-3',
    position: 3,
    pointsTotal: 35,
    wins: 12,
    losses: 4,
    deltaPosition: -1,
    league: 'B',
    zoneId: 'zone-2',
    zoneName: 'Zona 2',
    teamName: 'Ravens',
    nick: 'Shade',
    name: 'Shade',
    currentTag: '#B0003',
  }),
]

const FIXTURE_LEAGUE_C = [
  createFixtureRow({
    playerId: E2E_PLAYER_ID,
    position: 1,
    pointsTotal: 28,
    wins: 9,
    losses: 3,
    deltaPosition: 1,
    league: 'C',
    zoneId: 'zone-3',
    zoneName: 'Zona 3',
    teamName: 'Berserk',
    nick: 'Rauldaggs',
    name: 'Raul Daggs',
    currentTag: '#PLYR0001',
    duelsPoints: 7,
    cupPoints: 2,
  }),
  createFixtureRow({
    playerId: 'league-c-2',
    position: 2,
    pointsTotal: 24,
    wins: 8,
    losses: 4,
    deltaPosition: 0,
    league: 'C',
    zoneId: 'zone-3',
    zoneName: 'Zona 3',
    teamName: 'Guardians',
    nick: 'Nico',
    name: 'Nico',
    currentTag: '#C0002',
    duelsPoints: 6,
  }),
]

const E2E_STANDINGS_FIXTURE = {
  seasons: [
    { seasonId: 'season-1', description: 'Temporada 7', status: 'ACTIVE' },
    { seasonId: 'season-0', description: 'Temporada 6', status: 'CLOSED' },
  ],
  zones: {
    'season-1': [
      { zoneId: 'zone-1', name: 'Zona 1', zoneOrder: 1 },
      { zoneId: 'zone-2', name: 'Zona 2', zoneOrder: 2 },
      { zoneId: 'zone-3', name: 'Zona 3', zoneOrder: 3 },
      { zoneId: 'zone-4', name: 'Zona 4', zoneOrder: 4 },
    ],
    'season-0': [
      { zoneId: 'legacy-zone-1', name: 'Zona 1', zoneOrder: 1 },
      { zoneId: 'legacy-zone-2', name: 'Zona 2', zoneOrder: 2 },
    ],
  },
  playerContext: {
    'season-1': {
      playerId: E2E_PLAYER_ID,
      zoneId: 'zone-3',
      zoneName: 'Zona 3',
      league: 'A',
      teamId: 'team-berserk',
      teamName: 'Berserk',
      teamLogo: null,
    },
    'season-0': {
      playerId: E2E_PLAYER_ID,
      zoneId: 'legacy-zone-1',
      zoneName: 'Zona 1',
      league: 'B',
      teamId: 'team-legacy',
      teamName: 'Legacy',
      teamLogo: null,
    },
  },
  zoneRows: {
    'season-1': [...FIXTURE_ZONE_1, ...FIXTURE_ZONE_2, ...FIXTURE_ZONE_3, ...FIXTURE_ZONE_4],
    'season-0': [
      createFixtureRow({
        playerId: E2E_PLAYER_ID,
        position: 4,
        pointsTotal: 18,
        wins: 6,
        losses: 5,
        deltaPosition: 1,
        league: 'B',
        zoneId: 'legacy-zone-1',
        zoneName: 'Zona 1',
        teamName: 'Legacy',
        nick: 'Rauldaggs',
        name: 'Raul Daggs',
        currentTag: '#PLYR0001',
      }),
    ],
  },
  leagueRows: {
    'season-1:A': FIXTURE_LEAGUE_A,
    'season-1:B': FIXTURE_LEAGUE_B,
    'season-0:A': [],
    'season-0:B': [
      createFixtureRow({
        playerId: E2E_PLAYER_ID,
        position: 2,
        pointsTotal: 22,
        wins: 7,
        losses: 4,
        deltaPosition: 0,
        league: 'B',
        zoneId: 'legacy-zone-1',
        zoneName: 'Zona 1',
        teamName: 'Legacy',
        nick: 'Rauldaggs',
        name: 'Raul Daggs',
        currentTag: '#PLYR0001',
      }),
    ],
  },
  teamRows: {
    'season-1:zone-1': [
      {
        teamId: 'team-lions',
        zoneId: 'zone-1',
        position: 1,
        pointsTotal: 52,
        wins: 17,
        losses: 3,
        deltaPosition: 1,
        name: 'Lions',
        logo: null,
      },
      {
        teamId: 'team-anubis',
        zoneId: 'zone-1',
        position: 2,
        pointsTotal: 49,
        wins: 16,
        losses: 4,
        deltaPosition: 0,
        name: 'Anubis',
        logo: null,
      },
      {
        teamId: 'team-ravens',
        zoneId: 'zone-1',
        position: 3,
        pointsTotal: 43,
        wins: 14,
        losses: 6,
        deltaPosition: -1,
        name: 'Ravens',
        logo: null,
      },
      {
        teamId: 'team-sharks',
        zoneId: 'zone-1',
        position: 4,
        pointsTotal: 38,
        wins: 12,
        losses: 8,
        deltaPosition: 1,
        name: 'Sharks',
        logo: null,
      },
    ],
    'season-1:zone-2': [
      {
        teamId: 'team-oracles',
        zoneId: 'zone-2',
        position: 1,
        pointsTotal: 31,
        wins: 11,
        losses: 5,
        deltaPosition: 0,
        name: 'Oracles',
        logo: null,
      },
      {
        teamId: 'team-titans',
        zoneId: 'zone-2',
        position: 2,
        pointsTotal: 29,
        wins: 10,
        losses: 6,
        deltaPosition: 1,
        name: 'Titans',
        logo: null,
      },
    ],
    'season-1:zone-3': [
      {
        teamId: 'team-berserk',
        zoneId: 'zone-3',
        position: 1,
        pointsTotal: 55,
        wins: 18,
        losses: 2,
        deltaPosition: 2,
        name: 'Berserk',
        logo: null,
      },
      {
        teamId: 'team-lions-blue',
        zoneId: 'zone-3',
        position: 2,
        pointsTotal: 47,
        wins: 15,
        losses: 5,
        deltaPosition: 0,
        name: 'Lions Blue',
        logo: null,
      },
      {
        teamId: 'team-guardians',
        zoneId: 'zone-3',
        position: 3,
        pointsTotal: 45,
        wins: 15,
        losses: 5,
        deltaPosition: -1,
        name: 'Guardians',
        logo: null,
      },
      {
        teamId: 'team-titans-red',
        zoneId: 'zone-3',
        position: 4,
        pointsTotal: 36,
        wins: 11,
        losses: 9,
        deltaPosition: 1,
        name: 'Titans Red',
        logo: null,
      },
    ],
    'season-1:zone-4': [
      {
        teamId: 'team-sentinels',
        zoneId: 'zone-4',
        position: 1,
        pointsTotal: 41,
        wins: 13,
        losses: 4,
        deltaPosition: 1,
        name: 'Sentinels',
        logo: null,
      },
      {
        teamId: 'team-hydra',
        zoneId: 'zone-4',
        position: 2,
        pointsTotal: 34,
        wins: 10,
        losses: 7,
        deltaPosition: -1,
        name: 'Hydra',
        logo: null,
      },
      {
        teamId: 'team-onyx',
        zoneId: 'zone-4',
        position: 3,
        pointsTotal: 30,
        wins: 9,
        losses: 8,
        deltaPosition: 0,
        name: 'Onyx',
        logo: null,
      },
    ],
  },
}

const E2E_STANDINGS_SCENARIOS = {
  default: E2E_STANDINGS_FIXTURE,
  'liga-c-default': {
    ...E2E_STANDINGS_FIXTURE,
    playerContext: {
      ...E2E_STANDINGS_FIXTURE.playerContext,
      'season-1': {
        ...E2E_STANDINGS_FIXTURE.playerContext['season-1'],
        league: 'C',
      },
    },
    leagueRows: {
      ...E2E_STANDINGS_FIXTURE.leagueRows,
      'season-1:C': FIXTURE_LEAGUE_C,
    },
  },
}

function getE2EStandingsScenario() {
  if (!E2E_AUTH_BYPASS_ENABLED || typeof window === 'undefined') return null
  return window.localStorage.getItem(STANDINGS_SCENARIO_STORAGE_KEY) ?? 'default'
}

function getActiveStandingsFixture() {
  const scenario = getE2EStandingsScenario()
  if (!scenario) return null
  return E2E_STANDINGS_SCENARIOS[scenario] ?? E2E_STANDINGS_FIXTURE
}

function getFixtureRowsForStandings({ seasonId, zoneId, scope, league }) {
  const fixture = getActiveStandingsFixture() ?? E2E_STANDINGS_FIXTURE
  if (scope === 'LEAGUE') {
    const rows = fixture.leagueRows[`${seasonId}:${league}`] ?? []
    if (!zoneId) return rows
    return rows.filter((row) => row.zoneId === zoneId)
  }

  const allRows = fixture.zoneRows[seasonId] ?? []
  if (!zoneId) return allRows
  return allRows.filter((row) => row.zoneId === zoneId)
}

function normalizeSeason(season) {
  return {
    seasonId: season.season_id,
    description: season.description,
    status: season.status,
  }
}

function normalizeZone(zone) {
  return {
    zoneId: zone.zone_id,
    name: zone.name,
    zoneOrder: zone.zone_order ?? 0,
    lastSnapshotAt: zone.last_snapshot_at ?? null,
  }
}

function sortAssignments(rows) {
  return [...rows].sort((left, right) => {
    const leftHasOpenEnd = !left.end_date
    const rightHasOpenEnd = !right.end_date

    if (leftHasOpenEnd !== rightHasOpenEnd) {
      return leftHasOpenEnd ? -1 : 1
    }

    const leftStart = left.start_date ? new Date(left.start_date).getTime() : 0
    const rightStart = right.start_date ? new Date(right.start_date).getTime() : 0
    return rightStart - leftStart
  })
}

export async function fetchSeasons() {
  if (getE2EStandingsScenario()) {
    return (getActiveStandingsFixture() ?? E2E_STANDINGS_FIXTURE).seasons
  }

  const { data, error } = await supabase
    .from('season')
    .select('season_id, description, status, created_at')
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? [])
    .map(normalizeSeason)
    .sort((left, right) => {
      if (left.status === right.status) return 0
      if (left.status === 'ACTIVE') return -1
      if (right.status === 'ACTIVE') return 1
      return 0
    })
}

export async function fetchSeasonZones(seasonId) {
  if (getE2EStandingsScenario()) {
    return (getActiveStandingsFixture() ?? E2E_STANDINGS_FIXTURE).zones[seasonId] ?? []
  }

  const { data, error } = await supabase
    .from('season_zone')
    .select('zone_id, name, zone_order, created_at, last_snapshot_at')
    .eq('season_id', seasonId)
    .order('zone_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data ?? []).map(normalizeZone)
}

export async function fetchPlayerSeasonContext(playerId, seasonId) {
  if (getE2EStandingsScenario()) {
    return (getActiveStandingsFixture() ?? E2E_STANDINGS_FIXTURE).playerContext[seasonId] ?? null
  }

  const { data, error } = await supabase
    .from('season_zone_team_player')
    .select(`
      player_id,
      zone_id,
      team_id,
      league,
      start_date,
      end_date,
      team:team_id ( team_id, name, logo ),
      season_zone!zone_id!inner ( season_id, zone_id, name )
    `)
    .eq('player_id', playerId)
    .eq('season_zone.season_id', seasonId)

  if (error) throw error

  const assignment = sortAssignments(data ?? [])[0]
  if (!assignment) return null

  return {
    playerId: assignment.player_id,
    zoneId: assignment.zone_id,
    zoneName: assignment.season_zone?.name ?? null,
    league: assignment.league ?? null,
    teamId: assignment.team_id,
    teamName: assignment.team?.name ?? null,
    teamLogo: assignment.team?.logo ?? null,
  }
}

export async function fetchPlayerStandings(seasonId, zoneId, scope, league) {
  if (getE2EStandingsScenario()) {
    return getFixtureRowsForStandings({ seasonId, zoneId, scope, league })
  }

  let query = supabase
    .from('player_standings_snapshot')
    .select(`
      season_id,
      zone_id,
      scope,
      league,
      player_id,
      position,
      points_total,
      wins,
      losses,
      ranking_seed,
      delta_position
    `)
    .eq('season_id', seasonId)
    .eq('scope', scope)
    .order('position', { ascending: true })
    .order('points_total', { ascending: false })

  if (zoneId) {
    query = query.eq('zone_id', zoneId)
  }

  if (league) {
    query = query.eq('league', league)
  }

  const { data: snapshots, error } = await query

  if (error) throw error
  if (!snapshots || snapshots.length === 0) return []

  const playerIds = [...new Set(snapshots.map((row) => row.player_id).filter(Boolean))]
  const zoneIds = [...new Set(snapshots.map((row) => row.zone_id).filter(Boolean))]

  const [playersResult, tagsResult, assignmentsResult, zonesResult, ledgerResult] = await Promise.all([
    supabase.from('player').select('player_id, name, nick').in('player_id', playerIds),
    supabase.from('v_player_current_tag').select('player_id, player_tag').in('player_id', playerIds),
    supabase
      .from('season_zone_team_player')
      .select(`
        player_id,
        zone_id,
        league,
        ranking_seed,
        team_id,
        start_date,
        end_date,
        initial_points,
        team:team_id ( team_id, name, logo )
      `)
      .in('player_id', playerIds)
      .in('zone_id', zoneIds),
    supabase.from('season_zone').select('zone_id, name').in('zone_id', zoneIds),
    supabase
      .from('points_ledger')
      .select('player_id, source_type, points')
      .eq('season_id', seasonId)
      .eq('scope', 'PLAYER')
      .in('player_id', playerIds)
      .in('zone_id', zoneIds),
  ])

  if (playersResult.error) throw playersResult.error
  if (tagsResult.error) throw tagsResult.error
  if (assignmentsResult.error) throw assignmentsResult.error
  if (zonesResult.error) throw zonesResult.error
  if (ledgerResult.error) throw ledgerResult.error

  const playersById = new Map((playersResult.data ?? []).map((player) => [player.player_id, player]))
  const tagsById = new Map((tagsResult.data ?? []).map((tag) => [tag.player_id, tag.player_tag]))
  const zonesById = new Map((zonesResult.data ?? []).map((row) => [row.zone_id, row.name]))

  // Process ledger breakdown per player per source_type
  const ledgerByPlayer = {}
  for (const row of (ledgerResult.data ?? [])) {
    if (!ledgerByPlayer[row.player_id]) ledgerByPlayer[row.player_id] = {}
    const key = row.source_type
    ledgerByPlayer[row.player_id][key] = (ledgerByPlayer[row.player_id][key] || 0) + (row.points || 0)
  }

  const assignmentsByPlayerZone = new Map()
  for (const assignment of sortAssignments(assignmentsResult.data ?? [])) {
    const key = `${assignment.player_id}:${assignment.zone_id}`
    if (!assignmentsByPlayerZone.has(key)) {
      assignmentsByPlayerZone.set(key, assignment)
    }
  }

  return snapshots.map((row) => {
    const player = playersById.get(row.player_id)
    const assignment = assignmentsByPlayerZone.get(`${row.player_id}:${row.zone_id}`)
    const ld = ledgerByPlayer[row.player_id] || {}
    const initialPts = assignment?.initial_points ?? 0
    
    return {
      playerId: row.player_id,
      position: row.position,
      pointsTotal: row.points_total,
      wins: row.wins,
      losses: row.losses,
      deltaPosition: row.delta_position ?? 0,
      league: row.league ?? assignment?.league ?? null,
      zoneId: row.zone_id,
      zoneName: zonesById.get(row.zone_id) ?? null,
      teamName: assignment?.team?.name ?? null,
      teamLogo: assignment?.team?.logo ?? null,
      name: player?.name ?? 'Jugador',
      nick: player?.nick ?? null,
      currentTag: tagsById.get(row.player_id) ?? null,
      rankingSeed: row.ranking_seed ?? assignment?.ranking_seed ?? null,
      // Points breakdown
      initialPoints: initialPts,
      bonusPoints: ld['LIGA_BONUS'] || 0,
      duelsPoints: ld['CW_DAILY'] || 0,
      cupPoints: (ld['COPA_LIGA'] || 0) + (ld['COPA_REVENGE'] || 0),
    }
  })
}

export async function fetchTeamStandings(seasonId, zoneId) {
  if (getE2EStandingsScenario()) {
    return E2E_STANDINGS_FIXTURE.teamRows[`${seasonId}:${zoneId}`] ?? []
  }

  const { data: standings, error } = await supabase
    .from('team_standings_snapshot')
    .select('team_id, zone_id, position, points_total, wins, losses, delta_position')
    .eq('season_id', seasonId)
    .eq('zone_id', zoneId)
    .order('position', { ascending: true })

  if (error) throw error
  if (!standings || standings.length === 0) return []

  const teamIds = [...new Set(standings.map((row) => row.team_id).filter(Boolean))]
  const { data: teams, error: teamsError } = await supabase
    .from('team')
    .select('team_id, name, logo')
    .in('team_id', teamIds)

  if (teamsError) throw teamsError

  const teamsById = new Map((teams ?? []).map((team) => [team.team_id, team]))

  return standings.map((row) => ({
    teamId: row.team_id,
    zoneId: row.zone_id,
    position: row.position,
    pointsTotal: row.points_total,
    wins: row.wins,
    losses: row.losses,
    deltaPosition: row.delta_position ?? 0,
    name: teamsById.get(row.team_id)?.name ?? 'Equipo',
    logo: teamsById.get(row.team_id)?.logo ?? null,
  }))
}