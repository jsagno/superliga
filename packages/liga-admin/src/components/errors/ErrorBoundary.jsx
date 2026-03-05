/**
 * Base ErrorBoundary component for React error boundaries
 * Catches rendering errors in child components
 */

import React from 'react';
import ErrorLogger from './errorLogger';
import { ERROR_TYPES, ERROR_MESSAGES, isDevelopment } from './errorTypes';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details
    const errorId = ErrorLogger.logBoundaryError(
      error,
      errorInfo,
      {
        boundaryLevel: this.props.level || 'unknown',
        errorType: ERROR_TYPES.RENDER,
      }
    );

    // Update state with error details for rendering
    this.setState({
      error,
      errorInfo,
      errorId,
    });
  }

  handleRetry = () => {
    // Reset error state to re-render children
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Render custom fallback UI
      return this.props.fallback ? (
        this.props.fallback(
          this.state.error,
          this.handleRetry,
          this.state.errorId
        )
      ) : (
        <DefaultErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          errorId={this.state.errorId}
          onRetry={this.handleRetry}
          level={this.props.level}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Default error fallback UI component
 */
function DefaultErrorFallback({ error, errorInfo, errorId, onRetry, level }) {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4"
      role="alert"
    >
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        {/* Error Icon */}
        <div className="flex justify-center mb-4">
          <div className="rounded-full bg-red-100 p-3">
            <svg
              className="w-6 h-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"                
                d="M12 9v2m0 4v2m0 0v2m0-6v-2m0 0v-2m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>

        {/* Error Message */}
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
          Something went wrong
        </h1>
        <p className="text-gray-600 text-center mb-6">
          {error?.message || 'An unexpected error occurred. Our team has been notified.'}
        </p>

        {/* Error ID for support */}
        {errorId && (
          <div className="bg-slate-50 rounded p-3 mb-6 text-sm text-gray-600 break-words">
            <span className="font-semibold">Error ID: </span>
            <code className="font-mono">{errorId}</code>
          </div>
        )}

        {/* Development: Show stack trace */}
        {isDevelopment() && errorInfo?.componentStack && (
          <div className="bg-red-50 border border-red-200 rounded p-3 mb-6 text-xs text-red-900 overflow-auto max-h-32">
            <p className="font-semibold mb-2">Component Stack:</p>
            <pre className="whitespace-pre-wrap font-mono break-words">
              {errorInfo.componentStack}
            </pre>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2">
          <button
            onClick={onRetry}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded transition duration-200"
          >
            Try Again
          </button>
          <button
            onClick={() => window.history.back()}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold py-2 px-4 rounded transition duration-200"
          >
            Go Back
          </button>
          <button
            onClick={() => (window.location.href = '/')}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold py-2 px-4 rounded transition duration-200"
          >
            Home
          </button>
        </div>

        {/* Support link */}
        <p className="text-center text-sm text-gray-500 mt-6">
          If this problem persists, please contact support with Error ID
        </p>
      </div>
    </div>
  );
}

export default ErrorBoundary;
