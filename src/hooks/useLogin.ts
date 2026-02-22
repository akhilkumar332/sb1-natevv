// src/hooks/useLogin.ts
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PhoneAuthError } from '../errors/PhoneAuthError';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FirebaseError } from 'firebase/app';
import { authStorage } from '../utils/authStorage';
import { auth } from '../firebase';
import { normalizePhoneNumber, isValidPhoneNumber } from '../utils/phone';

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
  const [otpResendTimer, setOtpResendTimer] = useState(0);
  const [confirmationResult, setConfirmationResult] = useState<any>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const { loginWithGoogle, loginWithPhone, verifyOTP, logout, user, authLoading } = useAuth();

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

  const startResendTimer = () => {
    setOtpResendTimer(30);
    const timer = setInterval(() => {
      setOtpResendTimer((prevTime) => {
        if (prevTime <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);
  };

  const handlePhoneNumberSubmit = async () => {
    const formattedNumber = normalizePhoneNumber(formData.identifier);
    if (!isValidPhoneNumber(formattedNumber)) {
      toast.error('Please enter a valid phone number.');
      return;
    }

    try {
      const confirmation = await loginWithPhone(formattedNumber);
      setConfirmationResult(confirmation);
      toast.success('OTP sent successfully!');
      startResendTimer();
    } catch (error) {
      toast.error('Failed to send OTP. Please try again.');
    }
  };

  const handleOTPSubmit = async () => {
    if (!confirmationResult) {
      toast.error('Please request an OTP before verifying.');
      return;
    }

    const sanitizedOtp = formData.otp.replace(/\D/g, '').trim();

    if (!sanitizedOtp) {
      toast.error('Please enter the OTP.');
      return;
    }

    if (sanitizedOtp.length !== 6) {
      toast.error('Invalid OTP length. Please enter the 6-digit code.');
      return;
    }
    try {
      setOtpLoading(true);
      const verifiedUser = await verifyOTP(confirmationResult, sanitizedOtp);
      if (verifiedUser.role !== 'donor') {
        toast.error(
          verifiedUser.role === 'superadmin'
            ? 'Superadmin can only sign in with Google.'
            : "You're not a Donor",
          { id: 'role-mismatch-donor' }
        );
        await logout(navigate, { redirectTo: '/donor/login', showToast: false });
        return;
      }

      const token = await auth.currentUser?.getIdToken();
      if (token) {
        handleLoginSuccess(token);
      }

      toast.success('Login successful!');
    } catch (error) {
      console.error('OTP verification error:', error);

      if (error instanceof PhoneAuthError) {
        if (error.code === 'not_registered') {
          toast.error('Mobile Number not registered. Please sign up.');
          navigate('/donor/register');
          return;
        }
        if (error.code === 'multiple_accounts') {
          toast.error('Mobile Number is linked to Multiple account, Contact Support');
          return;
        }
        if (error.code === 'role_mismatch') {
          toast.error("You're not a Donor", { id: 'role-mismatch-donor' });
          return;
        }
        if (error.code === 'superadmin_google_only') {
          toast.error('Superadmin can only sign in with Google.');
          return;
        }
        if (error.code === 'link_required') {
          toast.error('Phone number already registered. Please sign in with Google to link.');
          return;
        }
      }

      if (error instanceof FirebaseError) {
        if (error.code === 'auth/invalid-verification-code') {
          toast.error('Invalid OTP. Please try again.');
        } else if (error.code === 'auth/code-expired') {
          toast.error('OTP expired. Please request a new code.');
        } else {
          toast.error('Failed to verify OTP. Please try again.');
        }
      } else {
        toast.error('Failed to verify OTP. Please try again.');
      }
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOTP = async () => {
    try {
      const confirmation = await loginWithPhone(normalizePhoneNumber(formData.identifier));
      setConfirmationResult(confirmation);
      toast.success('OTP resent successfully!');
      startResendTimer();
    } catch (error) {
      toast.error('Failed to resend OTP. Please try again.');
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
        toast.error("You're not a Donor", { id: 'role-mismatch-donor' });
        await logout(navigate, { redirectTo: '/donor/login', showToast: false });
        return;
      }
      if (result.user.role === 'superadmin') {
        if (result?.token) {
          handleLoginSuccess(result.token);
        }
        toast.success('Select a portal to continue.');
        return;
      }
      if (result?.token && result?.user) {
        handleLoginSuccess(result.token);
        toast.success('Successfully logged in with Google!');

        // Navigate based on onboarding status - if not explicitly true, go to onboarding
        const pendingParams = new URLSearchParams(location.search);
        const rawReturnTo = pendingParams.get('returnTo') || '';
        const returnTo = rawReturnTo.startsWith('/') && !rawReturnTo.startsWith('//') ? rawReturnTo : '';
        pendingParams.delete('returnTo');
        const pendingSearch = pendingParams.toString();
        const hasPendingRequest = pendingParams.has('pendingRequest') || pendingParams.has('pendingRequestKey');
        if (result.user.onboardingCompleted === true) {
          console.log('Navigating to dashboard');
          const destination = returnTo || (hasPendingRequest ? '/donor/dashboard/requests' : '/donor/dashboard');
          const target = pendingSearch
            ? `${destination}${destination.includes('?') ? '&' : '?'}${pendingSearch}`
            : destination;
          navigate(target);
        } else {
          console.log('Navigating to onboarding');
          const onboardingTarget = pendingSearch
            ? `/donor/onboarding?${pendingSearch}`
            : '/donor/onboarding';
          navigate(onboardingTarget);
        }
      } else {
        throw new Error('No token received');
      }
    } catch (error) {
      console.error('Failed to sign in with Google. Please try again.');
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
