# Implementation Tasks & Roadmap

## Overview
This document outlines the implementation tasks needed to complete Liga Interna's OpenSpec-specified features. Tasks are organized by project (Frontend/Backend) and cross-team dependencies.

**Status Legend:**
- 🟢 Complete
- 🟡 In Progress
- 🔴 Not Started
- ⚠️ Blocked

---

## Phase 1: Data Layer & Backend (Weeks 1-2)

### Backend: Data Synchronization 🔴

#### 1.1 Implement Clash API Client 🔴
- **Spec:** `/openspec/specs/clash-sync-cron.md` (REQ-1)
- **Description:** Create robust HTTP client for Supercell Clash API
- **Subtasks:**
  - [ ] Implement clan data fetcher with caching
    - Spec: Cache TTL = 30 minutes
    - Cache key: `clan_{tag}`
    - Validate response schema
  - [ ] Implement player battle log fetcher
    - Spec: Cache TTL = 60 minutes
    - Batch fetch for up to 50 players per request
    - Handle player not found (404)
  - [ ] Implement war data fetcher
    - Fetch when clan is in war (collectionDay/warDay/ended)
    - Track state transitions
  - [ ] Add rate limit handling
    - Spec: 120 requests/minute Supercell limit
    - Implement adaptive backoff on 429 responses
    - Track request window
- **Acceptance Criteria:**
  - Can fetch clan data without errors
  - Caches prevent redundant API calls
  - Rate limits respected (never exceed 120/min)
  - Test: Fetch 50 players + 1000 battles in <5 minutes

#### 1.2 Implement Database Models 🔴
- **Spec:** `/openspec/specs/data-models.md` + `/openspec/design.md` (Schema)
- **Description:** Create Supabase tables with proper schemas
- **Subtasks:**
  - [ ] Create `players` table
    - Columns: id, tag (UNIQUE), name, trophies, best_trophies, clan_id, last_sync, created_at, updated_at
    - Index: (tag), (clan_id)
    - RLS: Public read, service role write
  - [ ] Create `clans` table
    - Columns: id, tag (UNIQUE), name, trophies, member_count, war_wins, war_losses, last_sync, created_at, updated_at
    - Index: (tag)
  - [ ] Create `battles` table
    - Columns: id, player_id (FK), opponent_tag, result, trophies_change, battle_time, battle_type, war_id (FK), created_at
    - Index: (player_id, battle_time)
  - [ ] Create `player_snapshots` table
    - Columns: id, player_id (FK), trophies, battles, position_in_clan, snapshot_date, created_at
    - Index: (player_id, snapshot_date)
  - [ ] Create `wars` table
    - Columns: id, clan_id (FK), opponent_tag, state, clan_crowns, opponent_crowns, ended_at, created_at, updated_at
- **Acceptance Criteria:**
  - All tables created in Supabase
  - Indexes applied (verify with `\d table_name` in psql)
  - RLS policies set correctly
  - Can insert test data without errors

#### 1.3 Implement Data Sync Engine 🔴
- **Spec:** `/openspec/specs/clash-sync-cron.md` (REQ-2, REQ-4)
- **Description:** Main sync logic: fetch → validate → upsert
- **Subtasks:**
  - [ ] Implement player upsert logic
    - Fetch clan members from Clash API
    - Transform to Player model
    - Validate per spec rules (trophy >= 0, tag format)
    - Upsert to `players` table (or insert on conflict)
    - Update `last_sync` timestamp
  - [ ] Implement battle sync logic
    - For each clan member: fetch battle log
    - Detect new battles (not in database yet)
    - Create battle records
    - Update player battle count
    - Handle duplicates (same timestamp + opponent = duplicate)
  - [ ] Implement snapshot creation
    - Daily at 00:00 UTC
    - Create PlayerSnapshot for each active player
    - Store: trophies, battles, position_in_clan, snapshot_date
  - [ ] Implement war tracking
    - Detect war state changes (collectionDay → warDay → ended)
    - Track participants and crowns
    - Finalize war record on completion
  - [ ] Implement error recovery
    - Spec: Retry up to 5 times with exponential backoff (1s, 2s, 4s, 8s, 16s)
    - Skip individual players on persistent failure
    - Log all errors with context
    - Alert if >50% failures
- **Acceptance Criteria:**
  - Full sync completes in <5 minutes
  - No duplicate battle records created
  - War state tracked correctly
  - Errors logged with retry attempts
  - Test with 50 players + 1000+ battles

