import { doc, enableNetwork, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getAdditionalUserInfo, signInWithPopup } from 'firebase/auth';
import { auth, db, googleProvider } from '../firebase';
import { notify } from 'services/notify.service';
import { applyReferralTrackingForUser } from '../services/referral.service';
import { captureHandledError } from '../services/errorLog.service';
import { authStorage } from './authStorage';
import { authFlowMessages } from './authInputValidation';
import { COLLECTIONS } from '../constants/firestore';
import { buildUserWriteDiagnosticMetadata, captureFirestoreOperationError } from './firestoreDiagnostics';
import {
  clearPendingPortalRole,
  clearRegistrationIntent,
  markPendingPortalRole,
  markRegistrationIntent,
} from './registrationIntent';
import { createUserDocumentViaRest, patchUserDocumentViaRest } from './firestoreRestUserWrite';
import { cleanupAuthSession } from './authSessionCleanup';

type GoogleRegisterRole = 'donor' | 'ngo' | 'bloodbank';
let activeGoogleRegisterPromise: Promise<void> | null = null;

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

const shouldRetryBootstrapProfileCreate = (error: unknown, expectedUid: string) => {
  const anyError = error as { code?: string; message?: string };
  const code = String(anyError?.code || '').toLowerCase();
  const message = String(anyError?.message || '');
  return code === 'permission-denied' && auth.currentUser?.uid === expectedUid
    && !message.toLowerCase().includes('missing or insufficient permissions from stale session');
};

const createUserProfile = async (
  userRef: ReturnType<typeof doc>,
  uid: string,
  role: GoogleRegisterRole,
  payload: Record<string, unknown>,
) => {
  let attempt = 0;

  while (attempt < 3) {
    try {
      await setDoc(userRef, payload, { merge: true });
      return;
    } catch (error) {
      if ((error as { code?: string })?.code === 'permission-denied') {
        try {
          const existingDoc = await getDoc(userRef);
          if (existingDoc.exists()) {
            const existingData = existingDoc.data() as { role?: string; onboardingCompleted?: boolean };
            if (existingData?.role === role) {
              return;
            }
          }
        } catch {
          // ignore fallback read errors and continue with normal retry/throw path
        }
      }
      attempt += 1;
      if (!shouldRetryBootstrapProfileCreate(error, uid) || attempt >= 3) {
        const code = String((error as { code?: string })?.code || '').toLowerCase();
        if (code === 'permission-denied' && auth.currentUser?.uid === uid) {
          const freshToken = await auth.currentUser.getIdToken(true);
          const restDocument = {
            uid,
            email: typeof payload.email === 'string' || payload.email === null ? payload.email as string | null : null,
            displayName: typeof payload.displayName === 'string' || payload.displayName === null
              ? payload.displayName as string | null
              : null,
            photoURL: typeof payload.photoURL === 'string' || payload.photoURL === null
              ? payload.photoURL as string | null
              : null,
            role,
            onboardingCompleted: false,
            createdAt: new Date(),
            lastLoginAt: new Date(),
          };
          try {
            await createUserDocumentViaRest({
              idToken: freshToken,
              userId: uid,
              document: restDocument,
            });
          } catch (restCreateError: any) {
            if (String(restCreateError?.code || '').toLowerCase() !== 'already-exists') {
              throw restCreateError;
            }
            await patchUserDocumentViaRest({
              idToken: freshToken,
              userId: uid,
              patch: restDocument,
            });
          }
          return;
        }
        throw error;
      }
      try {
        await auth.currentUser?.getIdToken(true);
      } catch {
        // ignore token refresh failures and let the next Firestore attempt decide
      }
      await waitForFirestoreAuthUser(uid, 1200);
      await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
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
  if (activeGoogleRegisterPromise) {
    return activeGoogleRegisterPromise;
  }

  activeGoogleRegisterPromise = (async () => {
    let signedInUid: string | null = null;
    try {
      markRegistrationIntent(role);
      markPendingPortalRole(role);

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
        clearRegistrationIntent();
        clearPendingPortalRole();
        return;
      }
      signedInUid = result.user.uid;

      const userRef = doc(db, COLLECTIONS.USERS, result.user.uid);
      const additionalInfo = getAdditionalUserInfo(result);
      const isNewGoogleUser = additionalInfo?.isNewUser === true;
      if (!isNewGoogleUser) {
        clearRegistrationIntent();
        clearPendingPortalRole();
        await cleanupAuthSession({
          scope,
          kind: `${kind}.existing_user_cleanup`,
        });
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
        const bootstrapPayload = {
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName,
          photoURL: result.user.photoURL,
          role,
          onboardingCompleted: false,
          createdAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
        };
        await createUserProfile(userRef, result.user.uid, role, {
          ...bootstrapPayload,
        });
      } catch (profileCreateError) {
        const diagnosticMetadata = await buildUserWriteDiagnosticMetadata({
          userId: result.user.uid,
          payload: {
            uid: result.user.uid,
            email: result.user.email,
            displayName: result.user.displayName,
            photoURL: result.user.photoURL,
            role,
            onboardingCompleted: false,
            createdAt: '[serverTimestamp]',
            lastLoginAt: '[serverTimestamp]',
          },
          payloadLabel: 'google_register_user_profile_create',
        });
        const diagnosticsPromise = captureFirestoreOperationError(profileCreateError, {
          scope,
          kind: `${kind}.user_profile_create`,
          operation: 'setDoc',
          collection: COLLECTIONS.USERS,
          docId: result.user.uid,
          blocking: true,
          phase: 'google_register',
          portalRole: role,
          metadata: {
            firestoreFieldKeys: ['createdAt', 'displayName', 'email', 'lastLoginAt', 'onboardingCompleted', 'photoURL', 'role', 'uid'],
            firestoreTransportFallbackEnabled: true,
            ...diagnosticMetadata,
          },
        });
        await diagnosticsPromise;
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

      clearRegistrationIntent();

      notify.success('Registration successful!');
      navigate(onboardingPath);
    } catch (error) {
      clearRegistrationIntent();
      if (signedInUid && auth.currentUser?.uid === signedInUid) {
        await cleanupAuthSession({
          scope,
          kind: `${kind}.signout_after_failed_register`,
        });
      }
      clearPendingPortalRole();
      void captureHandledError(error, { source: 'frontend', scope, metadata: { kind } });
      notify.error(resolveGoogleRegisterErrorMessage(error));
    }
  })();

  try {
    await activeGoogleRegisterPromise;
  } finally {
    activeGoogleRegisterPromise = null;
  }
};
