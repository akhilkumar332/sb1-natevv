// src/types/index.ts

export * from './api';

// User related types
export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  phoneNumber?: string | null;
  createdAt?: Date;
  lastLoginAt?: Date;
  role?: 'donor' | 'recipient' | 'admin';
}

// Auth Context types
export interface AuthContextType {
  user: User | null;
  loading: boolean;
  authLoading: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithPhone: (phoneNumber: string) => Promise<any>;
  logout: (navigate: any) => Promise<void>;
  updateUserProfile: (data: Partial<User>) => Promise<void>;
  loginLoading: boolean;
  setLoginLoading: (loading: boolean) => void;
  verifyOTP: (confirmationResult: any, otp: string) => Promise<void>;
}

// Form types
export interface LoginFormData {
  email: string;
  password: string;
}

export interface RegisterFormData extends LoginFormData {
  displayName: string;
  phoneNumber: string;
  bloodType: string;
}

// API types
export interface ApiResponse<T> {
  data: T;
  status: number;
  message: string;
}

export interface ErrorResponse {
  message: string;
  code: string;
}

// Component prop types
export interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export interface InputProps {
  label: string;
  name: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
}