#### 1.4 Implement Monitoring & Logging 🔴
- **Spec:** `/openspec/design.md` (Monitoring)
- **Description:** Observability for cron job health
- **Subtasks:**
  - [ ] Configure structured logging
    - File-based logs in `cron/logs/`
    - Format: `[TIME] LEVEL: Message (context)`
    - Levels: INFO, WARN, ERROR
  - [ ] Track key metrics
    - Records synced (players, battles, snapshots)
    - Sync duration
    - API response times
    - Retry count
    - Cache hit ratio
  - [ ] Implement alerting
    - Email alert if sync >5 minutes
    - Email alert if >50% failures
    - Email alert on three consecutive sync failures
  - [ ] Create monitoring dashboard (optional MVP)
    - Track: last sync time, record counts, error rate
    - Store metrics in Supabase for visualization
- **Acceptance Criteria:**
  - Logs are readable and searchable
  - Metrics tracked for past week
  - Alerts sent on failures
  - Dashboard (or log file) shows sync health

### Cross-Team: API Design 🔴

#### 1.5 Document Supabase PostgREST API 🔴
- **Spec:** `/openspec/design.md` (API Endpoints)
- **Description:** Document endpoints frontend will use
- **Subtasks:**
  - [ ] Document read endpoints
    - GET /players (order by trophies desc)
    - GET /players/{id}
    - GET /battles?player_id={id}&order=battle_time.desc
    - GET /player_snapshots?player_id={id}&order=snapshot_date.desc
    - GET /clans/{id}
    - GET /wars?clan_id={id}
  - [ ] Create API client library for frontend
    - Typed wrapper around Supabase client
    - Methods: getPlayers(), getPlayerDetails(), getBattleHistory(), etc.
  - [ ] Add TypeScript types from data models
    - Generate from `/openspec/specs/data-models.md`
    - Export: Player, Clan, Battle, War, PlayerSnapshot
- **Acceptance Criteria:**
  - All GET endpoints documented
  - TypeScript types available
  - Frontend can use typed API client

---

## Phase 2: Frontend Implementation (Weeks 2-3)

### Frontend: Data Display 🔴

#### 2.1 Implement Player Rankings Component 🔴
- **Spec:** `/openspec/specs/admin-dashboard.md` (REQ-1, REQ-7)
- **Scenario:** View Clan Standings
- **Description:** Sortable, filterable player table
- **Subtasks:**
  - [ ] Create PlayerRanking component
    - Fetch from API: players sorted by trophies DESC
    - Display table with columns: Rank, Name, Trophies, Best, Role, Contribution
    - Mobile: hide Best & Contribution columns
    - Tablet: hide Contribution column
  - [ ] Implement sorting
    - Sort by trophies (default DESC)
    - Allow clicking column headers to sort
    - Spec: Response time <200ms per spec
  - [ ] Implement filtering
    - Filter by role (Leader, Co-leader, Member, Elder)
    - Filter by trophy range (optional)
    - Show filtered count badge
  - [ ] Add search box
    - Autocomplete player names
    - Spec: Update player list real-time on type
    - Limit suggestions to 10 results
  - [ ] Calculate contribution rating
    - Formula: (battles_in_week + wins_in_week) / 7
    - Display as percentage or simple number
- **Acceptance Criteria:**
  - Table displays all clan members
  - Sort by trophies works (descending)
  - Filter by role works
  - Search autocomplete shows suggestions
  - Mobile layout hides secondary columns
  - Spec compliance: <200ms response, WCAG AA contrast

#### 2.2 Implement Clan Overview Cards 🔴
- **Spec:** `/openspec/specs/admin-dashboard.md` (REQ-2)
- **Description:** Hero section showing clan stats
- **Subtasks:**
  - [ ] Create ClanOverview component
    - Display: clan name, trophies, members, war record
    - Add trend indicators (↑ or ↓) for trophies vs last week
    - Show last war result (W or L)
  - [ ] Create StatCard sub-component
    - Reusable card for each stat
    - Shows number, trend, label
  - [ ] Add sync status indicator
    - Display last sync time (e.g., "Updated 2 min ago")
    - Warn if >2 hours old (show orange badge)
    - Spec test: /openspec/specs/admin-dashboard.md → REQ-5
  - [ ] Add manual refresh button
    - Triggers API sync (optional webhook)
    - Shows loading spinner while syncing
    - Updates all data and timestamp on success
- **Acceptance Criteria:**
  - Clan stats display correctly
  - Trend arrows show correctly
  - Sync indicator accurate
  - Refresh button works (or indicates need for backend API)

