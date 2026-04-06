// src/hooks/useNgoRegister.ts
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { notify } from 'services/notify.service';
import { doc, enableNetwork, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { authStorage } from '../utils/authStorage';
import { findUsersByPhone } from '../utils/userLookup';
import { applyReferralTrackingForUser, resolveReferralContext } from '../services/referral.service';
import { captureHandledError } from '../services/errorLog.service';
import { authFlowMessages, authInputMessages, getOtpValidationError, sanitizeOtp, validateGeneralPhoneInput } from '../utils/authInputValidation';
import { useOtpResendTimer } from './useOtpResendTimer';
import { clearRecaptchaVerifier } from '../utils/recaptcha';
import { registerWithGoogleRole } from '../utils/googleRegister';
import { notifyMobileAlreadyRegistered, requireValue } from '../utils/validationFeedback';
import { COLLECTIONS } from '../constants/firestore';
import { ROUTES } from '../constants/routes';
import { authMessages } from '../constants/messages';
import { captureFirestoreOperationError } from '../utils/firestoreDiagnostics';
import {
  clearPendingPortalRole,
  clearRegistrationIntent,
  markPendingPortalRole,
  markRegistrationIntent,
} from '../utils/registrationIntent';
import { createUserDocumentViaRest, patchUserDocumentViaRest } from '../utils/firestoreRestUserWrite';
import { cleanupAuthSession } from '../utils/authSessionCleanup';

interface RegisterFormData {
  identifier: string;
  otp: string;
}

export const useNgoRegister = () => {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [formData, setFormData] = useState<RegisterFormData>({
    identifier: '',
    otp: ''
  });
  const { otpResendTimer, startResendTimer } = useOtpResendTimer();
  const [confirmationResult, setConfirmationResult] = useState<any>(null);

  const navigate = useNavigate();
  const { loginWithPhone, authLoading } = useAuth();

  const waitForFirestoreAuthUser = async (expectedUid: string, timeoutMs: number = 3000) => {
    if (typeof (auth as any).authStateReady === 'function') {
      try {
        await (auth as any).authStateReady();
      } catch {
        // ignore readiness errors
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

  const getUserDocWithBootstrapRetry = async (uid: string) => {
    const userRef = doc(db, COLLECTIONS.USERS, uid);
    let attempts = 0;

    while (attempts < 5) {
      try {
        await waitForFirestoreAuthUser(uid, 1500);
        return await getDoc(userRef);
      } catch (error) {
        const code = String((error as { code?: string })?.code || '').toLowerCase();
        const currentUid = auth.currentUser?.uid || null;
        const shouldRetry = (code === 'permission-denied' || code === 'unauthenticated')
          && currentUid !== uid;

        attempts += 1;
        if (!shouldRetry || attempts >= 5) {
          throw error;
        }

        try {
          await auth.currentUser?.getIdToken(true);
        } catch {
          // ignore token refresh failures during bootstrap retry
        }

        await new Promise((resolve) => setTimeout(resolve, 250 * attempts));
      }
    }

    throw new Error('Failed to read user document during NGO registration bootstrap.');
  };

  const handleIdentifierChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      identifier: value
    }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePhoneNumberSubmit = async () => {
    if (authLoading || otpLoading || googleLoading) {
      return;
    }
    const { normalized: normalizedPhone, error } = validateGeneralPhoneInput(formData.identifier);
    if (!requireValue(!error, error || authInputMessages.invalidIndiaPhone)) {
      return;
    }

    try {
      const confirmation = await loginWithPhone(normalizedPhone);
      setConfirmationResult(confirmation);
      notify.success(authFlowMessages.otpSent);
      startResendTimer();
    } catch (error: any) {
      void captureHandledError(error, { source: 'frontend', scope: 'auth', metadata: { kind: 'auth.register.ngo.phone.submit' } });
      notify.error(authFlowMessages.otpSendFailed);
    }
  };

  const handleOTPSubmit = async () => {
    if (otpLoading || googleLoading) {
      return;
    }
    if (!requireValue(Boolean(confirmationResult), authInputMessages.requestOtpFirst)) {
      return;
    }
    const otpError = getOtpValidationError(formData.otp);
    if (!requireValue(!otpError, otpError || authFlowMessages.otpInvalid)) {
      return;
    }
    const sanitizedOtp = sanitizeOtp(formData.otp);
    try {
      setOtpLoading(true);
      markRegistrationIntent('ngo');
      markPendingPortalRole('ngo');
      const userCredential = await confirmationResult.confirm(sanitizedOtp);

      clearRecaptchaVerifier();
      const { normalized: normalizedPhone } = validateGeneralPhoneInput(formData.identifier);

      try {
        await enableNetwork(db);
      } catch (networkEnableError) {
        void captureHandledError(networkEnableError, { source: 'frontend', scope: 'auth', metadata: { kind: 'auth.register.ngo.enable_network' } });
      }

      // Check if user already registered
      const userRef = doc(db, COLLECTIONS.USERS, userCredential.user.uid);
      let userDoc;
      try {
        userDoc = await getUserDocWithBootstrapRetry(userCredential.user.uid);
      } catch (userReadError) {
        await captureFirestoreOperationError(userReadError, {
          scope: 'auth',
          kind: 'auth.register.ngo.phone.user_doc_read',
          operation: 'getDoc',
          collection: COLLECTIONS.USERS,
          docId: userCredential.user.uid,
          blocking: true,
          phase: 'phone_register',
          portalRole: 'ngo',
        });
        throw userReadError;
      }

      if (userDoc.exists()) {
        const existingData = userDoc.data() as { role?: string; onboardingCompleted?: boolean };
        clearRegistrationIntent();
        if (existingData?.role === 'ngo' && existingData?.onboardingCompleted !== true) {
          notify.success('Continue onboarding to complete NGO registration.');
          navigate(ROUTES.portal.ngo.onboarding);
          return;
        }
        clearPendingPortalRole();
        await cleanupAuthSession({
          scope: 'auth',
          kind: 'auth.register.ngo.phone.existing_user_cleanup',
        });
        notifyMobileAlreadyRegistered();
        navigate(ROUTES.portal.ngo.login);
        return;
      }

      const existingMatches = await findUsersByPhone(normalizedPhone);
      const otherMatch = existingMatches.find(match => {
        const matchUid = match.uid || match.id;
        return matchUid !== userCredential.user.uid;
      });

      if (otherMatch) {
        clearRegistrationIntent();
        clearPendingPortalRole();
        await cleanupAuthSession({
          scope: 'auth',
          kind: 'auth.register.ngo.phone.other_match_cleanup',
        });
        notifyMobileAlreadyRegistered();
        navigate(ROUTES.portal.ngo.login);
        return;
      }

      // Create new user document with NGO role
      const referralContext = await resolveReferralContext(userCredential.user.uid);
      try {
        await setDoc(userRef, {
          uid: userCredential.user.uid,
          phoneNumber: userCredential.user.phoneNumber,
          phoneNumberNormalized: normalizedPhone,
          role: 'ngo',
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
        }, { merge: true });
      } catch (profileCreateError) {
        const code = String((profileCreateError as { code?: string })?.code || '').toLowerCase();
        if (code === 'permission-denied' && auth.currentUser?.uid === userCredential.user.uid) {
          try {
            const currentAuthUser = auth.currentUser;
            if (!currentAuthUser) {
              throw profileCreateError;
            }
            const freshToken = await currentAuthUser.getIdToken(true);
            const restDocument = {
              uid: userCredential.user.uid,
              phoneNumber: userCredential.user.phoneNumber,
              phoneNumberNormalized: normalizedPhone,
              role: 'ngo' as const,
              onboardingCompleted: false,
              createdAt: new Date(),
              lastLoginAt: new Date(),
              ...(referralContext
                ? {
                    referredByUid: referralContext.referrerUid,
                    referredByBhId: referralContext.referrerBhId,
                    referralCapturedAt: new Date(),
                  }
                : {}),
            };
            try {
              await createUserDocumentViaRest({
                idToken: freshToken,
                userId: userCredential.user.uid,
                document: restDocument,
              });
            } catch (restCreateError: any) {
              if (String(restCreateError?.code || '').toLowerCase() !== 'already-exists') {
                throw restCreateError;
              }
              await patchUserDocumentViaRest({
                idToken: freshToken,
                userId: userCredential.user.uid,
                patch: restDocument,
              });
            }
          } catch (restFallbackError) {
            await captureFirestoreOperationError(restFallbackError, {
              scope: 'auth',
              kind: 'auth.register.ngo.phone.user_profile_create',
              operation: 'setDoc',
              collection: COLLECTIONS.USERS,
              docId: userCredential.user.uid,
              blocking: true,
              phase: 'phone_register',
              portalRole: 'ngo',
              metadata: {
                firestoreFieldKeys: [
                  'createdAt',
                  'lastLoginAt',
                  'onboardingCompleted',
                  'phoneNumber',
                  'phoneNumberNormalized',
                  'role',
                  'uid',
                  ...(referralContext ? ['referredByBhId', 'referredByUid', 'referralCapturedAt'] : []),
                ].sort(),
                firestoreTransportFallbackEnabled: true,
              },
            });
            throw restFallbackError;
          }
        }
        await captureFirestoreOperationError(profileCreateError, {
          scope: 'auth',
          kind: 'auth.register.ngo.phone.user_profile_create',
          operation: 'setDoc',
          collection: COLLECTIONS.USERS,
          docId: userCredential.user.uid,
          blocking: true,
          phase: 'phone_register',
          portalRole: 'ngo',
          metadata: {
            firestoreFieldKeys: [
              'createdAt',
              'lastLoginAt',
              'onboardingCompleted',
              'phoneNumber',
              'phoneNumberNormalized',
              'role',
              'uid',
              ...(referralContext ? ['referredByBhId', 'referredByUid', 'referralCapturedAt'] : []),
            ].sort(),
            firestoreTransportFallbackEnabled: true,
          },
        });
        throw profileCreateError;
      }

      await applyReferralTrackingForUser(userCredential.user.uid);

      const token = await userCredential.user.getIdToken();
      if (!token) {
        throw new Error('No token received');
      }
      authStorage.setAuthToken(token);

      clearRegistrationIntent();

      notify.success(authMessages.registrationSuccessful);
      navigate(ROUTES.portal.ngo.onboarding);
    } catch (error: any) {
      clearRegistrationIntent();
      clearPendingPortalRole();
      void captureHandledError(error, { source: 'frontend', scope: 'auth', metadata: { kind: 'auth.register.ngo.otp.verify' } });

      clearRecaptchaVerifier();

      if (error.code === 'auth/invalid-verification-code') {
        notify.error(authFlowMessages.otpInvalid);
      } else if (error.code === 'auth/code-expired') {
        notify.error(authFlowMessages.otpExpired);
      } else {
        notify.error(authFlowMessages.verificationFailed);
      }
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (authLoading || otpLoading || googleLoading) {
      return;
    }
    const { normalized, error } = validateGeneralPhoneInput(formData.identifier);
    if (!requireValue(!error, error || authInputMessages.invalidIndiaPhone)) {
      return;
    }
    try {
      const confirmation = await loginWithPhone(normalized);
      setConfirmationResult(confirmation);
      notify.success(authFlowMessages.otpResent);
      startResendTimer();
    } catch (error) {
      void captureHandledError(error, { source: 'frontend', scope: 'auth', metadata: { kind: 'auth.register.ngo.otp.resend' } });
      notify.error(authFlowMessages.otpResendFailed);
    }
  };

  const handleGoogleRegister = async () => {
    if (googleLoading || otpLoading || authLoading) {
      return;
    }
    try {
      setGoogleLoading(true);
      await registerWithGoogleRole({
        role: 'ngo',
        loginPath: ROUTES.portal.ngo.login,
        onboardingPath: ROUTES.portal.ngo.onboarding,
        scope: 'auth',
        kind: 'auth.register.ngo.google',
        navigate,
        persistToken: true,
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  return {
    formData,
    otpResendTimer,
    confirmationResult,
    authLoading,
    handleIdentifierChange,
    handleChange,
    handlePhoneNumberSubmit,
    handleOTPSubmit,
    handleResendOTP,
    handleGoogleRegister,
    googleLoading,
    otpLoading,
  };
};
