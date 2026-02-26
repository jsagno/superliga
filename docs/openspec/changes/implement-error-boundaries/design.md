## Context

Currently, the liga-admin React application lacks comprehensive error boundary coverage. Component errors can cascade and crash the entire UI, leaving users with a blank screen and no path to recovery. Given the application serves administrative functions critical to Liga Interna operations, reliability is paramount.

**Current State:**
- No error boundary components implemented
- No error recovery UI or messaging
- Errors logged to console only
- Users experience complete application failure on component errors

**Constraints:**
- Must maintain existing component APIs
- Cannot introduce breaking changes to component hierarchy
- Error UI must match existing design system
- Must integrate with existing session management

**Stakeholders:**
- Developers maintaining liga-admin
- Administrators using the application
- System operations monitoring uptime

## Goals / Non-Goals

**Goals:**
- Implement error boundary components at page and feature levels
- Provide user-friendly error recovery UI
- Enable error logging for debugging and monitoring
- Establish error handling testing patterns
- Document best practices for error handling

**Non-Goals:**
- Replace runtime error validation at form level (handled separately)
- Implement global error tracking service (defer to future work)
- Modify Supabase error handling (only handle React component errors)
- Change existing component interfaces

## Decisions

### Decision 1: Error Boundary Architecture
**Choice:** Implement three-level error boundaries:
1. **Root ErrorBoundary** - wraps entire application, last defense
2. **FeatureErrorBoundary** - wraps major features (dashboard, teams, etc.)
3. **PageErrorBoundary** - wraps individual pages

**Rationale:** Multi-level strategy prevents cascading failures while maintaining component isolation. Root catches unexpected crashes; features isolate failures to specific modules; pages handle feature-specific errors.

**Alternatives Considered:**
- Single global error boundary: Less granular, one error crashes everything
- Per-component boundaries: Too many instances, maintenance burden

### Decision 2: Error Recovery UI
**Choice:** Show error state with three options:
1. Retry the component
2. Go back to previous page
3. Return to home dashboard

**Rationale:** Gives users agency in recovery - retry for transient errors, navigation for persistent issues. Matches common web app patterns.

**Alternatives Considered:**
- Silent retry: Doesn't inform user of error
- Force redirect home: Too disruptive for feature-level errors

### Decision 3: Error Logging
**Choice:** Use console logging initially with structured error format, prepare for external service integration

**Rationale:** Console logging is sufficient for development/staging. Structured format allows easy migration to error tracking service (e.g., Sentry) without code changes.

**Alternatives Considered:**
- No logging: Makes debugging impossible
- Direct external service: Adds dependency early, defer complexity

### Decision 4: Testing Approach
**Choice:** Update .test files to throw errors in specific components, verify error boundaries catch and display recovery UI

**Rationale:** Direct testing of error scenarios. Aligns with Playwright MCP test requirement for evidence validation.

**Alternatives Considered:**
- Manual testing only: No automated validation
- Mock error scenarios: Less realistic than actual error throws

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Error boundaries don't catch async errors | Document limitation; provide alternative for async try-catch |
| User confusion on when to retry vs. navigate | Clear error messaging explains each option |
| Over-catching errors masks real bugs during development | Use development warnings to alert on caught errors |
| Performance impact from multiple boundaries | Boundaries add minimal overhead; monitor with bundle analysis |

## Migration Plan

**Phase 1 (Week 1):** Create error boundary components in `src/components/errors/`
- `ErrorBoundary.tsx` - Base class component
- `PageErrorBoundary.tsx` - Page-level wrapper
- `FeatureErrorBoundary.tsx` - Feature-level wrapper
- `RootErrorBoundary.tsx` - Root-level wrapper

**Phase 2 (Week 2):** Deploy boundaries to application
- Wrap root application in RootErrorBoundary
- Identify and wrap feature sections
- Add error boundary tests

**Phase 3 (Week 2-3):** Testing and validation
- Update existing tests to verify error handling
- Add Playwright MCP tests for error recovery flows
- Test error boundary integration end-to-end

**Rollback Strategy:** Error boundaries are additive - can be removed without affecting existing functionality. If issues arise, simply remove boundaries and revert to no error handling.

## Open Questions

1. Should error UI include error details (stack trace) in development vs. production?
2. Should we log to external service now or wait for integration with monitoring system?
3. Should unhandled promise rejections also be caught? (Requires separate error handler)
