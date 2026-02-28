import { captureHandledError } from '../services/errorLog.service';

type RealtimeScope = 'auth' | 'donor' | 'ngo' | 'bloodbank' | 'admin' | 'unknown';

type RealtimeReporterContext = {
  hook: string;
  scope?: RealtimeScope;
};

type RealtimeErrorOptions = {
  error: unknown;
  kind: string;
  fallbackMessage: string;
  setError: (value: string | null) => void;
  setLoading: (value: boolean) => void;
  metadata?: Record<string, unknown>;
};

export const reportRealtimeError = (
  context: RealtimeReporterContext,
  error: unknown,
  kind: string,
  metadata?: Record<string, unknown>
) => {
  void captureHandledError(error, {
    source: 'frontend',
    scope: context.scope || 'unknown',
    metadata: {
      hook: context.hook,
      kind,
      ...(metadata || {}),
    },
  });
};

export const failRealtimeLoad = (
  context: RealtimeReporterContext,
  options: RealtimeErrorOptions
) => {
  reportRealtimeError(context, options.error, options.kind, options.metadata);
  options.setError(options.fallbackMessage);
  options.setLoading(false);
};
