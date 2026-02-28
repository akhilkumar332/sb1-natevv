import { useCallback, useEffect, useRef } from 'react';
import { captureHandledError } from '../services/errorLog.service';

type ErrorScope = 'auth' | 'donor' | 'ngo' | 'bloodbank' | 'admin' | 'unknown';
type ErrorSource = 'frontend' | 'functions' | 'netlify' | 'unknown';

type ReporterOptions = {
  scope: ErrorScope;
  source?: ErrorSource;
  metadata?: Record<string, unknown>;
};

export const useScopedErrorReporter = ({ scope, source = 'frontend', metadata = {} }: ReporterOptions) => {
  const metadataRef = useRef<Record<string, unknown>>(metadata);

  useEffect(() => {
    metadataRef.current = metadata;
  }, [metadata]);

  return useCallback(
    (error: unknown, kind: string, extraMetadata?: Record<string, unknown>) => {
      void captureHandledError(error, {
        source,
        scope,
        metadata: {
          ...metadataRef.current,
          kind,
          ...(extraMetadata || {}),
        },
      });
    },
    [scope, source]
  );
};

export default useScopedErrorReporter;
