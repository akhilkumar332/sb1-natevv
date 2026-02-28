// src/hooks/useRegister.ts
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { notify } from 'services/notify.service';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
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
      const userCredential = await confirmationResult.confirm(sanitizedOtp);

      clearRecaptchaVerifier();

      const { normalized: normalizedPhone } = validateGeneralPhoneInput(formData.identifier);

      // Check if user already registered by uid as a fallback
      const userRef = doc(db, 'users', userCredential.user.uid);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        // User already exists - sign them out and redirect to login
        await signOut(auth);
        notifyMobileAlreadyRegistered();
        navigate('/donor/login');
        return;
      }

      const existingMatches = await findUsersByPhone(normalizedPhone);
      const otherMatch = existingMatches.find(match => {
        const matchUid = match.uid || match.id;
        return matchUid !== userCredential.user.uid;
      });

      if (otherMatch) {
        await signOut(auth);
        notifyMobileAlreadyRegistered();
        navigate('/donor/login');
        return;
      }

      // Create new user document with Donor role
      const referralContext = await resolveReferralContext(userCredential.user.uid);
      await setDoc(userRef, {
        uid: userCredential.user.uid,
        phoneNumber: userCredential.user.phoneNumber,
        phoneNumberNormalized: normalizedPhone,
        role: 'donor',
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

      const token = await userCredential.user.getIdToken();
      if (!token) {
        throw new Error('No token received');
      }
      authStorage.setAuthToken(token);

      notify.success('Registration successful!');
      navigate('/donor/onboarding');
    } catch (error: any) {
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
        loginPath: '/donor/login',
        onboardingPath: '/donor/onboarding',
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
