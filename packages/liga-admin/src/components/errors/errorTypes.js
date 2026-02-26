/**
 * Error boundary types and constants
 */

export const ERROR_TYPES = {
  RENDER: 'RENDER_ERROR',
  ASYNC: 'ASYNC_ERROR',
  NETWORK: 'NETWORK_ERROR',
  AUTH: 'AUTH_ERROR',
  DATA: 'DATA_ERROR',
  UNKNOWN: 'UNKNOWN_ERROR',
};

export const ERROR_MESSAGES = {
  [ERROR_TYPES.RENDER]: 'Something went wrong. Please try again or navigate back.',
  [ERROR_TYPES.ASYNC]: 'An unexpected error occurred. Please try your action again.',
  [ERROR_TYPES.NETWORK]: 'Connection lost. Please check your internet and try again.',
  [ERROR_TYPES.AUTH]: 'Your session has expired. Please log in again.',
  [ERROR_TYPES.DATA]: 'There was an issue processing your data. Please try again.',
  [ERROR_TYPES.UNKNOWN]: 'An unexpected error occurred. Our team has been notified.',
};

export const isDevelopment = () => process.env.NODE_ENV === 'development';
export const isProduction = () => process.env.NODE_ENV === 'production';
