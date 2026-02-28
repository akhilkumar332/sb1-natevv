import { notify } from 'services/notify.service';
import { captureHandledError } from '../services/errorLog.service';

type FeedbackScope = 'auth' | 'donor' | 'ngo' | 'bloodbank' | 'admin' | 'unknown';

export type RunWithFeedbackOptions<T> = {
  action: () => Promise<T>;
  successMessage?: string | ((result: T) => string);
  errorMessage: string;
  capture?: {
    scope?: FeedbackScope;
    metadata?: Record<string, unknown>;
  };
  invalidate?: () => Promise<unknown> | unknown;
};

export const runWithFeedback = async <T>(options: RunWithFeedbackOptions<T>): Promise<T | null> => {
  try {
    const result = await options.action();
    if (options.invalidate) {
      try {
        await options.invalidate();
      } catch (invalidateError) {
        void captureHandledError(invalidateError, {
          source: 'frontend',
          scope: options.capture?.scope || 'unknown',
          metadata: {
            kind: 'runWithFeedback.invalidate',
            ...(options.capture?.metadata || {}),
          },
        });
      }
    }
    if (options.successMessage) {
      try {
        notify.success(
          typeof options.successMessage === 'function'
            ? options.successMessage(result)
            : options.successMessage
        );
      } catch (successMessageError) {
        void captureHandledError(successMessageError, {
          source: 'frontend',
          scope: options.capture?.scope || 'unknown',
          metadata: {
            kind: 'runWithFeedback.successMessage',
            ...(options.capture?.metadata || {}),
          },
        });
      }
    }
    return result;
  } catch (error) {
    void captureHandledError(error, {
      source: 'frontend',
      scope: options.capture?.scope || 'unknown',
      metadata: {
        kind: 'runWithFeedback.action',
        ...(options.capture?.metadata || {}),
      },
    });
    notify.error((error as { message?: string })?.message || options.errorMessage);
    return null;
  }
};
