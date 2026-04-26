/**
 * Monitoring Service
 *
 * Handles error tracking, performance monitoring, and analytics
 */
import { captureHandledError } from './errorLog.service';
import {
  clearFirebaseAnalyticsUser,
  initializeFirebaseAnalytics,
  setFirebaseAnalyticsUser,
  trackFirebaseAnalyticsEvent,
  trackFirebaseAnalyticsPageView,
} from './firebaseAnalytics.service';
import { FIREBASE_ANALYTICS_EVENTS } from '../constants/analytics';

const debugLog = (...args: unknown[]) => {
  if (import.meta.env.DEV) {
    console.log(...args);
  }
};

interface MonitoringConfig {
  enableErrorTracking: boolean;
  enablePerformanceMonitoring: boolean;
  enableAnalytics: boolean;
}

interface ErrorContext {
  userId?: string;
  url?: string;
  userAgent?: string;
  timestamp?: number;
  [key: string]: any;
}

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  context?: Record<string, any>;
}

interface AnalyticsUserContext {
  [key: string]: string | number | boolean | null | undefined;
}

class MonitoringService {
  private config: MonitoringConfig;
  private initialized: boolean = false;

  constructor() {
    this.config = {
      enableErrorTracking: import.meta.env.VITE_ENABLE_ERROR_TRACKING === 'true',
      enablePerformanceMonitoring: import.meta.env.VITE_ENABLE_PERFORMANCE_MONITORING === 'true',
      enableAnalytics: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
    };
  }

  /**
   * Initialize monitoring services
   */
  initialize(): void {
    if (this.initialized) {
      return;
    }

    // Initialize Sentry or other error tracking service
    if (this.config.enableErrorTracking && import.meta.env.VITE_SENTRY_DSN) {
      this.initializeErrorTracking();
    }

    // Initialize performance monitoring
    if (this.config.enablePerformanceMonitoring) {
      this.initializePerformanceMonitoring();
    }

    // Initialize analytics
    if (this.config.enableAnalytics) {
      this.initializeAnalytics();
    }

    this.initialized = true;
  }

  /**
   * Initialize error tracking (Sentry)
   */
  private initializeErrorTracking(): void {
    // In production, you would initialize Sentry here:
    // Sentry.init({
    //   dsn: import.meta.env.VITE_SENTRY_DSN,
    //   environment: import.meta.env.MODE,
    //   tracesSampleRate: 1.0,
    // });

    debugLog('Error tracking initialized');
  }

  /**
   * Initialize performance monitoring
   */
  private initializePerformanceMonitoring(): void {
    // Runtime vitals are measured in src/utils/performanceMonitoring.ts.
    // Keep this service as the sink only to avoid duplicate observers.
    debugLog('Performance monitoring sink initialized');
  }

  /**
   * Initialize analytics (Google Analytics)
   */
  private initializeAnalytics(): void {
    void initializeFirebaseAnalytics();
    debugLog('Analytics initialized');
  }

  /**
   * Log an error
   */
  logError(error: Error, context?: ErrorContext): void {
    if (!this.config.enableErrorTracking) {
      void captureHandledError(error, {
        source: 'frontend',
        scope: 'unknown',
        metadata: {
          kind: 'monitoring.log_error.disabled',
          ...(context || {}),
        },
      });
      return;
    }

    const errorData = {
      message: error.message,
      stack: error.stack,
      context: {
        ...context,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: Date.now(),
      }
    };

    // In production, send to Sentry:
    // Sentry.captureException(error, { extra: errorData.context });

    void captureHandledError(error, {
      source: 'frontend',
      scope: 'unknown',
      metadata: {
        kind: 'monitoring.log_error',
        ...(errorData.context || {}),
      },
    });
  }

  /**
   * Track performance metric
   */
  trackPerformance(metric: PerformanceMetric): void {
    if (!this.config.enablePerformanceMonitoring) {
      return;
    }

    // In production, send to analytics or monitoring service
    debugLog('Performance metric:', metric);

    if (this.config.enableAnalytics) {
      void trackFirebaseAnalyticsEvent(FIREBASE_ANALYTICS_EVENTS.webVitals, {
        metric_name: metric.name,
        metric_unit: metric.unit,
        metric_value: Math.round(metric.value),
        page_path: typeof window !== 'undefined' ? window.location.pathname : undefined,
        ...metric.context,
      });
    }
  }

  /**
   * Track page view
   */
  trackPageView(page: string, pageContext?: Record<string, any>): void {
    if (!this.config.enableAnalytics) {
      return;
    }

    void trackFirebaseAnalyticsPageView(page, pageContext);
    debugLog('Page view tracked:', page);
  }

  /**
   * Track custom event
   */
  trackEvent(eventName: string, eventParams?: Record<string, any>): void {
    if (!this.config.enableAnalytics) {
      return;
    }

    void trackFirebaseAnalyticsEvent(eventName, eventParams);
    debugLog('Event tracked:', eventName, eventParams);
  }

  /**
   * Set user context for error tracking
   */
  setUser(userId: string, analyticsContext?: AnalyticsUserContext): void {
    if (this.config.enableAnalytics) {
      void setFirebaseAnalyticsUser(userId, analyticsContext);
    }
    debugLog('User context set:', { userId, analyticsContext });
  }

  /**
   * Clear user context
   */
  clearUser(): void {
    if (this.config.enableAnalytics) {
      void clearFirebaseAnalyticsUser();
    }

    debugLog('User context cleared');
  }

  /**
   * Add breadcrumb for debugging
   */
  addBreadcrumb(message: string, data?: Record<string, any>): void {
    if (!this.config.enableErrorTracking) {
      return;
    }

    // In production, add breadcrumb to Sentry:
    // Sentry.addBreadcrumb({
    //   message,
    //   data,
    //   timestamp: Date.now() / 1000,
    // });

    debugLog('Breadcrumb:', message, data);
  }

  /**
   * Monitor API call performance
   */
  monitorAPICall(endpoint: string, duration: number, status: number): void {
    this.trackPerformance({
      name: 'API_Call',
      value: duration,
      unit: 'ms',
      context: {
        endpoint,
        status,
      }
    });

    // Track slow API calls
    if (duration > 3000) {
      this.addBreadcrumb('Slow API call detected', {
        endpoint,
        duration,
        status,
      });
    }

    // Track failed API calls
    if (status >= 400) {
      this.addBreadcrumb('API call failed', {
        endpoint,
        duration,
        status,
      });
    }
  }
}

// Export singleton instance
export const monitoringService = new MonitoringService();
export const initMonitoring = () => monitoringService.initialize();
