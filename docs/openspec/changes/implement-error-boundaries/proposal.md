## Why

The liga-admin frontend currently lacks comprehensive error boundary coverage, leaving the application vulnerable to cascading component failures. When a component renders an error, it can crash the entire UI instead of gracefully handling the error and showing users a helpful message. This directly violates best practices outlined in the Architect guidelines and creates a poor user experience. Implementing error boundaries now will improve application resilience and align with React 19 best practices.

## What Changes

- Add error boundary components at strategic locations (page level, feature level)
- Implement error logging to track failures for debugging
- Create user-friendly error UI that allows recovery or navigation
- Establish error boundary testing patterns
- Document error handling approach in project guidelines

## Capabilities

### New Capabilities
- `component-error-handling`: Error boundary components and error recovery UI for graceful error handling across liga-admin

### Modified Capabilities
<!-- No existing capabilities need requirement changes by this change -->

## Impact

- **Affected Code**: All React components in `packages/liga-admin/src/`
- **APIs**: None (internal refactoring)
- **Dependencies**: No new dependencies required (React built-in capability)
- **Systems**: Improves reliability of LIGA-ADMIN frontend
- **Breaking Changes**: None - purely additive
