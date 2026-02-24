# Feature: Dashboard Nonfunctional Requirements

## Overview
Nonfunctional requirements and UI structure for the admin dashboard.

## Layout Structure

Header
- Logo and title
- Last sync timestamp
- Manual refresh button
- User/logout

Main content (tabs)
- Overview tab: clan stats, war status, player rankings
- War tab: war status, participants, results
- Player profiles tab: search, list, detail view
- Settings tab: configuration options

## Key Metrics Cards

- Clan trophies (trend indicator)
- Members (count with join/leave delta)
- War record (W-L format, recent streak)
- Top player mini-card

## Charts and Visualizations

- Trophy trend line chart (last 30 days)
- Win rate chart (wins, losses, draws)
- Member activity sparkline (last 7 days)
- War results bar chart (wins and losses over time)

## Data Refresh Strategy

- Polling: every 5 minutes for overview, every 2 minutes during war
- Manual refresh: always available
- Optional future enhancement: WebSocket updates

## Caching

- Client cache for 5 minutes (stale-while-revalidate)
- Server data served from Supabase (fed by CRON sync)

## Error Handling

- Show error toast and retry automatically after 3 seconds
- After 3 failures, show error details and provide manual retry
- Specific errors:
  - 404 Player not found
  - 403 Unauthorized (redirect to login)
  - 500 Server error
  - Timeout (>10s)

## Accessibility

- WCAG 2.1 AA compliance
- Keyboard navigation support
- Screen reader friendly labels
- Minimum contrast ratio 4.5:1
- Tap targets at least 48x48px on mobile

## Performance Targets

- Initial page load under 2 seconds
- Profile page load under 1 second
- Search and filter response under 200 ms
- Chart rendering under 500 ms

## Related Specs
- [Player Rankings](./player-rankings.md)
- [Clan Overview](./clan-overview.md)
- [War Dashboard](./war-dashboard.md)
- [Data Currency Indicator](./data-currency-indicator.md)
