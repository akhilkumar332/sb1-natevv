import toast, { type Toast, type ToastOptions, type ValueOrFunction } from 'react-hot-toast';
import { captureHandledError } from './errorLog.service';

type NotificationContext = {
  scope?: 'auth' | 'donor' | 'ngo' | 'bloodbank' | 'admin' | 'unknown';
  source?: 'frontend' | 'functions' | 'netlify' | 'unknown';
  metadata?: Record<string, unknown>;
};

type ScopedErrorNotifierOptions = {
  scope: NonNullable<NotificationContext['scope']>;
  page: string;
  source?: NonNullable<NotificationContext['source']>;
};

const resolveMessage = (
  message: ValueOrFunction<string, Toast>,
  toastInstance: Toast
): string => {
  try {
    if (typeof message === 'function') {
      const result = message(toastInstance);
      return typeof result === 'string' ? result : String(result || '');
    }
    return String(message || '');
  } catch {
    return 'Notification error';
  }
};

export const notify = {
  success(message: ValueOrFunction<string, Toast>, options?: ToastOptions) {
    return toast.success(message, options);
  },
  info(message: ValueOrFunction<string, Toast>, options?: ToastOptions) {
    return toast(message, options);
  },
  loading(message: ValueOrFunction<string, Toast>, options?: ToastOptions) {
    return toast.loading(message, options);
  },
  custom(message: ValueOrFunction<JSX.Element, Toast>, options?: ToastOptions) {
    return toast.custom(message, options);
  },
  dismiss(toastId?: string) {
    toast.dismiss(toastId);
  },
  remove(toastId?: string) {
    toast.remove(toastId);
  },
  error(
    message: ValueOrFunction<string, Toast>,
    options?: ToastOptions,
    context?: NotificationContext
  ) {
    if (context) {
      const safeMessage = resolveMessage(message, {
        id: options?.id || 'notify-error',
      } as Toast);
      void captureHandledError(new Error(safeMessage || 'Notification error'), {
        source: context.source || 'frontend',
        scope: context.scope || 'unknown',
        metadata: {
          kind: 'notify.error',
          ...(context.metadata || {}),
        },
      });
    }
    return toast.error(message, options);
  },
  fromError(
    error: unknown,
    fallbackMessage: string,
    options?: ToastOptions,
    context?: NotificationContext
  ) {
    const resolvedMessage = error instanceof Error && error.message
      ? error.message
      : fallbackMessage;
    if (context) {
      void captureHandledError(error, {
        source: context.source || 'frontend',
        scope: context.scope || 'unknown',
        metadata: {
          kind: 'notify.fromError',
          fallbackMessage,
          ...(context.metadata || {}),
        },
      });
    }
    return toast.error(resolvedMessage, options);
  },
};

export const createScopedErrorNotifier = ({ scope, page, source = 'frontend' }: ScopedErrorNotifierOptions) => (
  error: unknown,
  fallbackMessage: string,
  options?: ToastOptions,
  kind?: string
) => notify.fromError(
  error,
  fallbackMessage,
  options,
  {
    source,
    scope,
    metadata: {
      page,
      ...(kind ? { kind } : {}),
    },
  }
);

export default notify;
