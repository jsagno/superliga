import { createBrowserRouter, Navigate } from "react-router-dom";
import AdminLayout from "../components/AdminLayout.jsx";
import ProtectedRoute from "../components/ProtectedRoute.jsx";

import LoginAdmin from "../pages/admin/LoginAdmin.jsx";
import ResetPassword from "../pages/admin/ResetPassword.jsx";
import DashboardAdmin from "../pages/admin/DashboardAdmin.jsx";
import PlayersList from "../pages/admin/PlayersList.jsx";
import PlayerEdit from "../pages/admin/PlayerEdit.jsx";
import TeamsList from "../pages/admin/TeamsList.jsx";
import TeamEdit from "../pages/admin/TeamEdit.jsx";
import SeasonsList from "../pages/admin/SeasonsList.jsx";
import SeasonEdit from "../pages/admin/SeasonEdit.jsx";
import SeasonZones from "../pages/admin/SeasonZones.jsx";
import SeasonAssignments from "../pages/admin/SeasonAssignments.jsx";
import CupModes from "../pages/admin/SeasonCupModes.jsx";
import CaptainLeague from "../pages/admin/CaptainLeague.jsx";
import PointsManual from "../pages/admin/PointsManual.jsx";
import BattlesHistory from "../pages/admin/BattlesHistory.jsx";
import EraEdit from "../pages/admin/EraEdit.jsx";
import ErasList from "../pages/admin/ErasList.jsx";
import SeasonZoneTeams from "../pages/admin/SeasonZoneTeams.jsx";
import SeasonCupModes from "../pages/admin/SeasonCupModes.jsx";
import ScheduledMatches from "../pages/admin/ScheduledMatches.jsx";
import SeasonExtreme from "../pages/admin/SeasonExtreme.jsx";
import GroupStandings from "../pages/admin/GroupStandings.jsx";
import SeasonZoneRankings from "../pages/admin/SeasonZoneRankings.jsx";
import SeasonDailyPoints from "../pages/admin/SeasonDailyPoints.jsx";
import SeasonRestrictions from "../pages/admin/SeasonRestrictions.jsx";
import SeasonRestrictionEdit from "../pages/admin/SeasonRestrictionEdit.jsx";
import ZoneDiscordWebhooks from "../pages/admin/ZoneDiscordWebhooks.jsx";
import SeasonBonusPoints from "../pages/admin/SeasonBonusPoints.jsx";
import AdminLeagueStandings from "../pages/admin/AdminLeagueStandings.jsx";

const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/admin/login" replace /> },
  { path: "/admin/login", element: <LoginAdmin /> },
  { path: "/admin/reset-password", element: <ResetPassword /> },

  {
    path: "/admin",
    element: (
      <ProtectedRoute>
        <AdminLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardAdmin /> },
      { path: "players", element: <PlayersList /> },
      { path: "players/:playerId", element: <PlayerEdit /> },

      { path: "teams", element: <TeamsList /> },
      { path: "teams/:teamId", element: <TeamEdit /> },

      { path: "eras", element: <ErasList /> },
      { path: "eras/:eraId", element: <EraEdit /> },

      { path: "seasons", element: <SeasonsList /> },
      { path: "seasons/:seasonId", element: <SeasonEdit /> },
      { path: "seasons/:seasonId/zones", element: <SeasonZones /> },
      { path: "seasons/:seasonId/zones/:zoneId/rankings", element: <SeasonZoneRankings /> },
      { path: "seasons/:seasonId/zones/:zoneId/bonus-points", element: <SeasonBonusPoints /> },
      { path: "seasons/:seasonId/zones/:zoneId/league-standings", element: <AdminLeagueStandings /> },
      { path: "seasons/:seasonId/cup-modes", element: <SeasonCupModes /> },
      { path: "seasons/:seasonId/extreme", element: <SeasonExtreme /> },
      { path: "seasons/:seasonId/assignments", element: <SeasonAssignments /> },
      { path: "seasons/:seasonId/cup-matches", element: <ScheduledMatches /> },
      { path: "seasons/:seasonId/group-standings", element: <GroupStandings /> },
      { path: "seasons/:seasonId/daily-points", element: <SeasonDailyPoints /> },
      { path: "seasons/:seasonId/restrictions", element: <SeasonRestrictions /> },
      { path: "seasons/:seasonId/restrictions/edit", element: <SeasonRestrictionEdit /> },

      { path: "cups", element: <CupModes /> },
      { path: "captain-league", element: <CaptainLeague /> },

      { path: "points/manual", element: <PointsManual /> },
      { path: "battles/history", element: <BattlesHistory /> },
      { path: "battles-history", element: <BattlesHistory /> },

      { path: "discord-webhooks", element: <ZoneDiscordWebhooks /> },

      { path: "/admin/season-zones", element: <SeasonZones /> },
      { path: "/admin/season-zones/:zoneId/teams", element: <SeasonZoneTeams /> },  

    ],
  },
]);

export default router;