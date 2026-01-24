// src/hooks/useLogin.ts
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FirebaseError } from 'firebase/app';
import { authStorage } from '../utils/authStorage';

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
  const { loginWithGoogle, loginWithPhone, verifyOTP, logout, user, authLoading } = useAuth();

  const handleIdentifierChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      identifier: value
    }));
  };

  const normalizePhoneNumber = (value: string) => {
    if (!value) return '';
    let formatted = value.replace(/\s+/g, '').trim();

    if (!formatted.startsWith('+')) {
      const digitsOnly = formatted.replace(/\D/g, '');
      if (digitsOnly.length === 10) {
        formatted = `+91${digitsOnly}`;
      } else if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
        formatted = `+${digitsOnly}`;
      }
    }

    return formatted;
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
    const digitsOnly = formattedNumber.replace(/\D/g, '');
    const isValidPhone = digitsOnly.length >= 10 && digitsOnly.length <= 15;

    if (!isValidPhone) {
      toast.error('Please enter a valid phone number.');
      return;
    }

    try {
      const confirmation = await loginWithPhone(formattedNumber);
      setConfirmationResult(confirmation);
      toast.success('OTP sent successfully!');
      startResendTimer();
    } catch (error) {
      toast.error('Please register as a donor first before signing in.');
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
      const userData = await verifyOTP(confirmationResult, sanitizedOtp);
      console.log('OTP verified, user data:', userData);
      console.log('Onboarding completed:', userData.onboardingCompleted);
      if (userData.role !== 'donor') {
        toast.error("You're not a Donor", { id: 'role-mismatch-donor' });
        await logout(navigate, { redirectTo: '/donor/login', showToast: false });
        return;
      }
      toast.success('Login successful!');

      // Navigate based on onboarding status - if not explicitly true, go to onboarding
      if (userData.onboardingCompleted === true) {
        console.log('Navigating to dashboard');
        navigate('/donor/dashboard');
      } else {
        console.log('Navigating to onboarding');
        navigate('/donor/onboarding');
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      if (error instanceof FirebaseError) {
        if (error.code === 'auth/invalid-verification-code') {
          toast.error('Invalid OTP. Please try again.');
        } else if (error.code === 'auth/code-expired') {
          toast.error('OTP expired. Please request a new code.');
        } else {
          toast.error('Failed to verify OTP. Please try again.');
        }
      } else if (error instanceof Error && error.message === 'User not registered') {
        toast.error('Please register as a donor before signing in.');
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
      if (result.user.role !== 'donor') {
        toast.error("You're not a Donor", { id: 'role-mismatch-donor' });
        await logout(navigate, { redirectTo: '/donor/login', showToast: false });
        return;
      }
      if (result?.token && result?.user) {
        handleLoginSuccess(result.token);
        console.log('Google login user data:', result.user);
        console.log('Onboarding completed:', result.user.onboardingCompleted);
        toast.success('Successfully logged in with Google!');

        // Navigate based on onboarding status - if not explicitly true, go to onboarding
        if (result.user.onboardingCompleted === true) {
          console.log('Navigating to dashboard');
          navigate('/donor/dashboard');
        } else {
          console.log('Navigating to onboarding');
          navigate('/donor/onboarding');
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
