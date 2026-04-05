import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockNotifyError = vi.hoisted(() => vi.fn());

vi.mock('services/notify.service', () => ({
  notify: {
    error: mockNotifyError,
  },
}));

vi.mock('../authInputValidation', () => ({
  authFlowMessages: {
    googleSignInFailed: 'google-sign-in-failed',
  },
}));

import { notifyGoogleSignInFailure } from '../authNotifications';

describe('notifyGoogleSignInFailure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('surfaces a specific error message when available', () => {
    notifyGoogleSignInFailure(new Error('Verification code expired. Please retry phone login.'));

    expect(mockNotifyError).toHaveBeenCalledWith('Verification code expired. Please retry phone login.');
  });

  it('falls back to the generic translation-backed message when no specific error exists', () => {
    notifyGoogleSignInFailure(new Error('Firebase: Error (auth/internal-error).'));

    expect(mockNotifyError).toHaveBeenCalledWith('google-sign-in-failed');
  });
});
