// src/services/api/authApi.ts

import axios from 'axios';
import { 
  ApiResponse,  
  LoginResponse, 
  OTPResponse, 
  GoogleAuthResponse 
} from '../../types/api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5173/api';

const authApi = axios.create({
  baseURL: `${API_BASE_URL}/auth`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Error handler
const handleApiError = (error: unknown): never => {
  if (axios.isAxiosError(error)) {
    const errorMessage = error.response?.data?.message || error.message;
    throw new Error(errorMessage);
  }
  throw new Error('An unexpected error occurred');
};

export const loginWithPhone = async (phoneNumber: string): Promise<ApiResponse<OTPResponse>> => {
  try {
    const response = await authApi.post<ApiResponse<OTPResponse>>('/login/phone', { phoneNumber });
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

export const verifyOTP = async (phoneNumber: string, otp: string): Promise<ApiResponse<LoginResponse>> => {
  try {
    const response = await authApi.post<ApiResponse<LoginResponse>>('/verify-otp', { phoneNumber, otp });
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

export const loginWithGoogle = async (idToken: string): Promise<ApiResponse<GoogleAuthResponse>> => {
  try {
    const response = await authApi.post<ApiResponse<GoogleAuthResponse>>('/login/google', { idToken });
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Add type for the interceptor
authApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      // For example, redirect to login or refresh token
    }
    return Promise.reject(error);
  }
);

export default authApi;