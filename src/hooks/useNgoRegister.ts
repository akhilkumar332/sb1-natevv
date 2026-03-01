// src/hooks/useNgoRegister.ts
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { notify } from 'services/notify.service';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { applyReferralTrackingForUser, resolveReferralContext } from '../services/referral.service';
import { captureHandledError } from '../services/errorLog.service';
import { authFlowMessages, authInputMessages, getOtpValidationError, sanitizeOtp, validateIndiaPhoneInput } from '../utils/authInputValidation';
import { useOtpResendTimer } from './useOtpResendTimer';
import { clearRecaptchaVerifier } from '../utils/recaptcha';
import { registerWithGoogleRole } from '../utils/googleRegister';
import { requireValue } from '../utils/validationFeedback';
import { COLLECTIONS } from '../constants/firestore';
import { ROUTES } from '../constants/routes';

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
    const { error, phoneNumber } = validateIndiaPhoneInput(formData.identifier);
    if (!requireValue(!error && Boolean(phoneNumber), error || authInputMessages.invalidIndiaPhone)) {
      return;
    }
    const safePhoneNumber = phoneNumber as string;

    try {
      const confirmation = await loginWithPhone(safePhoneNumber);
      setConfirmationResult(confirmation);
      notify.success(authFlowMessages.otpSent);
      startResendTimer();
    } catch (error: any) {
      void captureHandledError(error, { source: 'frontend', scope: 'auth', metadata: { kind: 'auth.register.ngo.phone.submit' } });
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
      const userCredential = await confirmationResult.confirm(sanitizedOtp);

      clearRecaptchaVerifier();

      // Check if user already registered
      const userRef = doc(db, COLLECTIONS.USERS, userCredential.user.uid);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        // User already exists - sign them out and redirect to login
        await signOut(auth);
        notify.error('Phone number already registered. Please use the login page.');
        navigate(ROUTES.portal.ngo.login);
        return;
      }

      // Create new user document with NGO role
      const referralContext = await resolveReferralContext(userCredential.user.uid);
      await setDoc(userRef, {
        uid: userCredential.user.uid,
        phoneNumber: userCredential.user.phoneNumber,
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
      });

      await applyReferralTrackingForUser(userCredential.user.uid);

      notify.success('Registration successful!');
      navigate(ROUTES.portal.ngo.onboarding);
    } catch (error: any) {
      void captureHandledError(error, { source: 'frontend', scope: 'auth', metadata: { kind: 'auth.register.ngo.otp.verify' } });

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
    const { error, phoneNumber } = validateIndiaPhoneInput(formData.identifier);
    if (!requireValue(!error && Boolean(phoneNumber), error || authInputMessages.invalidIndiaPhone)) {
      return;
    }
    const safePhoneNumber = phoneNumber as string;
    try {
      const confirmation = await loginWithPhone(safePhoneNumber);
      setConfirmationResult(confirmation);
      notify.success(authFlowMessages.otpResent);
      startResendTimer();
    } catch (error) {
      void captureHandledError(error, { source: 'frontend', scope: 'auth', metadata: { kind: 'auth.register.ngo.otp.resend' } });
      notify.error(authFlowMessages.otpResendFailed);
    }
  };

  const handleGoogleRegister = async () => {
    try {
      setGoogleLoading(true);
      await registerWithGoogleRole({
        role: 'ngo',
        loginPath: ROUTES.portal.ngo.login,
        onboardingPath: ROUTES.portal.ngo.onboarding,
        scope: 'auth',
        kind: 'auth.register.ngo.google',
        navigate,
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
