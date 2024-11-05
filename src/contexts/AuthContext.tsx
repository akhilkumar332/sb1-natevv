// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { NavigateFunction } from 'react-router-dom';
import toast from 'react-hot-toast';
import { 
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc,
  serverTimestamp, 
  DocumentReference,
  DocumentSnapshot
} from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';

// Define window recaptcha type
declare global {
  interface Window {
    recaptchaVerifier?: any;
  }
}

// Define User interface with additional Firestore fields
interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  phoneNumber?: string | null;
  createdAt?: Date;
  lastLoginAt?: Date;
  role?: 'donor' | 'recipient' | 'admin';
  bloodType?: string;
  location?: {
    latitude?: number;
    longitude?: number;
    address?: string;
  };
  isAvailable?: boolean;
  lastDonation?: Date;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authLoading: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithPhone: (phoneNumber: string) => Promise<ConfirmationResult>;
  logout: (navigate: NavigateFunction) => Promise<void>;
  updateUserProfile: (data: Partial<User>) => Promise<void>;
  loginLoading: boolean;
  setLoginLoading: (loading: boolean) => void;
  verifyOTP: (confirmationResult: ConfirmationResult, otp: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Helper function to convert Firestore timestamp to Date
const convertTimestampToDate = (timestamp: any): Date | undefined => {
  return timestamp ? new Date(timestamp.seconds * 1000) : undefined;
};

// Helper function to add or update user in Firestore
const addUserToFirestore = async (
  firebaseUser: FirebaseUser, 
  additionalData?: Partial<User>
): Promise<User | null> => {
  const userRef: DocumentReference = doc(db, 'users', firebaseUser.uid);
  const userDoc: DocumentSnapshot = await getDoc(userRef);
  
  if (!userDoc.exists()) {
    return null;
  }

  const userData: Partial<User> = {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName,
    photoURL: firebaseUser.photoURL,
    phoneNumber: firebaseUser.phoneNumber,
    lastLoginAt: new Date(),
    ...additionalData
  };

  await setDoc(userRef, {
    ...userData,
    lastLoginAt: serverTimestamp(),
  }, { merge: true });

  const updatedUserDoc = await getDoc(userRef);
  const updatedUserData = updatedUserDoc.data();

  return {
    ...userData,
    createdAt: convertTimestampToDate(updatedUserData?.createdAt),
    lastLoginAt: convertTimestampToDate(updatedUserData?.lastLoginAt),
    lastDonation: convertTimestampToDate(updatedUserData?.lastDonation),
  } as User;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      try {
        setAuthLoading(true);
        if (firebaseUser) {
          const userData = await addUserToFirestore(firebaseUser);
          if (userData) {
            setUser(userData);
          } else {
            await signOut(auth);
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Error in auth state change:', error);
        setUser(null);
      } finally {
        setAuthLoading(false);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const loginWithPhone = async (phoneNumber: string): Promise<ConfirmationResult> => {
    setLoginLoading(true);
    try {
      setAuthLoading(true);
      // Clean up existing recaptcha
      const existingContainer = document.getElementById('recaptcha-container');
      if (existingContainer) {
        existingContainer.remove();
      }
  
      // Create new recaptcha container
      const container = document.createElement('div');
      container.id = 'recaptcha-container';
      document.body.appendChild(container);
  
      // Clear existing verifier
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = undefined;
      }
  
      // Create new recaptcha verifier
      const recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        'size': 'invisible',
        'callback': () => {},
        'expired-callback': () => {
          toast.error('reCAPTCHA expired. Please try again.');
        }
      });
  
      window.recaptchaVerifier = recaptchaVerifier;
  
      // Send OTP
      const confirmation = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
      
      // Clean up after successful send
      if (container) {
        container.remove();
      }
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = undefined;
      }
  
      return confirmation;
    } catch (error) {
      // Clean up on error
      const container = document.getElementById('recaptcha-container');
      if (container) {
        container.remove();
      }
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = undefined;
      }
      console.error('Phone login error:', error);
      throw error;
    } finally {
      setLoginLoading(false);
      setAuthLoading(false);
    }
  };

  const verifyOTP = async (confirmationResult: ConfirmationResult, otp: string): Promise<void> => {
    try {
      const userCredential = await confirmationResult.confirm(otp);
      const userData = await addUserToFirestore(userCredential.user);
      if (!userData) {
        throw new Error('User not registered');
      }
      setUser(userData);
    } catch (error) {
      console.error('OTP verification error:', error);
      throw error;
    }
  };

  const loginWithGoogle = async (): Promise<void> => {
    try {
      auth.useDeviceLanguage();
      
      const result = await signInWithPopup(auth, googleProvider)
        .catch((error) => {
          if (error.code === 'auth/popup-closed-by-user') {
            throw new Error('Sign-in popup was closed before completing the sign-in process.');
          }
          if (error.code === 'auth/popup-blocked') {
            throw new Error('Sign-in popup was blocked by the browser. Please allow popups for this site.');
          }
          throw error;
        });
  
      if (!result) {
        throw new Error('Failed to get sign-in result');
      }
  
      const userData = await addUserToFirestore(result .user);
      if (!userData) {
        throw new Error('User not registered');
      }
    } catch (error) {
      console.error('Google login error:', error);
      if (error instanceof Error) {
        toast.error(error.message);
      }
      throw error;
    }
  };

  const logout = async (navigate: NavigateFunction): Promise<void> => {
    try {
      await signOut(auth);
      setUser(null);
      localStorage.removeItem('authToken'); // Clear any stored auth tokens
      sessionStorage.clear(); // Clear session storage
      toast.success('Successfully logged out!'); // Add success toast
      navigate('/donor/login');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to log out. Please try again.');
    }
  };

  const updateUserProfile = async (data: Partial<User>): Promise<void> => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), data, { merge: true });
      setUser (prev => ({ ...prev, ...data } as User));
    } catch (error) {
      console.error('Error updating user profile:', error);
      toast.error('Failed to update profile. Please try again.');
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, authLoading, loginWithGoogle, loginWithPhone, logout, updateUserProfile, loginLoading, setLoginLoading, verifyOTP }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export type { User, AuthContextType };