# Sistema Architecture & Design

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                 Supercell Clash API                      │
└────────────────────────┬────────────────────────────────┘
                         │ (Every 30-60 min)
                         ▼
        ┌────────────────────────────────────┐
        │  Clash Sync Cron Job (Python)      │
        │  ├─ Fetch clan & player data       │
        │  ├─ Sync to Supabase               │
        │  ├─ Create historical snapshots    │
        │  └─ Cache API responses            │
        └────────────────────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────┐
        │      Supabase PostgreSQL DB        │
        │ ├─ players                         │
        │ ├─ clans                           │
        │ ├─ battles                         │
        │ ├─ wars                            │
        │ └─ player_snapshots                │
        └────────────────────────────────────┘
                         │
        ┌────────────────┴────────────────┐
        │                                  │
        ▼                                  ▼
┌──────────────────────┐       ┌──────────────────────┐
│  Admin Dashboard     │       │  API/WS Endpoint     │
│  (React + Vite)      │       │  (Future: Express.js)│
│ ├─ Rankings view     │       │ ├─ Player queries    │
│ ├─ Player profiles   │       │ ├─ Clan stats        │
│ ├─ War dashboard     │       │ ├─ Battle history    │
│ └─ Charts & trends   │       │ └─ Real-time updates │
└──────────────────────┘       └──────────────────────┘
        │
        └─────────────► (API: Supabase PostgREST)
```

## Technology Stack

### Frontend (Liga-Admin)
- **Framework**: React 19.2.0
- **Build Tool**: Vite 7.2.4
- **Router**: React Router 7.11.0
- **Database Client**: @supabase/supabase-js 2.89.0
- **UI Components**: Lucide React icons
- **Styling**: Tailwind CSS 4.1.18
- **Package Manager**: npm

### Backend/Cron (Clash Sync)
- **Language**: Python 3.10+
- **Supabase Client**: supabase==2.6.0
- **HTTP Client**: requests==2.32.3
- **Config Management**: python-dotenv==1.0.1
- **Deployment**: Cron scheduler (system cron or cloud scheduler)

### Data Layer
- **Database**: Supabase (PostgreSQL)
- **PostgREST API**: Auto-generated REST endpoints
- **Authentication**: Supabase Auth (for dashboard access)
- **Vector Storage**: Optional for future similarity search

## Data Flow

### 1. Clash API → Cron Job → Supabase
```python
# Cron Job Process Flow
1. Load configuration (.env)
2. Connect to Supabase with service role key
3. FOR EACH iteration (30 min interval):
   a. Check cache; skip if fresh
   b. Fetch clan data from Clash API
   c. Fetch battle logs for each clan member
   d. Transform API format to data model
   e. Validate against schema
   f. Upsert to Supabase (players, battles)
   g. Create daily snapshot
   h. Update cache
   i. Log results
```

### 2. Supabase → Admin Dashboard
```javascript
// Frontend Process Flow
1. On mount or tab focus:
   a. Load client config from .env
   b. Connect to Supabase with anon key
   c. Query player rankings (ORDER BY trophies DESC)
   d. Query clan stats
   e. Subscribe to real-time updates (optional)
2. User interactions:
   a. Click player → fetch profile & battle history
   b. Search → client-side filter or API query
   c. Refresh → force fetch latest data
