// src/hooks/useRegister.ts
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { notify } from 'services/notify.service';
import { doc, enableNetwork, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
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
import { captureFirestoreOperationError } from '../utils/firestoreDiagnostics';
import {
  clearPendingPortalRole,
  clearRegistrationIntent,
  markPendingPortalRole,
  markRegistrationIntent,
} from '../utils/registrationIntent';

interface RegisterFormData {
  identifier: string;
  otp: string;
}

export const useRegister = () => {
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
      void captureHandledError(error, { source: 'frontend', scope: 'auth', metadata: { kind: 'auth.register.phone.submit' } });
      notify.error(authFlowMessages.otpSendFailed);
    }
  };

  const handleOTPSubmit = async () => {
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
      markRegistrationIntent('donor');
      markPendingPortalRole('donor');
      const userCredential = await confirmationResult.confirm(sanitizedOtp);

      clearRecaptchaVerifier();

      const { normalized: normalizedPhone } = validateGeneralPhoneInput(formData.identifier);

      try {
        await enableNetwork(db);
      } catch (networkEnableError) {
        void captureHandledError(networkEnableError, { source: 'frontend', scope: 'auth', metadata: { kind: 'auth.register.phone.enable_network' } });
      }

      // Check if user already registered by uid as a fallback
      const userRef = doc(db, COLLECTIONS.USERS, userCredential.user.uid);
      let userDoc;
      try {
        userDoc = await getDoc(userRef);
      } catch (userReadError) {
        await captureFirestoreOperationError(userReadError, {
          scope: 'auth',
          kind: 'auth.register.phone.user_doc_read',
          operation: 'getDoc',
          collection: COLLECTIONS.USERS,
          docId: userCredential.user.uid,
          blocking: true,
          phase: 'phone_register',
          portalRole: 'donor',
        });
        throw userReadError;
      }

      if (userDoc.exists()) {
        clearRegistrationIntent();
        clearPendingPortalRole();
        // User already exists - sign them out and redirect to login
        await signOut(auth);
        notifyMobileAlreadyRegistered();
        navigate(ROUTES.portal.donor.login);
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
        await signOut(auth);
        notifyMobileAlreadyRegistered();
        navigate(ROUTES.portal.donor.login);
        return;
      }

      // Create new user document with Donor role
      const referralContext = await resolveReferralContext(userCredential.user.uid);
      try {
        await setDoc(userRef, {
          uid: userCredential.user.uid,
          phoneNumber: userCredential.user.phoneNumber,
          phoneNumberNormalized: normalizedPhone,
          role: 'donor',
          status: 'active',
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
        await captureFirestoreOperationError(profileCreateError, {
          scope: 'auth',
          kind: 'auth.register.phone.user_profile_create',
          operation: 'setDoc',
          collection: COLLECTIONS.USERS,
          docId: userCredential.user.uid,
          blocking: true,
          phase: 'phone_register',
          portalRole: 'donor',
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

      notify.success('Registration successful!');
      navigate(ROUTES.portal.donor.onboarding);
    } catch (error: any) {
      clearRegistrationIntent();
      clearPendingPortalRole();
      void captureHandledError(error, { source: 'frontend', scope: 'auth', metadata: { kind: 'auth.register.otp.verify' } });

      clearRecaptchaVerifier();

      if (error.code === 'auth/invalid-verification-code') {
        notify.error(authFlowMessages.otpInvalid);
      } else {
        notify.error(authFlowMessages.verificationFailed);
      }
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOTP = async () => {
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
      void captureHandledError(error, { source: 'frontend', scope: 'auth', metadata: { kind: 'auth.register.otp.resend' } });
      notify.error(authFlowMessages.otpResendFailed);
    }
  };

  const handleGoogleRegister = async () => {
    try {
      setGoogleLoading(true);
      await registerWithGoogleRole({
        role: 'donor',
        loginPath: ROUTES.portal.donor.login,
        onboardingPath: ROUTES.portal.donor.onboarding,
        scope: 'auth',
        kind: 'auth.register.google',
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
