// src/services/api/authApi.ts

import { BaseApiClient } from './baseApi';
import { API_CONFIG } from './config';
import { ApiResponse, LoginResponse, OTPResponse, GoogleAuthResponse } from './types';

class AuthApi extends BaseApiClient {
  async loginWithPhone(phoneNumber: string): Promise<ApiResponse<OTPResponse>> {
    return this.post<OTPResponse>(
      API_CONFIG.ENDPOINTS.AUTH.PHONE_LOGIN,
      { phoneNumber }
    );
  }

  async verifyOTP(phoneNumber: string, otp: string): Promise<ApiResponse<LoginResponse>> {
    return this.post<LoginResponse>(
      API_CONFIG.ENDPOINTS.AUTH.VERIFY_OTP,
      { phoneNumber, otp }
    );
  }

  async loginWithGoogle(idToken: string): Promise<ApiResponse<GoogleAuthResponse>> {
    return this.post<GoogleAuthResponse>(
      API_CONFIG.ENDPOINTS.AUTH.GOOGLE_LOGIN,
      { idToken }
    );
  }
}

export const authApi = new AuthApi();