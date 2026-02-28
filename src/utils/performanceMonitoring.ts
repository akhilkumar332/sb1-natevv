/**
 * Performance Monitoring Utility
 *
 * Monitors and reports performance metrics
 */

// Performance metrics type
export interface PerformanceMetrics {
  fcp?: number; // First Contentful Paint
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  ttfb?: number; // Time to First Byte
}

/**
 * Report performance metric to analytics
 */
const reportMetric = (metric: { name: string; value: number; rating?: string }) => {
  // Keep console output in development only.
  // In production, wire this to a telemetry sink if needed.
  if (import.meta.env.DEV) {
    console.log('[Performance]', metric);
  }
};

/**
 * Measure First Contentful Paint (FCP)
 */
export const measureFCP = () => {
  if ('PerformanceObserver' in window) {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          reportMetric({
            name: 'FCP',
            value: entry.startTime,
            rating: entry.startTime < 1800 ? 'good' : entry.startTime < 3000 ? 'needs-improvement' : 'poor',
          });
          observer.disconnect();
        }
      }
    });
    observer.observe({ entryTypes: ['paint'] });
  }
};

/**
 * Measure Largest Contentful Paint (LCP)
 */
export const measureLCP = () => {
  if ('PerformanceObserver' in window) {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1] as any;
      reportMetric({
        name: 'LCP',
        value: lastEntry.startTime,
        rating: lastEntry.startTime < 2500 ? 'good' : lastEntry.startTime < 4000 ? 'needs-improvement' : 'poor',
      });
    });
    observer.observe({ entryTypes: ['largest-contentful-paint'] });
  }
};

/**
 * Measure First Input Delay (FID)
 */
export const measureFID = () => {
  if ('PerformanceObserver' in window) {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const fidEntry = entry as any;
        const fid = fidEntry.processingStart - fidEntry.startTime;
        reportMetric({
          name: 'FID',
          value: fid,
          rating: fid < 100 ? 'good' : fid < 300 ? 'needs-improvement' : 'poor',
        });
        observer.disconnect();
      }
    });
    observer.observe({ entryTypes: ['first-input'] });
  }
};

/**
 * Measure Cumulative Layout Shift (CLS)
 */
export const measureCLS = () => {
  if ('PerformanceObserver' in window) {
    let clsScore = 0;
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const layoutShiftEntry = entry as any;
        if (!layoutShiftEntry.hadRecentInput) {
          clsScore += layoutShiftEntry.value;
        }
      }
      reportMetric({
        name: 'CLS',
        value: clsScore,
        rating: clsScore < 0.1 ? 'good' : clsScore < 0.25 ? 'needs-improvement' : 'poor',
      });
    });
    observer.observe({ entryTypes: ['layout-shift'] });

    // Report after 5 seconds
    setTimeout(() => {
      observer.disconnect();
    }, 5000);
  }
};

/**
 * Measure Time to First Byte (TTFB)
 */
export const measureTTFB = () => {
  if ('performance' in window && 'timing' in performance) {
    const timing = performance.timing;
    const ttfb = timing.responseStart - timing.requestStart;
    reportMetric({
      name: 'TTFB',
      value: ttfb,
      rating: ttfb < 800 ? 'good' : ttfb < 1800 ? 'needs-improvement' : 'poor',
    });
  }
};

/**
 * Measure Navigation Timing
 */
export const measureNavigationTiming = () => {
  if ('performance' in window && 'timing' in performance) {
    const timing = performance.timing;
    const metrics = {
      dns: timing.domainLookupEnd - timing.domainLookupStart,
      tcp: timing.connectEnd - timing.connectStart,
      request: timing.responseEnd - timing.requestStart,
      domParsing: timing.domInteractive - timing.domLoading,
      domContentLoaded: timing.domContentLoadedEventEnd - timing.domContentLoadedEventStart,
      pageLoad: timing.loadEventEnd - timing.loadEventStart,
    };

    console.log('[Navigation Timing]', metrics);
    return metrics;
  }
};

/**
 * Measure Resource Timing
 */
export const measureResourceTiming = () => {
  if ('performance' in window) {
    const resources = performance.getEntriesByType('resource');
    const slowResources = resources
      .filter((resource: any) => resource.duration > 1000)
      .map((resource: any) => ({
        name: resource.name,
        duration: resource.duration,
        size: resource.transferSize,
      }));

    if (import.meta.env.DEV && slowResources.length > 0) {
      console.warn('[Slow Resources]', slowResources);
    }
    return slowResources;
  }
};

/**
 * Measure Bundle Size
 */
export const measureBundleSize = () => {
  if ('performance' in window) {
    const resources = performance.getEntriesByType('resource');
    const jsResources = resources.filter((resource: any) =>
      resource.name.includes('.js')
    );

    const totalSize = jsResources.reduce(
      (sum: number, resource: any) => sum + (resource.transferSize || 0),
      0
    );

    const metrics = {
      totalJsSize: totalSize,
      totalJsRequests: jsResources.length,
      averageJsSize: totalSize / jsResources.length,
    };

    console.log('[Bundle Size]', metrics);
    return metrics;
  }
};

/**
 * Initialize all performance monitoring
 */
export const initPerformanceMonitoring = () => {
  if (typeof window === 'undefined') return;

  // Core Web Vitals
  measureFCP();
  measureLCP();
  measureFID();
  measureCLS();
  measureTTFB();

  // Additional metrics (only in development)
  if (import.meta.env.DEV) {
    window.addEventListener('load', () => {
      setTimeout(() => {
        measureNavigationTiming();
        measureResourceTiming();
        measureBundleSize();
      }, 0);
    });
  }
};

/**
 * Measure component render time
 */
export const measureComponentRender = (componentName: string, startTime: number) => {
  const endTime = performance.now();
  const duration = endTime - startTime;

  if (import.meta.env.DEV && duration > 16) {
    // Slower than 60fps
    console.warn(`[Slow Render] ${componentName}: ${duration.toFixed(2)}ms`);
  }

  return duration;
};

/**
 * Create performance mark
 */
export const performanceMark = (name: string) => {
  if ('performance' in window && 'mark' in performance) {
    performance.mark(name);
  }
};

/**
 * Measure between two performance marks
 */
export const performanceMeasure = (name: string, startMark: string, endMark: string) => {
  if ('performance' in window && 'measure' in performance) {
    performance.measure(name, startMark, endMark);
    const measure = performance.getEntriesByName(name)[0];
    if (import.meta.env.DEV) {
      console.log(`[Performance Measure] ${name}: ${measure.duration.toFixed(2)}ms`);
    }
    return measure.duration;
  }
};

export default {
  init: initPerformanceMonitoring,
  measureFCP,
  measureLCP,
  measureFID,
  measureCLS,
  measureTTFB,
  measureNavigationTiming,
  measureResourceTiming,
  measureBundleSize,
  measureComponentRender,
  performanceMark,
  performanceMeasure,
};
