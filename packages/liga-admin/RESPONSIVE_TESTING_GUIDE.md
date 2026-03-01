# Responsive Design Testing Guide - Daily Points Grid

## Overview
This guide provides manual testing procedures to verify responsive design and performance of the daily points grid feature (tasks 9.1-9.4).

---

## Test Environment Setup

### Prerequisites
- [ ] Local Supabase running: `supabase status`
- [ ] `packages/liga-admin/.env` pointing to local instance (http://127.0.0.1:54321)
- [ ] Dev server running: `npm run dev` (running on http://localhost:5173)
- [ ] Chrome DevTools open (F12)
- [ ] Test data available (season with 50+ dates and 200+ players)

### Create Test Data (if needed)

```javascript
// In browser console on admin dashboard
// Creates test season with multiple dates for responsive testing
const testSeason = {
  description: "Responsive Test Season",
  season_start_at: new Date(2026, 2, 1).toISOString(),
  season_end_at: new Date(2026, 5, 30).toISOString(),
  days_per_round: 4
};
// Use admin UI to create season and populate with test matches
```

---

## Test Cases

### Test 9.1: Horizontal Scroll with 50+ Dates (10+ Rounds)

**Objective**: Verify grid scrolls horizontally and round headers remain readable

**Steps**:
1. Open Season → Daily Points page
2. Select a season with 50+ battle dates (10+ days worth of dates)
3. Observe the table

**Expected Results**:
- [ ] Table shows date column headers (DD/MM format)
- [ ] Round headers visible above date headers ("Ronda 1", "Ronda 2", etc.)
- [ ] Horizontal scrollbar appears at bottom
- [ ] Player name column (fixed on left) remains visible while scrolling right
- [ ] Round headers scroll horizontally WITH date columns (not fixed)
- [ ] Points cells display correctly as you scroll through dates
- [ ] Total column (sticky right) remains visible
- [ ] No horizontal scroll performed when viewing on 1920px+ width (content fits)

**Test on Widths**:
- [ ] Desktop: 1920px → No scroll needed
- [ ] Laptop: 1366px → Horizontal scroll appears
- [ ] Tablet: 768px → Heavy horizontal scroll
- [ ] Mobile: 375px → Almost all content scrolls

**Performance**: ⏱️ Grid renders in **< 2 seconds**

---

### Test 9.2: Performance with 200+ Players

**Objective**: Verify no performance degradation with large dataset

**Steps**:
1. Open DevTools → Performance tab
2. Select a season with 200+ players across teams
3. Load the Daily Points page
4. Record performance metrics

**Expected Results**:
- [ ] Initial page load: < 2 seconds
- [ ] Table renders: < 1 second
- [ ] No **jank** (frame drops) during:
  - [ ] Scrolling vertically through players
  - [ ] Scrolling horizontally through dates
  - [ ] Filtering by player search
  - [ ] Filtering by team
- [ ] Smooth 60 FPS during scrolling (DevTools Rendering tab)
- [ ] Memory usage stable (no continuous growth)
- [ ] useMemo preventing unnecessary re-renders (verify via React DevTools Profiler)

**Performance Checklist**:
- [ ] First Contentful Paint (FCP): < 1.5s
- [ ] Largest Contentful Paint (LCP): < 2s
- [ ] Cumulative Layout Shift (CLS): < 0.1

**DevTools Recording**:
```
Open DevTools > Performance > Record during page load
Expected timeline:
  - Loading: ~200ms
  - Scripting: ~800ms (calculation of rounds/penalties)
  - Rendering: ~400ms (table DOM creation)
  - Total: < 2000ms
```

---

### Test 9.3: Mobile/Tablet Responsive Layout

**Objective**: Verify responsive design works on smaller screens

### Viewport Tests

#### iPad (768px width)
1. Open Chrome DevTools: **Device Toolbar** (Ctrl+Shift+M)
2. Select iPad (768px × 1024px)
3. Navigate to Season → Daily Points

**Expected on iPad**:
- [ ] Player columns remain sticky/fixed on left
- [ ] Date columns scrollable horizontally
- [ ] Round headers visible and understandable
- [ ] Legend at bottom remains accessible
- [ ] Filters (search, team) fully visible and usable
- [ ] Table readable without excessive pinch-zoom
- [ ] Font sizes legible (not too small)

#### Mobile Phone (375px width)
1. Select iPhone 12 (375px × 812px)
2. Navigate to Season → Daily Points

**Expected on Mobile**:
- [ ] Player name truncated OR wrapped (acceptable)
- [ ] Jersey number still visible
- [ ] Team logo visible (6×6px minimum)
- [ ] Horizontal scroll for dates (expected - table too wide for mobile)
- [ ] One date visible at a time on screen
- [ ] Points cell readable and clickable
- [ ] Legend accessible by scrolling down
- [ ] Filters accessible and functional

#### Landscape Mobile (812px × 375px)
1. iPhone 12 in landscape mode
2. Repeat mobile tests

**Expected**:
- [ ] More dates visible per screen
- [ ] Still functional and readable

---

### Test 9.4: Round Header Scroll Behavior

**Objective**: Verify round headers scroll naturally with date columns

**Steps**:
1. Select a season with clear round groupings (daysPerRound = 4)
2. Resize browser to 1366px (visible scroll)
3. Scroll horizontally using mouse/trackpad

**Expected Behavior**:
- [ ] Round headers move WITH date columns
- [ ] Round headers NOT fixed to viewport
- [ ] Round headers NOT sticky
- [ ] Scrolling is smooth (no jank)
- [ ] Round headers always align with their date columns

**Verify Alignment**:
```
Round 1: Columns 1-4
Round 2: Columns 5-8
Round 3: Columns 9-12
```
When scrolled to show columns 3-6:
- [ ] "Ronda 1" spans partially (cols 3-4)
- [ ] "Ronda 2" spans fully (cols 5-6)
- [ ] No misalignment

**Edge Case**: Partial final round
```
Round 4: Columns 13-15 (only 3 dates, not 4)
```
- [ ] "Ronda 4" spans exactly 3 columns
- [ ] No extra whitespace

---

## Browser Compatibility

Test on these browsers at 1366px viewport width:

| Browser | Version | Status | Notes |
|---------|---------|--------|-------|
| Chrome | Latest | ☐ Pass | Primary target |
| Firefox | Latest | ☐ Pass | Check scrollbar style |
| Safari | Latest | ☐ Pass | Check sticky positioning |
| Edge | Latest | ☐ Pass | Chromium-based |

---

## Performance Profiling

### Using React DevTools Profiler

1. Install React DevTools extension
2. Open DevTools → Profiler tab
3. Click record
4. Navigate to Daily Points page
5. Stop recording

**Analyze**:
- [ ] Grid render time: < 500ms
- [ ] Re-renders on scroll: None (grid should be memoized)
- [ ] Re-renders on filter change: Only affected data
- [ ] buildDailyPointsGrid function called once per mount (memoized)

### Using Lighthouse

1. Open Chrome DevTools → Lighthouse
2. Select "Mobile" or "Desktop"
3. Run audit for Daily Points page

**Targets**:
- [ ] Performance: > 85
- [ ] Accessibility: > 90
- [ ] Best Practices: > 90

---

## Filters & Search Responsiveness

### Player Search Filter
1. Enter player name or tag in search box
2. Type slowly character by character

**Expected**:
- [ ] Filter updates in real-time (< 200ms delay)
- [ ] Grid re-renders with filtered players
- [ ] No jank during typing
- [ ] Search is case-insensitive

### Team Filter
1. Select different teams from dropdown
2. Quickly switch between teams

**Expected**:
- [ ] Grid instantly updates (< 100ms)
- [ ] Only selected team's players shown
- [ ] Round headers remain aligned
- [ ] Horizontal scroll position maintained if within bounds

---

## Accessibility Testing

### Keyboard Navigation
- [ ] Can tab through filters
- [ ] Can use arrow keys in dropdown
- [ ] Can scroll table with arrow keys
- [ ] Can reach all interactive elements without mouse

### Screen Reader (NVDA/JAWS)
- [ ] Table headers announced correctly
- [ ] Round headers described properly
- [ ] Player names read clearly
- [ ] Points values announced

### Color Contrast
- [ ] All text meets WCAG AA minimum (4.5:1 for text)
- [ ] Differentiation not by color alone (icons/text for penalties)
- [ ] DevTools Lightouse: Accessibility > 90

---

## Known Limitations & Workarounds

| Limitation | Workaround | Status |
|-----------|-----------|--------|
| Horizontal scroll slow on very old devices | Reduce number of visible dates | ⚠️ |
| Mobile: Points cells very small on 375px | Use zoom or landscape mode | ⚠️ |
| Safari: Sticky columns not perfectly smooth | Use Chrome/Firefox | ⚠️ |

---

## Sign-Off

After completing all tests, sign below:

- [ ] **Tester**: ____________  **Date**: __________
- [ ] **Test Environment**: Local  ☐  Staging  ☐  Production  ☐
- [ ] **Screenshots Attached**: Yes  ☐  No  ☐
- [ ] **Issues Found**: None  ☐  See below  ☐

### Issues Found

```
[Document any issues, with steps to reproduce and severity]
```

### Recommendations

```
[Note any performance improvements or design suggestions]
```

---

## Quick Reference

### CLI Commands

```bash
cd packages/liga-admin

# Start dev server
npm run dev

# Run unit tests
npm run test:unit

# Run E2E tests
npm run test:e2e

# Performance profiling
npm run build && npm run preview  # Test production build
```

### Browser Extensions

- React DevTools Profiler (Chrome/Firefox)
- Lighthouse (Chrome)
- WebPageTest (Performance testing)
- axe DevTools (Accessibility)

---

## Related Documentation

- [SeasonDailyPoints.jsx](../src/pages/admin/SeasonDailyPoints.jsx)
- [dailyPointsUtils.js](../src/lib/dailyPointsUtils.js)
- [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md)
- [Business Rules - Scoring System](../../docs/openspec/business-rules/scoring-system.md)