```

## Database Schema

### Core Tables

**players**
- id (UUID, PK)
- tag (TEXT, UNIQUE, NOT NULL) -- Supercell tag
- name (TEXT)
- trophies (INT)
- best_trophies (INT)
- battles (INT)
- clan_id (UUID, FK → clans)
- last_sync (TIMESTAMP)
- created_at, updated_at

**clans**
- id (UUID, PK)
- tag (TEXT, UNIQUE, NOT NULL)
- name (TEXT)
- trophies (INT)
- member_count (INT)
- war_wins (INT)
- war_losses (INT)
- last_sync (TIMESTAMP)
- created_at, updated_at

**battles**
- id (UUID, PK)
- player_id (UUID, FK → players)
- opponent_tag (TEXT)
- result (TEXT: 'win'|'loss'|'draw')
- trophies_change (INT)
- battle_time (TIMESTAMP)
- battle_type (TEXT: 'ladder'|'war'|'tournament')
- created_at

**player_snapshots**
- id (UUID, PK)
- player_id (UUID, FK → players)
- trophies (INT)
- battles (INT)
- position_in_clan (INT)
- snapshot_date (DATE)
- created_at

**wars**
- id (UUID, PK)
- clan_id (UUID, FK → clans)
- opponent_tag (TEXT)
- state (TEXT: 'collectionDay'|'warDay'|'ended')
- clan_crowns (INT)
- opponent_crowns (INT)
- ended_at (TIMESTAMP)
- created_at, updated_at

### Indexes
- players(tag) - quick lookup by Supercell tag
- battles(player_id, battle_time) - player battle history
- player_snapshots(player_id, snapshot_date) - trend queries
- clans(tag) - clan lookup

### Row Level Security (RLS)
- public read access to players, clans, battles (no auth needed)
- authenticated write access via service role (cron job only)
- admin-only access to snapshots and configuration

## API Endpoints (Supabase PostgREST)

### Read Operations
```
GET /rest/v1/players?order=trophies.desc
GET /rest/v1/players/{id}
GET /rest/v1/battles?player_id=eq.{id}&order=battle_time.desc
GET /rest/v1/player_snapshots?player_id=eq.{id}&order=snapshot_date.desc
GET /rest/v1/clans/{id}
GET /rest/v1/wars?clan_id=eq.{id}&order=created_at.desc
```

### Write Operations (Cron Only)
```
POST /rest/v1/players (upsert)
POST /rest/v1/battles
POST /rest/v1/player_snapshots
POST /rest/v1/wars (upsert)
```

## Deployment Architecture

### Frontend (Liga-Admin)
- **Hosting**: Vercel, Netlify, or static S3
- **Build**: `npm run build` → dist folder
- **Environment**: .env.local with VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
- **Deployment**: Auto on git push to main

### Backend (Cron Job)
- **Deployment Options**:
  1. **Cloud Functions**: Google Cloud Scheduler + Cloud Functions
  2. **Hosted Cron**: AWS Lambda + EventBridge
  3. **Self-hosted**: Linux server with system cron
- **Environment**: .env file with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPERCELL_TOKEN
- **Execution**: Every 30-60 minutes (configurable)

### Monitoring & Logging
- **Cron Logs**: File-based + optional cloud logging service
- **Error Alerts**: Email or Slack notifications on failure
- **Metrics**: Sync duration, record counts, API response times
- **Dashboard**: Optional Grafana/Datadog for visualization

## Scalability Considerations

### Current (MVP)
- Single Supabase project (up to 8 GB storage)
- Direct PostgREST API calls from frontend
- Single cron instance
- ~50-100 players max

### Future Growth
- Supabase connection pooling for more concurrent users
- API middleware layer (Node.js Express) for:
  - Caching frequent queries
  - Rate limiting
  - Authentication for write operations
  - Request aggregation
- Multiple cron instances with distributed scheduling
- Read replicas for analytics queries
- CDN for static assets

## Security

### Authentication & Authorization
- **Frontend**: Supabase Auth (magic link or OAuth)
- **Cron Job**: Service role API key (never expose in frontend)
- **Public Data**: Players, clans, battles visible without auth

### API Security
- All queries use parameterized statements (prevent SQL injection)
- Rate limiting on PostgREST API (via Supabase)
- HTTPS only (enforced by Supabase)
- API keys rotated regularly

### Data Privacy
- Personal data (emails, IPs) encrypted in transit
- Database backups encrypted at rest
- No sensitive data in cron logs (API tokens redacted)

## Error Recovery & Resilience

### Cron Job Failures
- Retry failed API requests up to 5 times with exponential backoff
- Skip individual players on persistent failure (don't block entire sync)
- Alert ops team if >50% failures
- Idempotent upserts ensure no duplicate data on retry

### Network Issues
- Connection timeout: 10 seconds, then retry
- Database connection pool: auto-reconnect on drop
- API rate limit (429): wait and retry per Retry-After header

### Data Consistency
- All writes in transactions (players + snapshots together)
- Last sync timestamp tracks data currency
- Historical snapshots allow point-in-time recovery
- Regular backups via Supabase

## Testing Strategy

### Frontend Tests
- Component unit tests (React Testing Library)
- Integration tests (data loading, filtering)
- E2E tests (user workflows with Cypress/Playwright)
- Accessibility tests (axe-core)

### Backend Tests
- Unit tests: cache logic, retry backoff, validation
- Integration tests: API calls with mock responses
- Load tests: Process 50+ players, 1000+ battles
- Error scenario tests: API failures, rate limits, bad data

### Types of Tests
```
Unit Tests       - Functions, utilities, transformations
Integration Tests - Cron → Supabase → Frontend flow
E2E Tests        - Full user workflows (search, filter, view profiles)
Load Tests       - High volume data sync
Smoke Tests      - Quick sanity check before deploy
```

## Monitoring Checklist

- [ ] Cron job execution time (target: <5 min)
- [ ] API response latency (target: <500ms)
- [ ] Error rate (target: <1% of requests)
- [ ] Cache hit ratio (target: >80%)
- [ ] Database connection pool utilization
- [ ] Supabase storage usage
- [ ] Data freshness (last sync timestamp)

## Future Enhancements

1. **Real-time Updates**: WebSocket subscriptions for live battle updates
2. **Analytics**: Trend analysis, player performance metrics
3. **Notifications**: Email/Slack alerts for significant events
4. **Mobile App**: React Native or native iOS/Android
5. **API Documentation**: OpenAPI/Swagger for partner integrations
6. **Advanced Search**: Full-text search, faceted filters
7. **User Roles**: Admin, moderator, member access levels
8. **Audit Trail**: Log all user actions for compliance

## Related Specs
- [Data Models](./data-models.md)
- [Clash Sync Cron](./clash-sync-cron.md)
- [Admin Dashboard](./admin-dashboard.md)
