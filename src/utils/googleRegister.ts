import { doc, enableNetwork, serverTimestamp, setDoc } from 'firebase/firestore';
import { getAdditionalUserInfo, signInWithPopup, signOut } from 'firebase/auth';
import { auth, db, googleProvider } from '../firebase';
import { notify } from 'services/notify.service';
import { applyReferralTrackingForUser } from '../services/referral.service';
import { captureHandledError } from '../services/errorLog.service';
import { authStorage } from './authStorage';
import { authFlowMessages } from './authInputValidation';
import { COLLECTIONS } from '../constants/firestore';
import { captureFirestoreOperationError } from './firestoreDiagnostics';

type GoogleRegisterRole = 'donor' | 'ngo' | 'bloodbank';
const pendingPortalRoleStorageKey = 'bh_pending_portal_role';

const waitForFirestoreAuthUser = async (expectedUid: string, timeoutMs: number = 3000) => {
  if (typeof (auth as any).authStateReady === 'function') {
    try {
      await (auth as any).authStateReady();
    } catch {
      // ignore auth readiness failures
    }
  }
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (auth.currentUser?.uid === expectedUid) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
};

const resolveGoogleRegisterErrorMessage = (error: unknown): string => {
  const anyError = error as { code?: string; message?: string };
  const message = String(anyError?.message || '');
  const normalizedMessage = message.toLowerCase();
  const code = String(anyError?.code || '').toLowerCase();

  if (
    (typeof navigator !== 'undefined' && !navigator.onLine)
    || code === 'unavailable'
    || code === 'failed-precondition'
    || code === 'deadline-exceeded'
    || normalizedMessage.includes('internet_disconnected')
    || normalizedMessage.includes('client is offline')
    || normalizedMessage.includes('offline')
    || normalizedMessage.includes('network')
    || normalizedMessage.includes('failed to fetch')
  ) {
    return 'Internet connection lost during Google signup. Reconnect and try again.';
  }

  return message || authFlowMessages.registrationFailed;
};

export const registerWithGoogleRole = async ({
  role,
  loginPath,
  onboardingPath,
  scope,
  kind,
  navigate,
  persistToken = false,
}: {
  role: GoogleRegisterRole;
  loginPath: string;
  onboardingPath: string;
  scope: 'auth' | 'donor' | 'ngo' | 'bloodbank' | 'admin' | 'unknown';
  kind: string;
  navigate: (to: string) => void;
  persistToken?: boolean;
}) => {
  let signedInUid: string | null = null;
  try {
    const result = await signInWithPopup(auth, googleProvider).catch((error) => {
      if (error.code === 'auth/popup-closed-by-user') {
        throw new Error('Sign-in popup was closed before completing the sign-in process.');
      }
      if (error.code === 'auth/popup-blocked') {
        throw new Error('Sign-in popup was blocked by the browser. Please allow popups for this site.');
      }
      if (error.code === 'auth/cancelled-popup-request') {
        return null;
      }
      throw error;
    });

    if (!result) {
      return;
    }
    signedInUid = result.user.uid;

    const userRef = doc(db, COLLECTIONS.USERS, result.user.uid);
    const additionalInfo = getAdditionalUserInfo(result);
    const isNewGoogleUser = additionalInfo?.isNewUser === true;
    if (!isNewGoogleUser) {
      await signOut(auth);
      notify.error(authFlowMessages.emailRegistered);
      navigate(loginPath);
      return;
    }

    try {
      await enableNetwork(db);
    } catch (networkEnableError) {
      void captureHandledError(networkEnableError, {
        source: 'frontend',
        scope,
        metadata: { kind: `${kind}.enable_network_before_register` },
      });
    }

    await waitForFirestoreAuthUser(result.user.uid);

    // Critical path: create donor profile first so role access is immediately valid.
    try {
      await setDoc(userRef, {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL,
        role,
        status: 'active',
        onboardingCompleted: false,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      }, { merge: true });
    } catch (profileCreateError) {
      await captureFirestoreOperationError(profileCreateError, {
        scope,
        kind: `${kind}.user_profile_create`,
        operation: 'setDoc',
        collection: COLLECTIONS.USERS,
        docId: result.user.uid,
        blocking: true,
        phase: 'google_register',
        portalRole: role,
      });
      throw profileCreateError;
    }

    // Non-critical: referral enrichment must not block signup completion.
    try {
      await applyReferralTrackingForUser(result.user.uid);
    } catch (referralError) {
      void captureHandledError(referralError, {
        source: 'frontend',
        scope,
        metadata: { kind: `${kind}.referral_tracking_non_blocking` },
      });
    }

    if (persistToken) {
      try {
        const token = await result.user.getIdToken();
        authStorage.setAuthToken(token);
      } catch (tokenError) {
        void captureHandledError(tokenError, {
          source: 'frontend',
          scope,
          metadata: { kind: `${kind}.persist_token_non_blocking` },
        });
      }
    }

    try {
      window.sessionStorage.setItem(pendingPortalRoleStorageKey, JSON.stringify({
        role,
        createdAt: Date.now(),
      }));
    } catch {
      // ignore storage errors
    }

    notify.success('Registration successful!');
    navigate(onboardingPath);
  } catch (error) {
    if (signedInUid && auth.currentUser?.uid === signedInUid) {
      try {
        await signOut(auth);
      } catch (signOutError) {
        void captureHandledError(signOutError, {
          source: 'frontend',
          scope,
          metadata: { kind: `${kind}.signout_after_failed_register` },
        });
      }
    }
    void captureHandledError(error, { source: 'frontend', scope, metadata: { kind } });
    notify.error(resolveGoogleRegisterErrorMessage(error));
  }
};
