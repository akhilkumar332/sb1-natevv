import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { signInWithPopup, signOut } from 'firebase/auth';
import { auth, db, googleProvider } from '../firebase';
import { notify } from 'services/notify.service';
import { applyReferralTrackingForUser, resolveReferralContext } from '../services/referral.service';
import { captureHandledError } from '../services/errorLog.service';
import { authStorage } from './authStorage';
import { authFlowMessages } from './authInputValidation';

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

    const userRef = doc(db, 'users', result.user.uid);
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      await signOut(auth);
      notify.error(authFlowMessages.emailRegistered);
      navigate(loginPath);
      return;
    }

    const referralContext = await resolveReferralContext(result.user.uid);
    await setDoc(userRef, {
      uid: result.user.uid,
      email: result.user.email,
      displayName: result.user.displayName,
      photoURL: result.user.photoURL,
      role,
      onboardingCompleted: false,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
      ...(referralContext
        ? {
            referredByUid: referralContext.referrerUid,
            referredByBhId: referralContext.referrerBhId,
            referralCapturedAt: serverTimestamp(),
          }
        : {}),
    });

    await applyReferralTrackingForUser(result.user.uid);

    if (persistToken) {
      const token = await result.user.getIdToken();
      authStorage.setAuthToken(token);
    }

    notify.success('Registration successful!');
    navigate(onboardingPath);
  } catch (error) {
    void captureHandledError(error, { source: 'frontend', scope, metadata: { kind } });
    if (error instanceof Error) {
      notify.error(error.message);
    } else {
      notify.error(authFlowMessages.registrationFailed);
    }
  }
};
