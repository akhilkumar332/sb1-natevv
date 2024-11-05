// src/types/api.ts

export interface ApiResponse<T = any> {
    data: T;
    message: string;
    status: number;
  }
  
  export interface ApiError {
    message: string;
    status: number;
    code?: string;
  }
  
  export interface LoginResponse {
    token: string;
    user: {
      id: string;
      email?: string;
      phoneNumber?: string;
      // Add other user fields as needed
    };
  }
  
  export interface OTPResponse {
    success: boolean;
    message: string;
    sessionInfo?: string;
  }
  
  export interface GoogleAuthResponse {
    token: string;
    user: {
      id: string;
      email: string;
      displayName?: string;
      photoURL?: string;
    };
  }