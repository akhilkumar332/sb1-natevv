import type { MutableRefObject } from 'react';

const TRANSIENT_REALTIME_CODES = new Set([
  'already-exists',
  'unavailable',
  'deadline-exceeded',
  'aborted',
  'internal',
  'cancelled',
]);

export const isTransientRealtimeCode = (code: unknown): boolean =>
  typeof code === 'string' && TRANSIENT_REALTIME_CODES.has(code);

export const clearRealtimeRetryTimeout = (
  timeoutRef: MutableRefObject<number | null>
) => {
  if (typeof window === 'undefined') return;
  if (timeoutRef.current) {
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }
};

export const scheduleRealtimeRetry = (options: {
  timeoutRef: MutableRefObject<number | null>;
  delayMs: number;
  onRetry: () => void;
}) => {
  if (typeof window === 'undefined') return;
  clearRealtimeRetryTimeout(options.timeoutRef);
  options.timeoutRef.current = window.setTimeout(options.onRetry, options.delayMs);
};
