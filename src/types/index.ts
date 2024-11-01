// src/types/index.ts

// User type definition
export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
}

// AuthContextType definition
export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}