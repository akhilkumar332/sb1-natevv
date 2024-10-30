export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  role?: 'donor' | 'hospital' | 'ngo' | 'admin';
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}