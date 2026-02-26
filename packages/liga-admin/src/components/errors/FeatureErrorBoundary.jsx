/**
 * FeatureErrorBoundary - Error boundary for individual features/components
 * Allows graceful error handling within a feature without affecting the whole page
 */

import React from 'react';
import ErrorBoundary from './ErrorBoundary';

function FeatureErrorBoundaryFallback(error, onRetry, errorId) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded p-4" role="alert">
      <div className="flex gap-3">
        {/* Alert Icon */}
        <div className="flex-shrink-0">
          <svg
            className="w-5 h-5 text-amber-600 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c.866 1.5 2.926 2.871 5.303 2.871s4.437-1.372 5.303-2.871m0 0a3.75 3.75 0 11-7.5 0m7.5 0a3.75 3.75 0 1-7.5 0m0 0c-.866-1.5-2.926-2.871-5.303-2.871S2.25 9.75 1.5 11.126m16.5 0v3.75m0 0h3.75m-3.75 0h-7.5"
            />
          </svg>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-amber-800 mb-1">
            Feature Error
          </h3>
          <p className="text-sm text-amber-700 mb-3">
            {error?.message || 'This feature encountered an error. Please try again.'}
          </p>

          {/* Error ID */}
          {errorId && (
            <p className="text-xs text-amber-600 mb-3 font-mono">
              Error ID: {errorId}
            </p>
          )}

          {/* Action Buttons - Compact */}
          <div className="flex gap-2">
            <button
              onClick={onRetry}
              className="inline-flex items-center px-3 py-1 rounded text-sm font-medium bg-amber-100 hover:bg-amber-200 text-amber-900 transition duration-200"
            >
              Retry
            </button>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center px-3 py-1 rounded text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-900 transition duration-200"
            >
              Reload Page
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FeatureErrorBoundary({ children, featureName = 'Feature' }) {
  return (
    <ErrorBoundary
      level="feature"
      fallback={FeatureErrorBoundaryFallback}
    >
      {children}
    </ErrorBoundary>
  );
}

export default FeatureErrorBoundary;
