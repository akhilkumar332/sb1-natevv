/**
 * Error Handling System
 *
 * This file provides custom error classes and error handling utilities
 * for consistent error management across the application.
 */

import { logError } from './logger';
import { ERROR_MESSAGES } from '../constants/app.constants';

// ============================================================================
// CUSTOM ERROR CLASSES
// ============================================================================

/**
 * Base custom error class
 */
export class AppError extends Error {
  public code: string;
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, code: string = 'APP_ERROR', statusCode: number = 500) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Authentication error
 */
export class AuthError extends AppError {
  constructor(message: string = 'Authentication failed', code: string = 'AUTH_ERROR') {
    super(message, code, 401);
  }
}

/**
 * Database error (Firestore)
 */
export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed', code: string = 'DB_ERROR') {
    super(message, code, 500);
  }
}

/**
 * Validation error
 */
export class ValidationError extends AppError {
  public errors: string[];

  constructor(
    message: string = 'Validation failed',
    errors: string[] = [],
    code: string = 'VALIDATION_ERROR'
  ) {
    super(message, code, 400);
    this.errors = errors;
  }
}

/**
 * Permission error
 */
export class PermissionError extends AppError {
  constructor(
    message: string = ERROR_MESSAGES.PERMISSION_DENIED,
    code: string = 'PERMISSION_ERROR'
  ) {
    super(message, code, 403);
  }
}

/**
 * Not found error
 */
export class NotFoundError extends AppError {
  constructor(
    message: string = 'Resource not found',
    code: string = 'NOT_FOUND_ERROR'
  ) {
    super(message, code, 404);
  }
}

/**
 * Network error
 */
export class NetworkError extends AppError {
  constructor(
    message: string = ERROR_MESSAGES.NETWORK_ERROR,
    code: string = 'NETWORK_ERROR'
  ) {
    super(message, code, 503);
  }
}

/**
 * Rate limit error
 */
export class RateLimitError extends AppError {
  constructor(
    message: string = 'Too many requests. Please try again later.',
    code: string = 'RATE_LIMIT_ERROR'
  ) {
    super(message, code, 429);
  }
}

// ============================================================================
// ERROR TYPE GUARDS
// ============================================================================

/**
 * Check if error is an AppError
 */
export const isAppError = (error: any): error is AppError => {
  return error instanceof AppError;
};

/**
 * Check if error is an AuthError
 */
export const isAuthError = (error: any): error is AuthError => {
  return error instanceof AuthError;
};

/**
 * Check if error is a DatabaseError
 */
export const isDatabaseError = (error: any): error is DatabaseError => {
  return error instanceof DatabaseError;
};

/**
 * Check if error is a ValidationError
 */
export const isValidationError = (error: any): error is ValidationError => {
  return error instanceof ValidationError;
};

/**
 * Check if error is a PermissionError
 */
export const isPermissionError = (error: any): error is PermissionError => {
  return error instanceof PermissionError;
};

/**
 * Check if error is a NotFoundError
 */
export const isNotFoundError = (error: any): error is NotFoundError => {
  return error instanceof NotFoundError;
};

/**
 * Check if error is a NetworkError
 */
export const isNetworkError = (error: any): error is NetworkError => {
  return error instanceof NetworkError;
};

// ============================================================================
// ERROR MESSAGE MAPPING
// ============================================================================

/**
 * Map Firebase Auth error codes to user-friendly messages
 */
export const getAuthErrorMessage = (errorCode: string): string => {
  const authErrorMessages: Record<string, string> = {
    'auth/user-not-found': 'No account found with this email',
    'auth/wrong-password': 'Incorrect password',
    'auth/invalid-email': 'Invalid email address',
    'auth/user-disabled': 'This account has been disabled',
    'auth/email-already-in-use': 'An account with this email already exists',
    'auth/weak-password': 'Password is too weak. Use at least 6 characters',
    'auth/operation-not-allowed': 'This operation is not allowed',
    'auth/too-many-requests': 'Too many failed attempts. Please try again later',
    'auth/popup-closed-by-user': 'Sign-in popup was closed',
    'auth/popup-blocked': 'Sign-in popup was blocked by browser',
    'auth/invalid-credential': 'Invalid credentials provided',
    'auth/account-exists-with-different-credential': 'Account exists with different sign-in method',
    'auth/credential-already-in-use': 'This credential is already in use',
    'auth/invalid-verification-code': 'Invalid verification code',
    'auth/invalid-verification-id': 'Invalid verification ID',
    'auth/code-expired': 'Verification code has expired',
    'auth/captcha-check-failed': 'reCAPTCHA verification failed',
    'auth/missing-phone-number': 'Phone number is required',
    'auth/invalid-phone-number': 'Invalid phone number format',
    'auth/quota-exceeded': 'SMS quota exceeded. Please try again later',
  };

  return authErrorMessages[errorCode] || 'Authentication failed. Please try again.';
};

/**
 * Map Firestore error codes to user-friendly messages
 */
export const getFirestoreErrorMessage = (errorCode: string): string => {
  const firestoreErrorMessages: Record<string, string> = {
    'permission-denied': ERROR_MESSAGES.PERMISSION_DENIED,
    'not-found': 'The requested resource was not found',
    'already-exists': 'This resource already exists',
    'resource-exhausted': 'Service quota exceeded',
    'failed-precondition': 'Operation cannot be performed in current state',
    'aborted': 'Operation was aborted. Please try again',
    'out-of-range': 'Operation was out of valid range',
    'unimplemented': 'Operation is not implemented',
    'internal': 'Internal server error',
    'unavailable': 'Service temporarily unavailable',
    'data-loss': 'Data loss or corruption detected',
    'unauthenticated': 'Authentication required',
    'invalid-argument': 'Invalid argument provided',
    'deadline-exceeded': 'Operation deadline exceeded',
    'cancelled': 'Operation was cancelled',
  };

  return firestoreErrorMessages[errorCode] || ERROR_MESSAGES.GENERIC_ERROR;
};

