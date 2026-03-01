// src/hooks/useLogin.ts
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PhoneAuthError } from '../errors/PhoneAuthError';
import { useLocation, useNavigate } from 'react-router-dom';
import { notify } from 'services/notify.service';
import { FirebaseError } from 'firebase/app';
import { authStorage } from '../utils/authStorage';
import { auth } from '../firebase';
import { captureHandledError } from '../services/errorLog.service';
import { authMessages } from '../constants/messages';
import { authFlowMessages, authInputMessages, getOtpValidationError, sanitizeOtp, validateGeneralPhoneInput } from '../utils/authInputValidation';
import { useOtpResendTimer } from './useOtpResendTimer';
import { requireValue } from '../utils/validationFeedback';
import { notifyGoogleSignInFailure, notifyRoleMismatch } from '../utils/authNotifications';

interface LoginFormData {
  identifier: string;
  otp: string;
}

export const useLogin = () => {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [formData, setFormData] = useState<LoginFormData>({
    identifier: '',
    otp: ''
  });
  const { otpResendTimer, startResendTimer } = useOtpResendTimer();
  const [confirmationResult, setConfirmationResult] = useState<any>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const { loginWithGoogle, loginWithPhone, verifyOTP, logout, user, authLoading } = useAuth();

  const navigateAfterDonorLogin = (loggedInUser: { onboardingCompleted?: boolean }) => {
    const pendingParams = new URLSearchParams(location.search);
    const rawReturnTo = pendingParams.get('returnTo') || '';
    const returnTo = rawReturnTo.startsWith('/') && !rawReturnTo.startsWith('//') ? rawReturnTo : '';
    pendingParams.delete('returnTo');
    const pendingSearch = pendingParams.toString();
    const hasPendingRequest = pendingParams.has('pendingRequest') || pendingParams.has('pendingRequestKey');
    if (loggedInUser.onboardingCompleted === true) {
      const destination = returnTo || (hasPendingRequest ? '/donor/dashboard/requests' : '/donor/dashboard');
      const target = pendingSearch
        ? `${destination}${destination.includes('?') ? '&' : '?'}${pendingSearch}`
        : destination;
      navigate(target);
      return;
    }
    const onboardingTarget = pendingSearch
      ? `/donor/onboarding?${pendingSearch}`
      : '/donor/onboarding';
    navigate(onboardingTarget);
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
    const { normalized: formattedNumber, error } = validateGeneralPhoneInput(formData.identifier);
    if (!requireValue(!error, error || authInputMessages.invalidIndiaPhone)) {
      return;
    }

    try {
      const confirmation = await loginWithPhone(formattedNumber);
      setConfirmationResult(confirmation);
      notify.success(authFlowMessages.otpSent);
      startResendTimer();
    } catch (error) {
      void captureHandledError(error, { source: 'frontend', scope: 'auth', metadata: { kind: 'auth.login.phone.submit' } });
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
      const verifiedUser = await verifyOTP(confirmationResult, sanitizedOtp);
      if (verifiedUser.role !== 'donor') {
        notify.error(
          verifiedUser.role === 'superadmin'
            ? authMessages.superadminGoogleOnly
            : authMessages.roleMismatch.donor,
          { id: 'role-mismatch-donor' }
        );
        await logout(navigate, { redirectTo: '/donor/login', showToast: false });
        return;
      }

      const token = await auth.currentUser?.getIdToken();
      if (token) {
        handleLoginSuccess(token);
      } else {
        throw new Error('No token received');
      }

      navigateAfterDonorLogin(verifiedUser);
      notify.success('Login successful!');
    } catch (error) {
      void captureHandledError(error, { source: 'frontend', scope: 'auth', metadata: { kind: 'auth.login.otp.verify' } });

      if (error instanceof PhoneAuthError) {
        if (error.code === 'not_registered') {
          notify.error('Mobile Number not registered. Please sign up.');
          navigate('/donor/register');
          return;
        }
        if (error.code === 'multiple_accounts') {
          notify.error('Mobile Number is linked to Multiple account, Contact Support');
          return;
        }
        if (error.code === 'role_mismatch') {
          notifyRoleMismatch('donor');
          return;
        }
        if (error.code === 'superadmin_google_only') {
          notify.error(authMessages.superadminGoogleOnly);
          return;
        }
        if (error.code === 'link_required') {
          notify.error('Phone number already registered. Please sign in with Google to link.');
          return;
        }
      }

      if (error instanceof FirebaseError) {
        if (error.code === 'auth/invalid-verification-code') {
          notify.error(authFlowMessages.otpInvalid);
        } else if (error.code === 'auth/code-expired') {
          notify.error(authFlowMessages.otpExpired);
        } else {
          notify.error(authFlowMessages.otpVerifyFailed);
        }
      } else {
        notify.error(authFlowMessages.otpVerifyFailed);
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
      void captureHandledError(error, { source: 'frontend', scope: 'auth', metadata: { kind: 'auth.login.otp.resend' } });
      notify.error(authFlowMessages.otpResendFailed);
    }
  };

  const handleLoginSuccess = (token: string) => {
    authStorage.setAuthToken(token);
  };

  const handleGoogleLogin = async () => {
    try {
      setGoogleLoading(true);
      const result = await loginWithGoogle();
      if (result.user.role !== 'donor' && result.user.role !== 'superadmin') {
        notifyRoleMismatch('donor');
        await logout(navigate, { redirectTo: '/donor/login', showToast: false });
        return;
      }
      if (result.user.role === 'superadmin') {
        if (result?.token) {
          handleLoginSuccess(result.token);
        }
        notify.success('Select a portal to continue.');
        return;
      }
      if (result?.token && result?.user) {
        handleLoginSuccess(result.token);
        notify.success('Successfully logged in with Google!');

        // Navigate based on onboarding status - if not explicitly true, go to onboarding
        navigateAfterDonorLogin(result.user);
      } else {
        throw new Error('No token received');
      }
    } catch (error) {
      void captureHandledError(error, { source: 'frontend', scope: 'auth', metadata: { kind: 'auth.login.google' } });
      notifyGoogleSignInFailure();
    } finally {
      setGoogleLoading(false);
    }
  };

  return {
    user,
    formData,
    otpResendTimer,
    confirmationResult,
    authLoading,
    handleIdentifierChange,
    handleChange,
    handlePhoneNumberSubmit,
    handleOTPSubmit,
    handleResendOTP,
    handleGoogleLogin,
    googleLoading,
    otpLoading,
  };
};
