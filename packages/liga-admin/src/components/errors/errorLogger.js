/**
 * Error logging utility for structured error logging
 */

import { isDevelopment, isProduction } from './errorTypes';

export class ErrorLogger {
  /**
   * Log an error with structured context
   * @param {Error} error - The error object
   * @param {Object} context - Additional context (component name, userId, etc.)
   * @param {string} level - Log level ('error', 'warn', etc.)
   */
  static log(error, context = {}, level = 'error') {
    const timestamp = new Date().toISOString();
    const errorId = this.generateErrorId();
    
    const logData = {
      errorId,
      timestamp,
      message: error?.message || 'Unknown error',
      type: error?.name || 'Error',
      level,
      ...context,
    };

    if (isDevelopment()) {
      // In development, include full stack trace
      console.error(`[${level.toUpperCase()}] Error ${errorId}:`, {
        ...logData,
        stack: error?.stack,
      });
    } else if (isProduction()) {
      // In production, log error ID and context but not stack trace
      console.error(`[${level.toUpperCase()}] Error ${errorId}:`, {
        ...logData,
        stack: undefined,
      });
    }

    return errorId;
  }

  /**
   * Log an error boundary catch
   * @param {Error} error - The error from getDerivedStateFromError
   * @param {Object} errorInfo - The errorInfo from componentDidCatch
   * @param {Object} context - Additional context (boundary level, etc.)
   */
  static logBoundaryError(error, errorInfo, context = {}) {
    const errorId = this.generateErrorId();
    
    if (isDevelopment()) {
      console.error(`[ERROR BOUNDARY] Error ${errorId}:`, {
        error: error?.message || 'Unknown error',
        errorStack: errorInfo?.componentStack,
        boundaryLevel: context.boundaryLevel || 'unknown',
        timestamp: new Date().toISOString(),
        ...context,
      });
    } else if (isProduction()) {
      console.error(`[ERROR BOUNDARY] Error ${errorId}:`, {
        error: error?.message || 'Unknown error',
        boundaryLevel: context.boundaryLevel || 'unknown',
        timestamp: new Date().toISOString(),
        // Don't include stack in production
        ...Object.fromEntries(
          Object.entries(context).filter(([key]) => key !== 'errorInfo')
        ),
      });
    }

    return errorId;
  }

  /**
   * Generate a unique error ID for tracking
   * @returns {string} Error ID in format ERROR-TIMESTAMP-RANDOM
   */
  static generateErrorId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `ERROR-${timestamp}-${random}`;
  }

  /**
   * Log a network error with specific handling
   * @param {Error} error - The network error
   * @param {string} endpoint - The API endpoint that failed
   */
  static logNetworkError(error, endpoint) {
    return this.log(error, {
      type: 'NETWORK_ERROR',
      endpoint,
      component: 'NetworkBoundary',
    });
  }

  /**
   * Log an auth error
   * @param {Error} error - The auth error
   * @param {string} reason - Why the auth failed
   */
  static logAuthError(error, reason) {
    return this.log(error, {
      type: 'AUTH_ERROR',
      reason,
      component: 'AuthCheck',
    });
  }
}

export default ErrorLogger;