#### 2.3 Implement Player Profile Page 🔴
- **Spec:** `/openspec/specs/admin-dashboard.md` (REQ-3)
- **Scenario:** Player History Analysis
- **Description:** Detailed view of player with battle history + charts
- **Subtasks:**
  - [ ] Create PlayerProfile component
    - URL: /players/{tag}
    - Show: name, current trophies, best trophies, role, clan
    - Last updated time
  - [ ] Implement battle history view
    - Display last 20 battles in table (reverse chronological)
    - Columns: Date, Opponent, Result, Crowns (if war), Trophy Change
    - Pagination to load older battles
  - [ ] Add trophy trend chart
    - Line chart: last 30 days of daily snapshots
    - Show max/min/current values
    - Use library: recharts or chart.js
  - [ ] Add stats summary
    - Win rate: wins / total battles (%)
    - Average trophy gain per battle
    - Battles this week / total
  - [ ] Add war participation indicator
    - Show ongoing war status
    - Display attacks remaining (if warDay)
- **Acceptance Criteria:**
  - Profile page loads with player details
  - Battle history displays last 20
  - Chart shows trend correctly
  - All stats calculated correctly
  - Pagination works for older battles

#### 2.4 Implement War Dashboard 🔴
- **Spec:** `/openspec/specs/admin-dashboard.md` (REQ-6)
- **Description:** Real-time war tracking
- **Subtasks:**
  - [ ] Create WarDashboard component
    - Display current war status (collectionDay/warDay/ended)
    - Show time remaining
  - [ ] Create war participants view
    - Grid/list of clan members in war
    - Columns: Name, Attacks Remaining, Crowns Earned, Status
    - Show opponent clan stats
  - [ ] Add results view (after war ends)
    - Show final crown counts
    - List attacks performed (who won against who)
    - Declare winner
  - [ ] Implement real-time updates
    - Poll every 2 minutes during war (spec: REQ-6)
    - Optional: WebSocket for live updates
- **Acceptance Criteria:**
  - War status displays correctly
  - Participant list shows who attacked
  - Crown counts accurate
  - Updates every 2 minutes during war
  - Results display after war ends

#### 2.5 Implement Responsive Design 🔴
- **Spec:** `/openspec/specs/admin-dashboard.md` (REQ-7)
- **Description:** Mobile/tablet optimization across all components
- **Subtasks:**
  - [ ] Test on mobile (320px - 480px)
    - Primary column view only (sort, search, name visible)
    - Tap-friendly buttons (48x48px minimum)
    - No horizontal scroll
  - [ ] Test on tablet (768px - 1024px)
    - Show 2-3 columns
    - Hide secondary metrics
  - [ ] Test on desktop (1920px+)
    - Full view with all columns
  - [ ] Add responsive navigation
    - Mobile: hamburger menu
    - Desktop: horizontal tabs
  - [ ] Optimize images (badges, charts)
- **Acceptance Criteria:**
  - All views work on 320px+ screens
  - No horizontal scroll
  - Buttons ≥48x48px
  - Images load fast (<1MB total per page)
  - WCAG contrast ratios met

### Frontend: Styling & UX 🔴

#### 2.6 Apply Tailwind Design System 🔴
- **Spec:** `/openspec/design.md` (already in tailwind.config.js)
- **Description:** Consistent styling using existing Tailwind setup
- **Subtasks:**
  - [ ] Establish color palette
    - Primary: Brand color (blue/purple)
    - Success: Green
    - Warning: Orange
    - Error: Red
    - Neutral: Gray shades
  - [ ] Create reusable component library
    - StatCard, Table, Chart, Badge, Button variants
  - [ ] Add animations
    - Subtle fade-in on load
    - Skeleton loaders while fetching
  - [ ] Ensure WCAG AA compliance
    - Text contrast ≥4.5:1
    - Focus states visible
- **Acceptance Criteria:**
  - All pages use consistent styling
  - Color system applied
  - Dark mode support (optional)
  - Accessibility tests pass

---

## Phase 3: Integration & Testing (Week 3)

### Testing 🔴

#### 3.1 Backend Tests 🔴
- **Spec:** `/openspec/design.md` (Testing Strategy)
- **Subtasks:**
  - [ ] Unit tests: Retry logic, cache expiry, validation
  - [ ] Integration tests: API fetch → DB write
  - [ ] Error scenario tests: rate limits, bad data, timeouts
  - [ ] Load tests: 50+ players, 1000+ battles
- **Files:**
  - `cron/tests/test_api_client.py`
  - `cron/tests/test_sync_engine.py`
  - `cron/tests/test_error_recovery.py`

#### 3.2 Frontend Tests 🔴
- **Spec:** `/openspec/design.md` (Testing Strategy)
- **Subtasks:**
  - [ ] Component tests: Render, sort, filter logic
  - [ ] Integration tests: Data loading, user interactions
  - [ ] E2E tests: Full workflows with real API
  - [ ] Accessibility tests: axe-core or Lighthouse
