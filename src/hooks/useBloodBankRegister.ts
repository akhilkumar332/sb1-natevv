// src/hooks/useBloodBankRegister.ts
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerWithGoogleRole } from '../utils/googleRegister';
import { ROUTES } from '../constants/routes';

export const useBloodBankRegister = () => {
  const [googleLoading, setGoogleLoading] = useState(false);

  const navigate = useNavigate();

  const handleGoogleRegister = async () => {
    try {
      setGoogleLoading(true);
      await registerWithGoogleRole({
        role: 'bloodbank',
        loginPath: ROUTES.portal.bloodbank.login,
        onboardingPath: ROUTES.portal.bloodbank.onboarding,
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
