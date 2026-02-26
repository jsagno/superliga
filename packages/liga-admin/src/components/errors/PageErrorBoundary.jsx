/**
 * PageErrorBoundary - Error boundary for individual pages
 * Isolates page-level errors without affecting navigation or other pages
 */

import React from 'react';
import ErrorBoundary from './ErrorBoundary';

function PageErrorBoundaryFallback(error, onRetry, errorId) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full border-l-4 border-orange-500">
        {/* Warning Icon */}
        <div className="flex justify-center mb-4">
          <div className="rounded-full bg-orange-100 p-3">
            <svg
              className="w-6 h-6 text-orange-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeLinejoin="round"
                d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>

        {/* Error Message */}
        <h2 className="text-xl font-bold text-gray-900 text-center mb-2">
          Page Error
        </h2>
        <p className="text-gray-600 text-center text-sm mb-4">
          This page encountered an error while loading. Please try again.
        </p>

        {/* Error Details */}
        {error?.message && (
          <p className="text-gray-500 text-center text-xs mb-4 p-3 bg-gray-50 rounded">
            {error.message}
          </p>
        )}

        {/* Error ID */}
        {errorId && (
          <p className="text-gray-400 text-center text-xs mb-6">
            <span className="font-semibold">Error ID: </span>
            <code className="font-mono">{errorId}</code>
          </p>
        )}

        {/* Action Buttons */}
        <div className="space-y-2">
          <button
            onClick={onRetry}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded transition duration-200 text-sm"
          >
            Try Again
          </button>
          <button
            onClick={() => window.history.back()}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold py-2 px-4 rounded transition duration-200 text-sm"
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}

export function PageErrorBoundary({ children }) {
  return (
    <ErrorBoundary
      level="page"
      fallback={PageErrorBoundaryFallback}
    >
      {children}
    </ErrorBoundary>
  );
}

export default PageErrorBoundary;
