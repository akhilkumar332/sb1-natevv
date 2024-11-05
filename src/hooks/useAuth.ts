// src/hooks/useAuth.ts

import { useState } from 'react';
import { authApi } from '../services/api/authApi';
import { ApiResponse, LoginResponse, OTPResponse, GoogleAuthResponse, ApiError } from '../services/api/types';

export function useAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const loginWithPhone = async (phoneNumber: string): Promise<ApiResponse<OTPResponse>> => {
    try {
      setLoading(true);
      setError(null);
      return await authApi.loginWithPhone(phoneNumber);
    } catch (err) {
      setError(err as ApiError);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async (phoneNumber: string, otp: string): Promise<ApiResponse<LoginResponse>> => {
    try {
      setLoading(true);
      setError(null);
      return await authApi.verifyOTP(phoneNumber, otp);
    } catch (err) {
      setError(err as ApiError);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async (idToken: string): Promise<ApiResponse<GoogleAuthResponse>> => {
    try {
      setLoading(true);
      setError(null);
      return await authApi.loginWithGoogle(idToken);
    } catch (err) {
      setError(err as ApiError);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    loginWithPhone,
    verifyOTP,
    loginWithGoogle,
  };
}