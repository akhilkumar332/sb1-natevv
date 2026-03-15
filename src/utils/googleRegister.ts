import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { signInWithPopup, signOut } from 'firebase/auth';
import { auth, db, googleProvider } from '../firebase';
import { notify } from 'services/notify.service';
import { applyReferralTrackingForUser } from '../services/referral.service';
import { captureHandledError } from '../services/errorLog.service';
import { authStorage } from './authStorage';
import { authFlowMessages } from './authInputValidation';
import { COLLECTIONS } from '../constants/firestore';

type GoogleRegisterRole = 'donor' | 'ngo' | 'bloodbank';

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
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      await signOut(auth);
      notify.error(authFlowMessages.emailRegistered);
      navigate(loginPath);
      return;
    }

    // Critical path: create donor profile first so role access is immediately valid.
    await setDoc(userRef, {
      uid: result.user.uid,
      email: result.user.email,
      displayName: result.user.displayName,
      photoURL: result.user.photoURL,
      role,
      onboardingCompleted: false,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    });

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
    if (error instanceof Error) {
      notify.error(error.message);
    } else {
      notify.error(authFlowMessages.registrationFailed);
    }
  }
};
