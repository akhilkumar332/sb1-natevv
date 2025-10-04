/**
 * Logger Utility
 *
 * This file provides logging functions for different log levels.
 * Logs to console in development and can be extended for production logging.
 */

// ============================================================================
// LOG LEVELS
// ============================================================================

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

// ============================================================================
// LOG CONFIGURATION
// ============================================================================

interface LogConfig {
  enableConsoleLog: boolean;
  enableDebugInProduction: boolean;
  logLevel: LogLevel;
}

const defaultConfig: LogConfig = {
  enableConsoleLog: true,
  enableDebugInProduction: false,
  logLevel: import.meta.env.DEV ? LogLevel.DEBUG : LogLevel.INFO,
};

let config: LogConfig = { ...defaultConfig };

/**
 * Update logger configuration
 * @param newConfig - Partial configuration to update
 */
export const configureLogger = (newConfig: Partial<LogConfig>): void => {
  config = { ...config, ...newConfig };
};

/**
 * Reset logger configuration to defaults
 */
export const resetLoggerConfig = (): void => {
  config = { ...defaultConfig };
};

// ============================================================================
// LOG LEVEL UTILITIES
// ============================================================================

const logLevelPriority: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
};

/**
 * Check if log level should be logged based on config
 * @param level - Log level to check
 * @returns Boolean indicating if level should be logged
 */
const shouldLog = (level: LogLevel): boolean => {
  if (!config.enableConsoleLog) return false;

  // In production, skip debug logs unless explicitly enabled
  if (!import.meta.env.DEV && level === LogLevel.DEBUG && !config.enableDebugInProduction) {
    return false;
  }

  return logLevelPriority[level] >= logLevelPriority[config.logLevel];
};

// ============================================================================
// LOG FORMATTING
// ============================================================================

/**
 * Format log message with timestamp and level
 * @param level - Log level
 * @param message - Log message
 * @param context - Optional context
 * @returns Formatted log message
 */
const formatLogMessage = (
  level: LogLevel,
  message: string,
  context?: string
): string => {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` [${context}]` : '';
  return `[${timestamp}] ${level}${contextStr}: ${message}`;
};

/**
 * Get console method for log level
 * @param level - Log level
 * @returns Console method
 */
const getConsoleMethod = (level: LogLevel): (...args: any[]) => void => {
  switch (level) {
    case LogLevel.DEBUG:
      return console.debug;
    case LogLevel.INFO:
      return console.info;
    case LogLevel.WARN:
      return console.warn;
    case LogLevel.ERROR:
      return console.error;
    default:
      return console.log;
  }
};

/**
 * Get emoji for log level
 * @param level - Log level
 * @returns Emoji string
 */
const getLevelEmoji = (level: LogLevel): string => {
  switch (level) {
    case LogLevel.DEBUG:
      return '🔍';
    case LogLevel.INFO:
      return 'ℹ️';
    case LogLevel.WARN:
      return '⚠️';
    case LogLevel.ERROR:
      return '❌';
    default:
      return '📝';
  }
};

// ============================================================================
// CORE LOGGING FUNCTION
// ============================================================================

/**
 * Core logging function
 * @param level - Log level
 * @param message - Log message
 * @param context - Optional context
 * @param data - Optional additional data
 */
const log = (
  level: LogLevel,
  message: string,
  context?: string,
  data?: any
): void => {
  if (!shouldLog(level)) return;

  const formattedMessage = formatLogMessage(level, message, context);
  const emoji = getLevelEmoji(level);
  const consoleMethod = getConsoleMethod(level);

  if (data) {
    consoleMethod(`${emoji} ${formattedMessage}`, data);
  } else {
    consoleMethod(`${emoji} ${formattedMessage}`);
  }

  // TODO: In production, send logs to external service
  // Examples: CloudWatch, Datadog, LogRocket, etc.
};

// ============================================================================
// PUBLIC LOGGING FUNCTIONS
// ============================================================================

/**
 * Log debug message (only in development by default)
 * @param message - Debug message
 * @param context - Optional context
 * @param data - Optional additional data
 */
export const logDebug = (message: string, context?: string, data?: any): void => {
  log(LogLevel.DEBUG, message, context, data);
};

/**
 * Log info message
 * @param message - Info message
 * @param context - Optional context
 * @param data - Optional additional data
 */
export const logInfo = (message: string, context?: string, data?: any): void => {
  log(LogLevel.INFO, message, context, data);
};

/**
 * Log warning message
 * @param message - Warning message
 * @param context - Optional context
 * @param data - Optional additional data
 */
export const logWarn = (message: string, context?: string, data?: any): void => {
  log(LogLevel.WARN, message, context, data);
};

/**
 * Log error message
 * @param error - Error object or message
 * @param context - Optional context
 * @param data - Optional additional data
 */
export const logError = (error: Error | string, context?: string, data?: any): void => {
  const message = error instanceof Error ? error.message : error;
  const errorData = error instanceof Error ? { ...data, stack: error.stack } : data;

  log(LogLevel.ERROR, message, context, errorData);
};

// ============================================================================
// SPECIALIZED LOGGING FUNCTIONS
// ============================================================================

/**
 * Log user action
 * @param action - Action name
 * @param userId - User ID
 * @param data - Optional additional data
 */
export const logUserAction = (action: string, userId: string, data?: any): void => {
  logInfo(`User action: ${action}`, 'UserAction', {
    userId,
    ...data,
  });
};

/**
 * Log API call
 * @param method - HTTP method
 * @param endpoint - API endpoint
 * @param status - Response status
 * @param duration - Request duration in ms
 */
