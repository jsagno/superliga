/**
 * RootErrorBoundary - Top-level error boundary for the entire application
 * This is the last defense against unhandled errors
 */

import React from 'react';
import ErrorBoundary from './ErrorBoundary';
import ErrorLogger from './errorLogger';

function RootErrorBoundaryFallback(error, onRetry, errorId) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="bg-slate-800 border border-red-500 rounded-lg shadow-xl p-8 max-w-lg w-full">
        {/* Critical Error Icon */}
        <div className="flex justify-center mb-4">
          <div className="rounded-full bg-red-900 p-4">
            <svg
              className="w-8 h-8 text-red-400"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M4.47 11.06a.75.75 0 110-1.06l5.5-5.5a.75.75 0 111.06 1.06l-5.5 5.5a.75.75 0 01-1.06 0zM9.53 9.47a.75.75 0 110-1.06l5.5-5.5a.75.75 0 111.06 1.06l-5.5 5.5a.75.75 0 010 1.06zM4.47 19.06a.75.75 0 110-1.06l5.5-5.5a.75.75 0 111.06 1.06l-5.5 5.5a.75.75 0 01-1.06 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>

        {/* Error Message */}
        <h1 className="text-3xl font-bold text-white text-center mb-3">
          Application Error
        </h1>
        <p className="text-gray-300 text-center mb-2">
          The application encountered a critical error and cannot continue.
        </p>
        <p className="text-gray-400 text-center text-sm mb-6">
          {error?.message || 'Please try refreshing the page or contacting support.'}
        </p>

        {/* Error ID */}
        {errorId && (
          <div className="bg-slate-700 rounded p-3 mb-6 text-xs text-gray-300 break-words border border-slate-600">
            <span className="font-semibold text-gray-200">Error ID: </span>
            <code className="font-mono text-red-300">{errorId}</code>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2">
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded transition duration-200"
          >
            Refresh Page
          </button>
          <button
            onClick={() => (window.location.href = '/')}
            className="w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded transition duration-200"
          >
            Go to Home
          </button>
        </div>

        {/* Support message */}
        <p className="text-center text-xs text-gray-500 mt-6">
          If this continues, please contact support with the Error ID above
        </p>
      </div>
    </div>
  );
}

export function RootErrorBoundary({ children }) {
  return (
    <ErrorBoundary
      level="root"
      fallback={RootErrorBoundaryFallback}
    >
      {children}
    </ErrorBoundary>
  );
}

export default RootErrorBoundary;
