# Admin Dashboard Specification

## Overview
This specification defines the requirements and user experience for the Liga Interna admin dashboard - a React/Vite frontend that displays clan statistics, player rankings, and battle history.

## Vision
Create an intuitive, real-time admin interface that enables:
- Instant visibility into clan performance and player rankings
- Historical trend analysis with visual charts
- Team management and player profile details
- Data accuracy monitoring (sync status, freshness)
- Responsive mobile-friendly design for on-the-go access

## Requirements

### REQ-1: Player Rankings
- The system SHALL display ranked list of clan members sorted by current trophies (descending)
- The system SHALL show player name, trophies, best trophies, and role within clan
- The system SHALL calculate player contribution rating (battles participated, win rate)
- The system SHALL filter players by role (leader, co-leader, member, elder)

### REQ-2: Clan Overview
- The system SHALL display current clan statistics (trophies, members, war record)
- The system SHALL show war status during active wars
- The system SHALL display recent war results with opponent info
- The system SHALL track member join/leave events

### REQ-3: Player Profile View
- The system SHALL show detailed player information on dedicated page
- The system SHALL display battle history (last 20 battles with results)
- The system SHALL show trophy trend over time (line chart)
- The system SHALL indicate participation in ongoing wars
- The system SHALL link player to current clan

### REQ-4: Search & Filter
- The system SHALL filter players by name, tag, or role
- The system SHALL sort by trophies, battles played, win rate
- The system SHALL filter battles by date range, player, result type
- The system SHALL provide quick search with autocomplete

### REQ-5: Data Currency Indicator
- The system SHALL display last sync timestamp prominently
- The system SHALL show data age (e.g., "Updated 2 minutes ago")
- The system SHALL warn if data exceeds 2 hours old
- The system SHALL provide manual refresh button

### REQ-6: War Dashboard
- The system SHALL show active war collection day/war day status
- The system SHALL display war participants and attack status
- The system SHALL show final results with opponent comparison
- The system SHALL track war win/loss streaks

### REQ-7: Responsive Design
- The system SHALL work on desktop (1920px+), tablet (768px+), mobile (320px+)
- The system SHALL adapt table views to smaller screens
- The system SHALL prioritize essential info on mobile

## Scenarios

### Scenario: View Clan Standings
- **GIVEN** admin opens the dashboard
- **WHEN** dashboard loads
- **THEN** display clan overview card with trophies, members, war record
- **AND** display ranked player table (sorted by trophies)
- **AND** show sync timestamp
- **WHEN** admin clicks a player row
- **THEN** navigate to player profile page

### Scenario: Monitor War Progress
- **GIVEN** clan is in active war (warDay state)
- **WHEN** admin opens war dashboard tab
- **THEN** show all participants with attack status
- **AND** highlight remaining attacks
- **AND** show current crown counts vs opponent
- **AND** display time remaining for war
- **WHEN** attacks are completed
- **THEN** update status automatically (via polling or WebSocket)

### Scenario: Player History Analysis
- **GIVEN** admin clicks on player profile
- **WHEN** profile loads
- **THEN** display player info card (name, trophies, best, role)
- **AND** show last 20 battles in reverse chronological order
- **AND** display trophy trend line chart (last 30 days)
- **AND** calculate win rate from recent battles
- **WHEN** admin scrolls
- **THEN** load older battles (pagination or infinite scroll)

### Scenario: Search & Filter Players
- **GIVEN** admin enters search query in search box
- **WHEN** typing player name or tag
- **THEN** show autocomplete suggestions (max 10)
- **AND** update player list in real-time
- **WHEN** admin clicks filter icon
- **THEN** show filter panel with options (role, trophy range, battles played)
- **AND** apply filters to player list
- **WHEN** filter applied
- **THEN** display filtered count badge

### Scenario: Refresh Stale Data
- **GIVEN** dashboard shows data older than 2 hours
- **WHEN** user views dashboard
- **THEN** display warning badge on data age indicator
- **WHEN** admin clicks refresh button
- **THEN** trigger manual sync endpoint
- **AND** show loading spinner
- **AND** update all data and timestamp on success
- **AND** display error message if sync fails

### Scenario: Mobile Dashboard View
- **GIVEN** admin accesses dashboard on mobile device
- **WHEN** dashboard loads
- **THEN** display clan overview in card format
- **AND** show player list in scrollable table (name, trophies, role)
- **AND** hide secondary columns (best trophies, contribution)
- **WHEN** admin clicks player
- **THEN** navigate to mobile-optimized profile view

## User Interface Components

### Layout Structure
```
Header
├─ Logo / Title
├─ Last Sync Timestamp
├─ Manual Refresh Button
└─ User/Logout

Main Content (Tabs)
├─ Overview Tab
│  ├─ Clan Stats Card
│  ├─ War Status Card
│  └─ Player Rankings Table
├─ War Dashboard Tab
│  ├─ War Status Overview
│  ├─ Participants Grid/List
│  └─ Results (if ended)
├─ Player Profiles Tab
│  ├─ Search / Filter Panel
│  ├─ Player List Table
│  └─ Detail View (expandable)
└─ Settings Tab
   └─ Configuration options
```

### Key Metrics Cards
- **Clan Trophies**: Large number with trend arrow (↑ or ↓)
- **Members**: Count with join/leave count this week
- **War Record**: "W-L" format with recent streak
- **Top Player**: Name & trophies mini-card

### Player Table Columns
| Column | Desktop | Tablet | Mobile |
|--------|---------|--------|--------|
| Rank | ✓ | ✓ | ✓ |
| Name | ✓ | ✓ | ✓ |
| Trophies | ✓ | ✓ | ✓ |
| Best Trophies | ✓ | ✗ | ✗ |
| Role | ✓ | ✓ | ✓ |
| Battles | ✓ | ✓ | ✗ |
| Win Rate | ✓ | ✗ | ✗ |

### Charts & Visualizations
- **Trophy Trend**: Line chart (last 30 days, player level)
- **Win Rate**: Pie chart or horizontal bar (wins, losses, draws)
- **Member Activity**: Sparkline (battles per day, last 7 days)
- **War Results**: Bar chart (wins, losses over time)

## Data Refresh Strategy

### Real-time Updates
- **Polling**: Every 5 minutes for overview, every 2 minutes during war
- **WebSocket** (optional future enhancement): Live battle notifications
- **Manual Refresh**: Always available button

### Caching
- **Client-side**: Cache data for 5 minutes (stale-while-revalidate)
- **Server-side**: Served by API from Supabase, uses cron sync data

## Error Handling

### Network Errors
- Display error toast: "Failed to load data. Retrying..."
- Retry automatically after 3 seconds
- Show error details after 3 failed retries
- Provide manual retry button

### API Errors
- 404 Player Not Found: "Player has left the clan"
- 403 Unauthorized: Direct to login
- 500 Server Error: "Server error, please try again later"
- Timeout (>10s): "Request timed out"

### Stale Data
- Warn if >2 hours old
- Suggest manual refresh
- Allow viewing marked as "Cached"

## Accessibility
- WCAG 2.1 AA compliant
- Keyboard navigation support
- Screen reader friendly (proper ARIA labels)
- Color contrast ratios >4.5:1
- Mobile tap targets ≥48x48px

## Performance Targets
- Initial page load: <2 seconds
- Profile page load: <1 second
- Search/filter response: <200ms
- Chart rendering: <500ms

## Related Specs
- [Data Models](./data-models.md) - Entity definitions
- [Clash Sync Cron](./clash-sync-cron.md) - Data source and freshness
