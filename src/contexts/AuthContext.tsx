import React, { createContext, useContext, useState, useEffect } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from 'firebase/auth';
import { AuthContextType, User } from '../types';

const AuthContext = createContext<AuthContextType | null>(null);

// In your AuthProvider component
const resetPassword = (email: string) => {
  return sendPasswordResetEmail(auth, email);
};

// Include this in the context value
const value = {
  // ... other auth-related values and functions
  resetPassword,
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser ] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser ) => {
      if (firebaseUser ) {
        setUser ({
          uid: firebaseUser .uid,
          email: firebaseUser .email,
          displayName: firebaseUser .displayName,
        });
      } else {
        setUser (null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    loginWithGoogle,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}