/**
 * Get user-friendly error message from any error
 */
export const getUserFriendlyErrorMessage = (error: any): string => {
  // Custom app errors
  if (isAppError(error)) {
    return error.message;
  }

  // Firebase Auth errors
  if (error?.code?.startsWith('auth/')) {
    return getAuthErrorMessage(error.code);
  }

  // Firestore errors
  if (error?.code && typeof error.code === 'string') {
    return getFirestoreErrorMessage(error.code);
  }

  // Network errors
  if (error?.message?.toLowerCase().includes('network')) {
    return ERROR_MESSAGES.NETWORK_ERROR;
  }

  // Generic error with message
  if (error?.message) {
    return error.message;
  }

  return ERROR_MESSAGES.GENERIC_ERROR;
};

// ============================================================================
// ERROR HANDLING FUNCTIONS
// ============================================================================

/**
 * Handle error and log it
 * @param error - Error to handle
 * @param context - Context information
 * @returns User-friendly error message
 */
export const handleError = (error: any, context?: string): string => {
  const message = getUserFriendlyErrorMessage(error);

  logError(error, context);

  return message;
};

/**
 * Handle async function with error handling
 * @param fn - Async function to execute
 * @param errorMessage - Custom error message
 * @returns Promise with result or error
 */
export const handleAsync = async <T>(
  fn: () => Promise<T>,
  errorMessage?: string
): Promise<{ data?: T; error?: string }> => {
  try {
    const data = await fn();
    return { data };
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    const message = errorMessage || getUserFriendlyErrorMessage(errorObj);
    logError(errorObj, 'handleAsync');
    return { error: message };
  }
};

/**
 * Wrap a function with try-catch and error handling
 * @param fn - Function to wrap
 * @param errorHandler - Error handler function
 * @returns Wrapped function
 */
export const withErrorHandling = <T extends (...args: any[]) => any>(
  fn: T,
  errorHandler?: (error: any) => void
): T => {
  return ((...args: any[]) => {
    try {
      const result = fn(...args);

      // Handle async functions
      if (result instanceof Promise) {
        return result.catch(error => {
          const message = handleError(error, fn.name);
          if (errorHandler) {
            errorHandler(error);
          }
          throw new AppError(message);
        });
      }

      return result;
    } catch (error) {
      const message = handleError(error, fn.name);
      if (errorHandler) {
        errorHandler(error);
      }
      throw new AppError(message);
    }
  }) as T;
};

/**
 * Retry function with exponential backoff
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retries
 * @param baseDelay - Base delay in milliseconds
 * @returns Promise with result
 */
export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on certain errors
      if (
        isPermissionError(error) ||
        isAuthError(error) ||
        isValidationError(error)
      ) {
        throw error;
      }

      // Last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Calculate delay with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);

      logError(
        new Error(`Retry attempt ${attempt + 1}/${maxRetries}`),
        'retryWithBackoff'
      );

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};

/**
 * Create error boundary handler for React components
 * @param error - Error object
 * @param errorInfo - Error info from React
 */
export const handleReactError = (error: Error, errorInfo: any): void => {
  logError(error, 'React Error Boundary', {
    componentStack: errorInfo.componentStack,
  });
};

// ============================================================================
// ERROR REPORTING
// ============================================================================

/**
 * Report error to external service (placeholder for future integration)
 * @param error - Error to report
 * @param context - Context information
 * @param metadata - Additional metadata
 */
export const reportError = (
  error: any,
  context?: string,
  metadata?: Record<string, any>
): void => {
  // Log locally
  logError(error, context, metadata);

  // TODO: In production, integrate with error reporting service
  // Examples: Sentry, Rollbar, Bugsnag, etc.

  // Keep the structured debug dump in development only via debug channel.
  if (import.meta.env.DEV) {
    console.debug('Error Report:', {
      error,
      context,
      metadata,
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Create error report object
 * @param error - Error to report
 * @param context - Context information
 * @returns Error report object
 */
export const createErrorReport = (
  error: any,
  context?: string
): {
  message: string;
  code: string;
  stack?: string;
  context?: string;
  timestamp: string;
} => {
  return {
    message: getUserFriendlyErrorMessage(error),
    code: error?.code || 'UNKNOWN_ERROR',
    stack: error?.stack,
    context,
    timestamp: new Date().toISOString(),
  };
};

// ============================================================================
// VALIDATION ERROR HELPERS
// ============================================================================

/**
 * Create validation error from field errors
 * @param fieldErrors - Object with field names and error messages
 * @returns ValidationError instance
 */
export const createValidationError = (
  fieldErrors: Record<string, string>
): ValidationError => {
  const errors = Object.entries(fieldErrors).map(
    ([field, message]) => `${field}: ${message}`
  );

  return new ValidationError('Validation failed', errors);
};

/**
 * Throw validation error if condition is false
 * @param condition - Condition to check
 * @param message - Error message
 */
export const assertValid = (condition: boolean, message: string): void => {
  if (!condition) {
    throw new ValidationError(message);
  }
};

/**
 * Throw permission error if condition is false
 * @param condition - Condition to check
 * @param message - Error message
 */
export const assertPermission = (condition: boolean, message?: string): void => {
  if (!condition) {
    throw new PermissionError(message);
  }
};

/**
 * Throw not found error if value is null/undefined
 * @param value - Value to check
 * @param message - Error message
 */
export const assertExists = <T>(value: T | null | undefined, message?: string): T => {
  if (value === null || value === undefined) {
    throw new NotFoundError(message);
  }
  return value;
};
