// src/hooks/useLogin.ts
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

interface LoginFormData {
  identifier: string;
  otp: string;
}

export const useLogin = () => {
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
      await verifyOTP(confirmationResult, formData.otp);
      toast.success('Login successful!');
      navigate('/donor/dashboard');
    } catch (error) {
      toast.error('Invalid OTP. Please try again.');
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

  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle();
      toast.success('Successfully logged in with Google!');
      navigate('/donor/dashboard');
    } catch (error) {
      toast.error('Failed to sign in with Google. Please try again.');
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
    handleGoogleLogin
  };
};