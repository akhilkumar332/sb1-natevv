// src/hooks/useLogin.ts
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
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
  const { loginWithGoogle, loginWithPhone, verifyOTP, user, authLoading } = useAuth();

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
    const digitsOnly = formData.identifier.replace(/\D/g, '');
    const isValid10Digits = digitsOnly.length === 10 || 
      (digitsOnly.startsWith('91') && digitsOnly.length === 12);
  
    if (!isValid10Digits) {
      toast.error('Please enter a valid 10-digit phone number.');
      return;
    }
  
    try {
      const confirmation = await loginWithPhone(formData.identifier);
      setConfirmationResult(confirmation);
      toast.success('OTP sent successfully!');
      startResendTimer();
    } catch (error) {
      toast.error('Please register as a donor first before signing in.');
    }
  };

  const handleOTPSubmit = async () => {
    if (!formData.otp) {
      toast.error('Please enter the OTP.');
      return;
    }
    try {
      setOtpLoading(true);
      const userData = await verifyOTP(confirmationResult, formData.otp);
      console.log('OTP verified, user data:', userData);
      console.log('Onboarding completed:', userData.onboardingCompleted);
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
      toast.error('Invalid OTP. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOTP = async () => {
    try {
      const confirmation = await loginWithPhone(formData.identifier);
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