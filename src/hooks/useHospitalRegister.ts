// src/hooks/useHospitalRegister.ts
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';
import { signInWithPopup, signOut } from 'firebase/auth';

interface RegisterFormData {
  identifier: string;
  otp: string;
}

export const useHospitalRegister = () => {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [formData, setFormData] = useState<RegisterFormData>({
    identifier: '',
    otp: ''
  });
  const [otpResendTimer, setOtpResendTimer] = useState(0);
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
      const phoneNumber = formData.identifier.startsWith('+')
        ? formData.identifier
        : `+${formData.identifier}`;

      const confirmation = await loginWithPhone(phoneNumber);
      setConfirmationResult(confirmation);
      toast.success('OTP sent successfully!');
      startResendTimer();
    } catch (error: any) {
      console.error('Phone registration error:', error);
      toast.error('Failed to send OTP. Please try again.');
    }
  };

  const handleOTPSubmit = async () => {
    if (!formData.otp) {
      toast.error('Please enter the OTP.');
      return;
    }
    try {
      setOtpLoading(true);
      const userCredential = await confirmationResult.confirm(formData.otp);

      // Clean up reCAPTCHA after successful verification
      const container = document.getElementById('recaptcha-container');
      if (container) {
        container.remove();
      }
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
        } catch (e) {
          console.warn('Error clearing recaptcha:', e);
        }
        window.recaptchaVerifier = undefined;
      }

      // Check if user already registered
      const userRef = doc(db, 'users', userCredential.user.uid);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        // User already exists - sign them out and redirect to login
        await signOut(auth);
        toast.error('Phone number already registered. Please use the login page.');
        navigate('/hospital/login');
        return;
      }

      // Create new user document with Hospital role
      await setDoc(userRef, {
        uid: userCredential.user.uid,
        phoneNumber: userCredential.user.phoneNumber,
        role: 'hospital',
        onboardingCompleted: false,
        createdAt: new Date(),
        lastLoginAt: new Date(),
      });

      toast.success('Registration successful!');
      navigate('/hospital/onboarding');
    } catch (error: any) {
      console.error('OTP verification error:', error);

      // Clean up reCAPTCHA on error
      const container = document.getElementById('recaptcha-container');
      if (container) {
        container.remove();
      }
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
        } catch (e) {
          console.warn('Error clearing recaptcha on error:', e);
        }
        window.recaptchaVerifier = undefined;
      }

      if (error.code === 'auth/invalid-verification-code') {
        toast.error('Invalid OTP. Please try again.');
      } else {
        toast.error('Verification failed. Please try again.');
      }
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

  const handleGoogleRegister = async () => {
    try {
      setGoogleLoading(true);

      // Authenticate with Google
      auth.useDeviceLanguage();
      const result = await signInWithPopup(auth, googleProvider)
        .catch((error) => {
          if (error.code === 'auth/popup-closed-by-user') {
            throw new Error('Sign-in popup was closed before completing the sign-in process.');
          }
          if (error.code === 'auth/popup-blocked') {
            throw new Error('Sign-in popup was blocked by the browser. Please allow popups for this site.');
          }
          throw error;
        });

      if (!result) {
        throw new Error('Failed to get sign-in result');
      }

      // Check if user already registered
      const userRef = doc(db, 'users', result.user.uid);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        // User already exists - sign them out and redirect to login
        await signOut(auth);
        toast.error('Email already registered. Please use the login page.');
        navigate('/hospital/login');
        return;
      }

      // Create new user document with Hospital role
      await setDoc(userRef, {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL,
        role: 'hospital',
        onboardingCompleted: false,
        createdAt: new Date(),
        lastLoginAt: new Date(),
      });

      toast.success('Registration successful!');
      navigate('/hospital/onboarding');
    } catch (error: any) {
      console.error('Google registration error:', error);
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('Registration failed. Please try again.');
      }
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
