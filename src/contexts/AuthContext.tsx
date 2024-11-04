// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { NavigateFunction } from 'react-router-dom';
import { FirebaseError } from 'firebase/app';
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
  fetchSignInMethodsForEmail,
} from 'firebase/auth';
import { 
  collection,
  query,
  where,
  getDocs,
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
  authLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithPhone: (phoneNumber: string) => Promise<ConfirmationResult>;
  logout: (navigate: NavigateFunction) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserProfile: (data: Partial<User>) => Promise<void>;
  loginLoading: boolean;
  setLoginLoading: (loading: boolean) => void;
  verifyOTP: (confirmationResult: ConfirmationResult, otp: string) => Promise<void>;
  checkUserExists: (email: string) => Promise<{ exists: boolean, isGoogleUser: boolean }>;
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
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      try {
        setAuthLoading(true);
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
        setAuthLoading(false);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const checkUserExists = async (email: string): Promise<{ exists: boolean, isGoogleUser: boolean }> => {
    try {
      // First check Firebase Auth sign-in methods
      const methods = await fetchSignInMethodsForEmail(auth, email);
      const isGoogleUser = methods.includes('google.com');
      
      if (methods.length > 0) {
        // If user exists in Firebase Auth, check Firestore
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email));
        const querySnapshot = await getDocs(q);
        
        // User must exist in both Firebase Auth and Firestore
        const exists = !querySnapshot.empty;
        
        return { 
          exists, 
          isGoogleUser 
        };
      }
      
      return { 
        exists: false, 
        isGoogleUser: false 
      };
    } catch (error) {
      console.error('Error checking user existence:', error);
      throw error;
    }
  };


  const login = async (email: string, password: string): Promise<void> => {
    try {
      setAuthLoading(true);
      const { exists, isGoogleUser } = await checkUserExists(email);
      
      if (!exists) {
        throw new Error('User not found. Please register first.');
      }
      
      if (isGoogleUser) {
        throw new Error('This account uses Google Sign-In. Please use the Google Sign-In button.');
      }
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      
      if (!userDoc.exists()) {
        await signOut(auth);
        throw new Error('User account not properly set up. Please contact support.');
      }
  
      const userData = userDoc.data() as User;
      setUser(userData);
      toast.success('Successfully logged in!');
    } catch (error) {
      if (error instanceof FirebaseError) {
        switch (error.code) {
          case 'auth/wrong-password':
            throw new Error('Invalid password. Please try again.');
          case 'auth/too-many-requests':
            throw new Error('Too many failed attempts. Please try again later.');
          case 'auth/user-not-found':
            throw new Error('User not found. Please register first.');
          default:
            throw new Error('An error occurred during login. Please try again.');
        }
      }
      throw error;
    } finally {
      setAuthLoading(false);
    }
  };

  const [loginLoading, setLoginLoading] = useState(false);

  const loginWithPhone = async (phoneNumber: string): Promise<ConfirmationResult> => {
    setLoginLoading(true);
    try {
      setAuthLoading(true); 
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
      cleanupRecaptcha();
      
      return confirmation;
    } catch (error) {
      cleanupRecaptcha();
      
      if (error instanceof FirebaseError) {
        switch (error.code) {
          case 'auth/invalid-phone-number':
            throw new Error('Invalid phone number format.');
          case 'auth/too-many-requests':
            throw new Error('Too many attempts. Please try again later.');
          default:
            throw new Error('Failed to send OTP. Please try again.');
        }
      }
      throw error;
    } finally {
      setLoginLoading(false);
      setAuthLoading(false);
    }
  };

  // Add this helper function for cleanup
  const cleanupRecaptcha = () => {
    const container = document.getElementById('recaptcha-container');
    if (container) {
      container.remove();
    }
    if (window.recaptchaVerifier) {
      window.recaptchaVerifier.clear();
      window.recaptchaVerifier = undefined;
    }
  };

  const verifyOTP = async (confirmationResult: ConfirmationResult, otp: string): Promise<void> => {
    try {
      const userCredential = await confirmationResult.confirm(otp);
      
      // Check if user exists in Firestore
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      if (!userDoc.exists()) {
        await signOut(auth);
        throw new Error('Please register as a donor first before signing in.');
      }
  
      const userData = await addUserToFirestore(userCredential.user);
      if (!userData) {
        throw new Error('Failed to retrieve user data');
      }
      
      setUser(userData);
    } catch (error) {
      if (error instanceof FirebaseError) {
        if (error.code === 'auth/invalid-verification-code') {
          throw new Error('Invalid OTP. Please try again.');
        }
        if (error.code === 'auth/code-expired') {
          throw new Error('OTP has expired. Please request a new one.');
        }
      }
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to verify OTP');
    }
  };

  const loginWithGoogle = async (): Promise<void> => {
    try {
      auth.useDeviceLanguage();
      
      const result = await signInWithPopup(auth, googleProvider);
      if (!result) {
        throw new Error('Failed to complete Google sign-in');
      }
  
      // Check if user exists in Firestore
      const userDoc = await getDoc(doc(db, 'users', result.user.uid));
      if (!userDoc.exists()) {
        await signOut(auth);
        throw new Error('Please register as a donor first before signing in.');
      }
  
      const userData = await addUserToFirestore(result.user);
      if (!userData) {
        throw new Error('Failed to retrieve user data');
      }
      
      setUser(userData);
    } catch (error) {
      if (error instanceof FirebaseError) {
        if (error.code === 'auth/popup-closed-by-user') {
          // Don't show error for user-cancelled operation
          return;
        }
        if (error.code === 'auth/popup-blocked') {
          throw new Error('Sign-in popup was blocked. Please allow popups for this site.');
        }
      }
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An unexpected error occurred');
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
    authLoading,
    login,
    loginWithGoogle,
    loginWithPhone,
    logout,
    resetPassword,
    updateUserProfile,
    loginLoading, 
    setLoginLoading,
    verifyOTP,
    checkUserExists,
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