- **Files:**
  - `liga-admin/tests/PlayerRanking.test.jsx`
  - `liga-admin/tests/PlayerProfile.test.jsx`
  - `liga-admin/tests/WarDashboard.test.jsx`

#### 3.3 Cross-Team Integration Test 🔴
- **Description:** Backend → Frontend data flow
- **Test Scenario:**
  1. Run cron job: sync 50 players
  2. Verify data in Supabase
  3. Load dashboard: see players ranked by trophies
  4. Click player: see battle history and chart
  5. Check war dashboard: during war period
- **Acceptance Criteria:**
  - All data flows correctly
  - No data loss or corruption
  - Response times <2 seconds
  - Errors handled gracefully

---

## Phase 4: Deployment & Monitoring (Week 4)

### Backend Deployment 🔴

#### 4.1 Deploy Cron Job 🔴
- **Spec:** `/openspec/design.md` (Deployment Architecture)
- **Subtasks:**
  - [ ] Choose deployment option
    - Cloud Functions: Google Cloud Scheduler + Functions
    - Lambda: AWS EventBridge + Lambda
    - Self-hosted: Linux cron
  - [ ] Configure environment
    - `.env` with SUPABASE_URL, SERVICE_ROLE_KEY, SUPERCELL_TOKEN, CLAN_TAG
    - Secrets managed (not committed to repo)
  - [ ] Set schedule
    - Spec: Clan data every 30 min, battles every 60 min
    - Configure cron expressions or EventBridge rules
  - [ ] Enable logging
    - Logs sent to cloud logging service or local file
    - Alert on errors

#### 4.2 Set Up Monitoring 🔴
- **Spec:** `/openspec/design.md` (Monitoring Checklist)
- **Subtasks:**
  - [ ] Track cron execution times
  - [ ] Monitor API response latencies
  - [ ] Alert on failures (email/Slack)
  - [ ] Dashboard with key metrics (optional)

### Frontend Deployment 🔴

#### 4.3 Deploy Admin Dashboard 🔴
- **Spec:** `/openspec/design.md` (Deployment Architecture)
- **Subtasks:**
  - [ ] Choose hosting
    - Vercel (recommended: GitHub integration)
    - Netlify
    - Static S3 + CloudFront
  - [ ] Configure environment
    - `.env.local`: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
  - [ ] Set up CI/CD
    - Auto-build on git push
    - Test before deploy
  - [ ] Enable CDN & caching
    - Static assets: 1 year cache
    - HTML: no cache (check every time)
  - [ ] SSL/HTTPS (automatic on Vercel/Netlify)

#### 4.4 Production Verification 🔴
- **Subtasks:**
  - [ ] Smoke test: Dashboard loads, shows data
  - [ ] Performance test: Lighthouse score >80
  - [ ] Security scan: No exposed secrets, CORS configured
  - [ ] Monitor error rates (Sentry or similar, optional)

---

## Phase 5: Future Enhancements (Roadmap) 🔴

### Short-term (Next Sprint)
- [ ] WebSocket real-time updates (replace polling)
- [ ] Player comparison tool
- [ ] Battle replay/details modal
- [ ] Export rankings to CSV

### Medium-term (Next 2-3 Months)
- [ ] Mobile app (React Native or PWA)
- [ ] Advanced analytics (AI-powered insights)
- [ ] Clan notifications (email/Slack on member join/leave)
- [ ] User authentication (admin roles, team members)

### Long-term (Next Quarter+)
- [ ] Multi-clan support
- [ ] Tournament management
- [ ] Bot integration (Discord, Telegram)
- [ ] API for partner integrations
- [ ] Self-hosted deployment option

---

## Success Criteria

- ✅ All Phase 1-2 tasks complete
- ✅ Zero spec deviations (all REQ-X implemented)
- ✅ All test scenarios pass (GIVEN/WHEN/THEN)
- ✅ Performance targets met (<5 min sync, <200ms sorts)
- ✅ Dashboard loads data without errors
- ✅ Mobile responsive
- ✅ Monitoring & alerts working
- ✅ Deployment automated

## Timeline

| Phase | Timeline | Deliverables |
|-------|----------|--------------|
| Phase 1 | Weeks 1-2 | Backend sync, database, API |
| Phase 2 | Weeks 2-3 | Frontend components, styling |
| Phase 3 | Week 3 | Testing, integration |
| Phase 4 | Week 4 | Deployment, monitoring go-live |
| Phase 5 | Ongoing | Enhancements & maintenance |

---

## Notes

- Specs are the source of truth - update spec if requirements change
- Report blockers in status updates
- Test scenarios map to spec requirements (GIVEN/WHEN/THEN)
- Cross-team dependencies: clarify before starting
- Document any deviations from spec with rationale
