import { captureFatalError, captureHandledError } from '../services/errorLog.service';

let initialized = false;
let isCapturingConsoleError = false;

const toReason = (event: PromiseRejectionEvent): unknown => {
  if (event.reason instanceof Error) return event.reason;
  if (typeof event.reason === 'string') return new Error(event.reason);
  try {
    return new Error(JSON.stringify(event.reason));
  } catch {
    return new Error('Unhandled promise rejection');
  }
};

export const initGlobalErrorLogging = () => {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  const originalConsoleError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    originalConsoleError(...args);
    if (isCapturingConsoleError) return;
    try {
      isCapturingConsoleError = true;
      const firstErrorArg = args.find((arg) => arg instanceof Error) as Error | undefined;
      const fallbackMessage = args
        .map((arg) => {
          if (typeof arg === 'string') return arg;
          if (arg instanceof Error) return arg.message;
          try {
            return JSON.stringify(arg);
          } catch {
            return String(arg);
          }
        })
        .filter(Boolean)
        .join(' | ')
        .slice(0, 800);
      void captureHandledError(firstErrorArg || new Error(fallbackMessage || 'console.error called'), {
        source: 'frontend',
        metadata: {
          kind: 'console.error',
          argsPreview: fallbackMessage || null,
        },
      });
    } finally {
      isCapturingConsoleError = false;
    }
  };

  window.addEventListener('error', (event) => {
    void captureFatalError(event.error || new Error(event.message || 'Unknown window error'), {
      source: 'frontend',
      metadata: {
        kind: 'window.error',
        filename: event.filename || null,
        lineno: event.lineno || null,
        colno: event.colno || null,
      },
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    void captureFatalError(toReason(event), {
      source: 'frontend',
      metadata: {
        kind: 'window.unhandledrejection',
      },
    });
  });
};
