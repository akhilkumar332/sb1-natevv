// src/services/api/types.ts

export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message: string;
}

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface OTPResponse {
  success: boolean;
  message: string;
  sessionInfo?: string;
}

export interface GoogleAuthResponse {
  token: string;
  user: User;
}

export interface User {
  id: string;
  email?: string;
  phoneNumber?: string;
  displayName?: string;
  photoURL?: string;
  bhId?: string;
  role?: UserRole;
  createdAt?: string;
  updatedAt?: string;
}

export enum UserRole {
  DONOR = 'donor',
  NGO = 'ngo',
  BLOODBANK = 'bloodbank',
  HOSPITAL = 'hospital',
  ADMIN = 'admin',
}
