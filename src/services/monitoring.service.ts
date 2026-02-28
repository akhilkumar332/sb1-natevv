/**
 * Monitoring Service
 *
 * Handles error tracking, performance monitoring, and analytics
 */
import { captureHandledError } from './errorLog.service';

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
    if (this.config.enableAnalytics && import.meta.env.VITE_GA_TRACKING_ID) {
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
    // Monitor Core Web Vitals
    if ('PerformanceObserver' in window) {
      try {
        // Monitor LCP (Largest Contentful Paint)
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as any;
          this.trackPerformance({
            name: 'LCP',
            value: lastEntry.renderTime || lastEntry.loadTime,
            unit: 'ms',
            context: { url: window.location.pathname }
          });
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

        // Monitor FID (First Input Delay)
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            this.trackPerformance({
              name: 'FID',
              value: entry.processingStart - entry.startTime,
              unit: 'ms',
              context: { url: window.location.pathname }
            });
          });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });

        // Monitor CLS (Cumulative Layout Shift)
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          });
          this.trackPerformance({
            name: 'CLS',
            value: clsValue,
            unit: 'score',
            context: { url: window.location.pathname }
          });
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });

      } catch (error) {
        void captureHandledError(error, {
          source: 'frontend',
          scope: 'unknown',
          metadata: { kind: 'monitoring.performance.setup' },
        });
      }
    }

    debugLog('Performance monitoring initialized');
  }

  /**
   * Initialize analytics (Google Analytics)
   */
  private initializeAnalytics(): void {
    // In production, you would initialize GA here:
    // gtag('config', import.meta.env.VITE_GA_TRACKING_ID);

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

    // Track in Google Analytics if enabled
    if (this.config.enableAnalytics && typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'web_vitals', {
        event_category: 'Web Vitals',
        event_label: metric.name,
        value: Math.round(metric.value),
        metric_value: metric.value,
        metric_unit: metric.unit,
      });
    }
  }

  /**
   * Track page view
   */
  trackPageView(page: string): void {
    if (!this.config.enableAnalytics) {
      return;
    }

    // In production, send to Google Analytics:
    // gtag('config', import.meta.env.VITE_GA_TRACKING_ID, {
    //   page_path: page
    // });

    debugLog('Page view tracked:', page);
  }

  /**
   * Track custom event
   */
  trackEvent(eventName: string, eventParams?: Record<string, any>): void {
    if (!this.config.enableAnalytics) {
      return;
    }

    // In production, send to Google Analytics:
    // gtag('event', eventName, eventParams);

    debugLog('Event tracked:', eventName, eventParams);
  }

  /**
   * Set user context for error tracking
   */
  setUser(userId: string, email?: string): void {
    if (!this.config.enableErrorTracking) {
      return;
    }

    // In production, set user in Sentry:
    // Sentry.setUser({ id: userId, email });

    debugLog('User context set:', { userId, email });
  }

  /**
   * Clear user context
   */
  clearUser(): void {
    if (!this.config.enableErrorTracking) {
      return;
    }

    // In production, clear user in Sentry:
    // Sentry.setUser(null);

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

// Initialize on import (production only)
if (import.meta.env.PROD) {
  monitoringService.initialize();
}