export const logApiCall = (
  method: string,
  endpoint: string,
  status: number,
  duration?: number
): void => {
  const level = status >= 400 ? LogLevel.ERROR : LogLevel.INFO;
  const message = `${method} ${endpoint} - ${status}`;

  log(level, message, 'API', duration ? { duration: `${duration}ms` } : undefined);
};

/**
 * Log database operation
 * @param operation - Operation type (read, write, update, delete)
 * @param collection - Firestore collection name
 * @param documentId - Document ID (optional)
 * @param data - Optional additional data
 */
export const logDatabaseOperation = (
  operation: 'read' | 'write' | 'update' | 'delete',
  collection: string,
  documentId?: string,
  data?: any
): void => {
  const message = documentId
    ? `${operation} ${collection}/${documentId}`
    : `${operation} ${collection}`;

  logDebug(message, 'Database', data);
};

/**
 * Log authentication event
 * @param event - Event type (login, logout, register, etc.)
 * @param userId - User ID (optional)
 * @param method - Auth method (email, phone, google)
 * @param data - Optional additional data
 */
export const logAuthEvent = (
  event: string,
  userId?: string,
  method?: string,
  data?: any
): void => {
  logInfo(`Auth: ${event}`, 'Authentication', {
    userId,
    method,
    ...data,
  });
};

/**
 * Log performance metric
 * @param metric - Metric name
 * @param value - Metric value
 * @param unit - Unit of measurement (ms, bytes, etc.)
 */
export const logPerformance = (metric: string, value: number, unit: string = 'ms'): void => {
  logDebug(`Performance: ${metric}`, 'Performance', {
    value: `${value}${unit}`,
  });
};

/**
 * Log feature usage
 * @param feature - Feature name
 * @param userId - User ID
 * @param data - Optional additional data
 */
export const logFeatureUsage = (feature: string, userId: string, data?: any): void => {
  logInfo(`Feature: ${feature}`, 'FeatureUsage', {
    userId,
    ...data,
  });
};

// ============================================================================
// PERFORMANCE TIMING UTILITIES
// ============================================================================

/**
 * Start a performance timer
 * @param label - Timer label
 * @returns Function to stop the timer and log duration
 */
export const startTimer = (label: string): (() => void) => {
  const startTime = performance.now();

  return () => {
    const duration = performance.now() - startTime;
    logPerformance(label, Math.round(duration));
  };
};

/**
 * Measure async function execution time
 * @param fn - Async function to measure
 * @param label - Timer label
 * @returns Promise with function result
 */
export const measureAsync = async <T>(
  fn: () => Promise<T>,
  label: string
): Promise<T> => {
  const stopTimer = startTimer(label);
  try {
    const result = await fn();
    stopTimer();
    return result;
  } catch (error) {
    stopTimer();
    throw error;
  }
};

// ============================================================================
// LOG GROUPS (for development)
// ============================================================================

/**
 * Create a log group
 * @param label - Group label
 * @param collapsed - Whether group should be collapsed by default
 */
export const startGroup = (label: string, collapsed: boolean = false): void => {
  if (!import.meta.env.DEV) return;

  if (collapsed) {
    console.groupCollapsed(label);
  } else {
    console.group(label);
  }
};

/**
 * End the current log group
 */
export const endGroup = (): void => {
  if (!import.meta.env.DEV) return;
  console.groupEnd();
};

/**
 * Log within a group
 * @param label - Group label
 * @param fn - Function to execute within group
 * @param collapsed - Whether group should be collapsed
 */
export const logGroup = (
  label: string,
  fn: () => void,
  collapsed: boolean = false
): void => {
  startGroup(label, collapsed);
  fn();
  endGroup();
};

// ============================================================================
// TABLE LOGGING (for development)
// ============================================================================

/**
 * Log data as table (development only)
 * @param data - Array of objects to display as table
 * @param label - Optional label
 */
export const logTable = (data: any[], label?: string): void => {
  if (!import.meta.env.DEV) return;

  if (label) {
    console.log(label);
  }
  console.table(data);
};

// ============================================================================
// TRACE LOGGING
// ============================================================================

/**
 * Log with stack trace (development only)
 * @param message - Message to log
 * @param context - Optional context
 */
export const logTrace = (message: string, context?: string): void => {
  if (!import.meta.env.DEV) return;

  console.trace(formatLogMessage(LogLevel.DEBUG, message, context));
};

// ============================================================================
// ASSERT LOGGING
// ============================================================================

/**
 * Log assertion (development only)
 * @param condition - Condition to assert
 * @param message - Message if assertion fails
 */
export const logAssert = (condition: boolean, message: string): void => {
  if (!import.meta.env.DEV) return;

  console.assert(condition, message);
};

// ============================================================================
// CLEAR LOGS
// ============================================================================

/**
 * Clear console (development only)
 */
export const clearLogs = (): void => {
  if (!import.meta.env.DEV) return;
  console.clear();
};

// ============================================================================
// EXPORT DEFAULT LOGGER OBJECT
// ============================================================================

export const logger = {
  debug: logDebug,
  info: logInfo,
  warn: logWarn,
  error: logError,
  userAction: logUserAction,
  apiCall: logApiCall,
  db: logDatabaseOperation,
  auth: logAuthEvent,
  performance: logPerformance,
  feature: logFeatureUsage,
  startTimer,
  measureAsync,
  group: logGroup,
  table: logTable,
  trace: logTrace,
  assert: logAssert,
  clear: clearLogs,
  configure: configureLogger,
  reset: resetLoggerConfig,
};

export default logger;
