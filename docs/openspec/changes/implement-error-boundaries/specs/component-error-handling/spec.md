## ADDED Requirements

### Requirement: Error boundary catches React errors
The system SHALL implement error boundary components using React.js error boundary API to catch errors in child components and prevent complete application failure.

#### Scenario: Component render error caught
- **WHEN** a child component throws an error during render
- **THEN** the error boundary catches the error and displays an error UI instead of crashing

#### Scenario: Child component lifecycle error caught
- **WHEN** a child component throws an error in componentDidCatch or lifecycle methods
- **THEN** the error boundary catches the error and maintains application stability

### Requirement: Multi-level error boundary structure
The system SHALL implement three levels of error boundaries: root level, feature level, and page level, enabling granular error isolation and recovery.

#### Scenario: Root error boundary catches unhandled errors
- **WHEN** an error occurs at the page or feature level without being caught locally
- **THEN** the root error boundary catches it and displays recovery options

#### Scenario: Feature error boundary isolates feature failures
- **WHEN** an error occurs within a feature (e.g., dashboard widget)
- **THEN** only that feature shows error state; other features remain functional

#### Scenario: Page error boundary handles page-specific errors
- **WHEN** an error occurs on a specific page
- **THEN** the page displays error recovery UI without affecting navigation or other pages

### Requirement: Error recovery UI with user options
The system SHALL display error recovery UI that provides users with actionable options to resolve error states.

#### Scenario: Error UI displays retry option
- **WHEN** component error is caught by error boundary
- **THEN** error UI displays "Retry" button that re-mounts the failed component

#### Scenario: Error UI displays navigation options
- **WHEN** component error is caught by error boundary
- **THEN** error UI displays "Go Back" and "Home" buttons for user navigation

#### Scenario: Error message is user-friendly
- **WHEN** component error is caught by error boundary
- **THEN** error UI displays clear message like "Something went wrong. Please try again or navigate back."

### Requirement: Error logging and debugging
The system SHALL log caught errors with structured information to support debugging while hiding sensitive details from users.

#### Scenario: Error details logged in development
- **WHEN** component error is caught in development environment
- **THEN** error is logged to console with full stack trace and component information

#### Scenario: Error details obfuscated in production
- **WHEN** component error is caught in production environment
- **THEN** error is logged with error ID for support reference; stack trace not shown to user

### Requirement: Error boundary does not catch async errors
The system SHALL clearly document that error boundaries do not catch errors from async operations, promises, or event handlers, and provide patterns for handling those errors separately.

#### Scenario: Async error not caught by boundary
- **WHEN** an error occurs in a Promise or setTimeout
- **THEN** error boundary does not catch it; developers must use try-catch or .catch()

#### Scenario: Event handler error not caught by boundary
- **WHEN** an error is thrown from an event handler (onClick, onChange, etc.)
- **THEN** error boundary does not catch it; developers must wrap handler in try-catch

### Requirement: Error boundary integration with Supabase
The system SHALL gracefully handle Supabase API errors at the component level, distinguishing between network errors, authentication errors, and data errors for appropriate user messaging.

#### Scenario: Supabase network error messaging
- **WHEN** Supabase API call fails due to network error
- **THEN** error boundary shows "Connection lost. Please check your internet and try again."

#### Scenario: Supabase authentication error messaging
- **WHEN** Supabase API call fails due to authentication/authorization
- **THEN** error boundary shows "Your session has expired. Please log in again."

#### Scenario: Supabase data error messaging
- **WHEN** Supabase API call fails due to data validation or business rule error
- **THEN** error boundary shows contextual message from API error response

### Requirement: Error boundary performance impact
The system SHALL implement error boundaries with minimal performance overhead, using React.memo() and similar optimizations to prevent unnecessary re-renders.

#### Scenario: Error boundary does not cause extra renders
- **WHEN** error boundary wraps components without errors
- **THEN** error boundary does not cause additional renders compared to unwrapped components

#### Scenario: Error boundary recovery efficient
- **WHEN** user clicks "Retry" button in error UI
- **THEN** component re-mounts cleanly without affecting other components or global state

### Requirement: Testing of error boundaries
The system SHALL include unit tests and integration tests that verify error boundaries catch errors and display recovery UI correctly.

#### Scenario: Unit test throws error and verifies boundary catches
- **WHEN** unit test throws error in component wrapped by error boundary
- **THEN** test verifies error boundary renders error UI and error log is created

#### Scenario: Playwright test validates error recovery flow
- **WHEN** Playwright MCP test simulates component error
- **THEN** test verifies error UI appears, retry button works, and user can navigate back

### Requirement: Error boundary documentation and best practices
The system SHALL document error boundary implementation patterns and best practices for developers working on liga-admin project.

#### Scenario: Documentation explains when to use error boundaries
- **WHEN** developer reads error boundary documentation
- **THEN** documentation clearly explains use cases (catch render errors, not async errors)

#### Scenario: Documentation explains how to add new boundaries
- **WHEN** developer needs to add error boundary to new feature
- **THEN** documentation provides clear steps and code examples for implementation
