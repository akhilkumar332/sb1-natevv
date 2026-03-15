type OnboardingRole = 'donor' | 'ngo' | 'bloodbank';

const DEFAULT_ONBOARDING_ERROR_MESSAGE = 'Failed to complete onboarding. Please try again.';
const OFFLINE_ONBOARDING_ERROR_MESSAGE = 'Internet connection lost while saving your profile. Please reconnect and try again.';

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
    return OFFLINE_ONBOARDING_ERROR_MESSAGE;
  }

  if (role === 'bloodbank' && normalizedMessage.includes('permission')) {
    return 'Permission denied while saving your profile. Please sign in again.';
  }

  if (role === 'donor' && normalizedMessage.includes('permission')) {
    return 'Permission denied while saving your donor profile. If this persists after reconnecting, the failing Firestore rule still needs adjustment.';
  }

  if (role === 'donor' && rawMessage) {
    return rawMessage;
  }

  return DEFAULT_ONBOARDING_ERROR_MESSAGE;
};
