// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { NavigateFunction } from 'react-router-dom';
import { 
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  sendPasswordResetEmail,
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
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithPhone: (phoneNumber: string) => Promise<ConfirmationResult>;
  logout: (navigate: NavigateFunction) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserProfile: (data: Partial<User>) => Promise<void>;
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
    // User is not registered in the database
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

  // Merge with existing data
  await setDoc(userRef, {
    ...userData,
    lastLoginAt: serverTimestamp(),
  }, { merge: true });

  // Get the updated user data
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      try {
        if (firebaseUser) {
          // Get user data from Firestore
          const userData = await addUserToFirestore(firebaseUser);
          if (userData) {
            setUser(userData);
          } else {
            // User is not registered, sign them out
            await signOut(auth);
            setUser(null);
            //toast.error('User not registered. Please register first.');
          }
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Error in auth state change:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userData = await addUserToFirestore(userCredential.user);
      if (!userData) {
        throw new Error('User not registered');
      }
    } catch (error) {
      console.error('Login error:', error);
      if (error instanceof Error && error.message === 'User not registered') {
        //toast.error('User not registered. Please register first.');
      }
      throw error;
    }
  };

  const loginWithPhone = async (phoneNumber: string): Promise<ConfirmationResult> => {
    try {
      // First, remove any existing recaptcha containers
      const existingContainer = document.getElementById('recaptcha-container');
      if (existingContainer) {
        existingContainer.remove();
      }
  
      // Create new container
      const container = document.createElement('div');
      container.id = 'recaptcha-container';
      document.body.appendChild(container);
  
      // Clear any existing reCAPTCHA widgets
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = undefined;
      }
  
      // Create new reCAPTCHA verifier
      const recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        'size': 'invisible',
        'callback': () => {
          // reCAPTCHA solved, allow signInWithPhoneNumber.
        },
        'expired-callback': () => {
          // Response expired. Ask user to solve reCAPTCHA again.
          toast.error('reCAPTCHA expired. Please try again.');
        }
      });
  
      // Store verifier instance globally
      window.recaptchaVerifier = recaptchaVerifier;
  
      const confirmation = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
      
      // Clean up after successful confirmation
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
    }
  };

  const loginWithGoogle = async (): Promise<void> => {
    try {
      // Configure auth to use popup
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
  
      const userData = await addUserToFirestore(result.user);
      if (!userData) {
        throw new Error('User not registered');
      }
    } catch (error) {
      console.error('Google login error:', error);
      if (error instanceof Error) {
        if (error.message === 'User not registered') {
          //toast.error('User not registered. Please register first.');
        } else {
          toast.error(error.message);
        }
      }
      throw error;
    }
  };

  const logout = async (navigate: NavigateFunction): Promise<void> => {
    try {
      await signOut(auth);
      setUser(null);
      
      localStorage.removeItem('authToken');
      sessionStorage.clear();

      toast.success('You have been successfully logged out');

      navigate('/donor/login');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('An error occurred during logout. Please try again.');
    }
  };


  const resetPassword = async (email: string): Promise<void> => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error('Password reset error:', error);
      throw error;
    }
  };

  const updateUserProfile = async (data: Partial<User>): Promise<void> => {
    if (!user?.uid) throw new Error('No user logged in');
    
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        ...data,
        updatedAt: serverTimestamp (),
      }, { merge: true });

      // Update local user state
      setUser(prev => prev ? { ...prev, ...data } : null);
    } catch (error) {
      console.error('Profile update error:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    loginWithGoogle,
    loginWithPhone,
    logout,
    resetPassword,
    updateUserProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export type { User, AuthContextType };