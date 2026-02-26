# Error Handling Guide for LIGA-ADMIN

This guide explains how to use error boundaries and handle errors in the liga-admin React application.

## Overview

Error boundaries are React components that catch JavaScript errors anywhere in the child component tree, log those errors, and display a fallback UI instead of crashing the entire component tree.

### Key Points

- **Error Boundaries catch render errors** - Errors during component rendering and lifecycle methods
- **Error Boundaries do NOT catch**:
  - Event handler errors (use try-catch)
  - Asynchronous code errors (use .catch() or try-catch in async/await)
  - Server-side errors (handled separately)
  - Errors in error boundaries themselves

## Error Boundary Hierarchy

Liga-admin uses a three-level error boundary structure:

### 1. Root Error Boundary (Global)

The topmost error boundary that wraps the entire application. This is the last defense against unhandled errors.

**Location**: Wrapped in `src/main.jsx`

**When it activates**: 
- Unhandled errors in any child component
- Page-level errors not caught by lower boundaries
- Errors in feature boundaries

**User experience**: Full-screen error with Refresh and Home options

### 2. Page Error Boundary

Wraps individual pages to isolate page-level errors without affecting navigation.

**How to use**:
```jsx
import { PageErrorBoundary } from '@/components/errors';

export default function MyPage(){
  return (
    <PageErrorBoundary>
      <div>Page content here</div>
    </PageErrorBoundary>
  );
}
```

**When to use**: Wrap each page/route component

**Benefits**:
- Isolates page errors
- Users can navigate away without full page reload
- Navigation menu remains functional

### 3. Feature Error Boundary

Wraps individual features or components to handle localized errors.

**How to use**:
```jsx
import { FeatureErrorBoundary } from '@/components/errors';

export function MatchStats() {
  return (
    <FeatureErrorBoundary featureName="Match Stats">
      <div>Feature content here</div>
    </FeatureErrorBoundary>
  );
}
```

**When to use**: 
- Complex components that might error independently
- Widgets or cards that can fail without affecting page
- async data fetching components

**Benefits**:
- Keeps other page content visible
- Shows compact error message inline
- Users can retry component without page reload

## Handling Different Error Types

### 1. Render Errors (Caught by Error Boundaries)

```jsx
// This error will be caught by error boundary
function BrokenComponent() {
  const data = undefined;
  return <div>{data.property}</div>; // Error: cannot read property of undefined
}
```

Error boundaries will catch this automatically.

### 2. Event Handler Errors (Use Try-Catch)

```jsx
function UserForm() {
  const handleSubmit = (e) => {
    e.preventDefault();
    try {
      // Perform action that might error
      submitForm();
    } catch (error) {
      // Handle error locally
      showErrorToast(error.message);
    }
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

### 3. Async/Promise Errors (Use .catch() or async/await)

```jsx
// Method 1: Using .catch()
function FetchData() {
  useEffect(() => {
    fetch('/api/data')
      .then(res => res.json())
      .then(data => setData(data))
      .catch(error => {
        console.error('Failed to fetch:', error);
        setError(error.message);
      });
  }, []);
}

// Method 2: Using async/await with try-catch
function FetchData() {
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/data');
        const data = await res.json();
        setData(data);
      } catch (error) {
        console.error('Failed to fetch:', error);
        setError(error.message);
      }
    };
    fetchData();
  }, []);
}
```

### 4. Supabase Errors (Handle with Try-Catch)

```jsx
import { supabase } from '@/services/supabaseClient';

async function fetchMatchData(matchId) {
  try {
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (error) {
      // Handle Supabase errors with context
      if (error.code === 'PGRST116') {
        throw new Error('Match not found');
      }
      throw error;
    }

    return data;
  } catch (err) {
    // Log with context
    ErrorLogger.logNetworkError(err, `/matches/${matchId}`);
    throw err;
  }
}
```

## Error Logging

Use `ErrorLogger` utility for consistent error logging:

```jsx
import { ErrorLogger } from '@/components/errors';

// Log a component error
ErrorLogger.log(error, {
  component: 'PlayerList',
  userId: currentUser.id,
  action: 'load_players',
});

// Log a network error
ErrorLogger.logNetworkError(error, '/api/battles');

// Log an auth error
ErrorLogger.logAuthError(error, 'session_expired');
```

### Development vs Production

- **Development**: Full stack traces shown in browser console and error component
- **Production**: Stack traces hidden; error ID shown for support reference

## React Suspense (Advanced)

For async data loading, consider using React Suspense (React 18+):

```jsx
import { Suspense } from 'react';

function MyPage() {
  return (
    <PageErrorBoundary>
      <Suspense fallback={<LoadingSpinner />}>
        <PlayerData />
      </Suspense>
    </PageErrorBoundary>
  );
}
```

## Best Practices

### DO:
✅ Wrap pages with `PageErrorBoundary`
✅ Wrap complex features with `FeatureErrorBoundary`
✅ Use try-catch in event handlers
✅ Use catch() or try-catch for async operations
✅ Log errors with context for debugging
✅ Show user-friendly error messages
✅ Provide users with recovery options (Retry, Go Back, Home)
✅ Test error scenarios during development

### DON'T:
❌ Rely on error boundaries for async errors
❌ Use generic "Something went wrong" messages without context
❌ Leave console errors unhandled
❌ Ignore errors during development
❌ Mix error boundary with Redux or Context error handling
❌ Cascade errors without logging
❌ Show stack traces in production
❌ Use error boundaries in event handlers

## Testing Error Boundaries

### Unit Test Example

```jsx
import { render, screen } from '@testing-library/react';
import { PageErrorBoundary } from '@/components/errors';

function BadComponent() {
  throw new Error('Test error');
}

test('PageErrorBoundary catches errors', () => {
  render(
    <PageErrorBoundary>
      <BadComponent />
    </PageErrorBoundary>
  );

  expect(screen.getByText(/page error/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
});
```

### Manual Testing

1. Edit a component to throw an error: `throw new Error('Test')`
2. View the error boundary fallback UI
3. Verify error ID is displayed
4. Verify retry button works
5. Verify back/home buttons work
6. Check browser console for error logging

## Troubleshooting

### Error boundary not catching my error

**Likely cause**: Error is in async code, event handler, or after render
**Solution**: 
- Use try-catch for async/event handlers
- Error boundary only catches synchronous render errors

### Error details not showing in production

**Expected behavior**: Stack traces hidden for security
**Solution**: 
- Use error ID to look up in logs
- Check server logs and monitoring system
- Feature not implemented yet - currently logs to console

### Error logging not working

**Debugging steps**:
1. Check browser console for log messages
2. Verify ErrorLogger is imported correctly
3. Check error boundary level setting
4. Verify NODE_ENV is set correctly

## Resources

- [React Error Boundaries Docs](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
- [MDN Error Handling](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Building_blocks/Error_handling)
- Liga-admin Architecture: See `docs/openspec/architecture/`

## Support

If errors persist or you need to add custom error handling:

1. Check this guide and React documentation
2. Review error logs for error ID and context
3. Check if error boundary is properly wrapping the component
4. Test in development mode to see full error details
5. Contact the development team with error ID and reproduction steps
