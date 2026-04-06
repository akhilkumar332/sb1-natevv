import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { captureHandledError } from '../services/errorLog.service';
import { authStorage } from './authStorage';

type CleanupAuthSessionOptions = {
  scope?: 'auth' | 'donor' | 'ngo' | 'bloodbank' | 'admin' | 'unknown';
  kind: string;
  metadata?: Record<string, unknown>;
  extraCleanup?: () => void;
};

export const cleanupAuthSession = async ({
  scope = 'auth',
  kind,
  metadata,
  extraCleanup,
}: CleanupAuthSessionOptions) => {
  try {
    await signOut(auth);
  } catch (error) {
    void captureHandledError(error, {
      source: 'frontend',
      scope,
      metadata: {
        kind,
        ...(metadata || {}),
      },
    });
  }

  try {
    authStorage.clearAuthData();
    localStorage.removeItem('user');
    extraCleanup?.();
  } catch (error) {
    void captureHandledError(error, {
      source: 'frontend',
      scope,
      metadata: {
        kind: `${kind}.storage_cleanup`,
        ...(metadata || {}),
      },
    });
  }
};
