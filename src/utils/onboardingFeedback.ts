import i18n from '../i18n';

type OnboardingRole = 'donor' | 'ngo' | 'bloodbank';

const DEFAULT_ONBOARDING_ERROR_MESSAGE = () => i18n.t('auth.onboardingSubmitFailed');
const OFFLINE_ONBOARDING_ERROR_MESSAGE = () => i18n.t('auth.onboardingOfflineFailed');

const isLikelyOfflineError = (error: unknown): boolean => {
  const anyError = error as { code?: string; message?: string };
  const code = String(anyError?.code || '').toLowerCase();
  const message = String(anyError?.message || '').toLowerCase();

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return true;
  }

  return (
    code === 'unavailable'
    || code === 'failed-precondition'
    || code === 'deadline-exceeded'
    || message.includes('internet_disconnected')
    || message.includes('client is offline')
    || message.includes('offline')
    || message.includes('network')
    || message.includes('failed to fetch')
  );
};

export const resolveOnboardingSubmitErrorMessage = (
  error: unknown,
  role: OnboardingRole
): string => {
  const rawMessage = error instanceof Error ? error.message : '';
  const normalizedMessage = rawMessage.toLowerCase();

  if (isLikelyOfflineError(error)) {
    return OFFLINE_ONBOARDING_ERROR_MESSAGE();
  }

  if (role === 'bloodbank' && normalizedMessage.includes('permission')) {
    return i18n.t('auth.bloodbankPermissionDenied');
  }

  if (role === 'donor' && normalizedMessage.includes('permission')) {
    return i18n.t('auth.donorPermissionDenied');
  }

  if (role === 'donor' && rawMessage) {
    return rawMessage;
  }

  return DEFAULT_ONBOARDING_ERROR_MESSAGE();
};
