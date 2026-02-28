type OnboardingRole = 'donor' | 'ngo' | 'bloodbank';

const DEFAULT_ONBOARDING_ERROR_MESSAGE = 'Failed to complete onboarding. Please try again.';

export const resolveOnboardingSubmitErrorMessage = (
  error: unknown,
  role: OnboardingRole
): string => {
  const rawMessage = error instanceof Error ? error.message : '';
  const normalizedMessage = rawMessage.toLowerCase();

  if (role === 'bloodbank' && normalizedMessage.includes('permission')) {
    return 'Permission denied while saving your profile. Please sign in again.';
  }

  if (role === 'donor' && rawMessage) {
    return rawMessage;
  }

  return DEFAULT_ONBOARDING_ERROR_MESSAGE;
};
