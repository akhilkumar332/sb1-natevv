// src/hooks/useBloodBankRegister.ts
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerWithGoogleRole } from '../utils/googleRegister';

export const useBloodBankRegister = () => {
  const [googleLoading, setGoogleLoading] = useState(false);

  const navigate = useNavigate();

  const handleGoogleRegister = async () => {
    try {
      setGoogleLoading(true);
      await registerWithGoogleRole({
        role: 'bloodbank',
        loginPath: '/bloodbank/login',
        onboardingPath: '/bloodbank/onboarding',
        scope: 'auth',
        kind: 'auth.register.bloodbank.google',
        navigate,
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  return {
    handleGoogleRegister,
    googleLoading,
  };
};
