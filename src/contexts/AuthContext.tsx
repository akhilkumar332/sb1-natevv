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
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  sendEmailVerification,
} from 'firebase/auth';
import { 
  doc,
  setDoc, 
  getDoc, 
  updateDoc, 
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
  gender?: 'Male' | 'Female' | 'Other';
  dateOfBirth?: Date;
  phoneNumber?: string | null;
  createdAt?: Date;
  lastLoginAt?: Date;
  role?: 'donor' | 'ngo' | 'hospital' | 'admin';
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  bloodType?: string;
  location?: {
    latitude?: number;
    longitude?: number;
  };
  onboardingCompleted?: boolean;
  isAvailable?: boolean;
  lastDonation?: Date;
  totalDonations?: number;
  medicalConditions?: string;
  occupation?: string;
  preferredLanguage?: string;
  howHeardAboutUs?: string;
  interestedInVolunteering?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authLoading: boolean;
  loginWithGoogle: () => Promise<LoginResponse>;
  loginWithPhone: (phoneNumber: string) => Promise<ConfirmationResult>;
  loginWithEmail: (email: string, password: string) => Promise<LoginResponse>;
  registerWithEmail: (email: string, password: string, displayName: string) => Promise<FirebaseUser>;
  resetPassword: (email: string) => Promise<void>;
  logout: (navigate: NavigateFunction) => Promise<void>;
  updateUserProfile: (data: Partial<User>) => Promise<void>;
  loginLoading: boolean;
  setLoginLoading: (loading: boolean) => void;
  verifyOTP: (confirmationResult: ConfirmationResult, otp: string) => Promise<User>;
  setAuthLoading: (loading: boolean) => void;
}

interface LoginResponse {
  token: string;
  user: User;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Helper function to convert Firestore timestamp to Date
const convertTimestampToDate = (timestamp: any): Date | undefined => {
  return timestamp ? new Date(timestamp.seconds * 1000) : undefined;
};

// Helper function to update user in Firestore
const updateUserInFirestore = async (
  firebaseUser: FirebaseUser,
  additionalData?: Partial<User>
): Promise<User | null> => {
  const userRef: DocumentReference = doc(db, 'users', firebaseUser.uid);
  const userDoc: DocumentSnapshot = await getDoc(userRef);

  // If user document doesn't exist, return null
  if (!userDoc.exists()) {
    return null;
  }

  const existingUserData = userDoc.data() as User;

  // Prepare optimized update (only lastLoginAt)
  await updateDoc(userRef, {
    lastLoginAt: serverTimestamp(),
  });

  // Return user data without extra fetch
  return {
    ...existingUserData,
    uid: firebaseUser.uid,
    email: firebaseUser.email || existingUserData.email,
    displayName: firebaseUser.displayName || existingUserData.displayName,
    photoURL: firebaseUser.photoURL || existingUserData.photoURL,
    phoneNumber: firebaseUser.phoneNumber || existingUserData.phoneNumber,
    lastLoginAt: new Date(),
    createdAt: convertTimestampToDate(existingUserData?.createdAt),
    dateOfBirth: convertTimestampToDate(existingUserData?.dateOfBirth),
    lastDonation: convertTimestampToDate(existingUserData?.lastDonation),
    ...additionalData
  } as User;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const logoutChannel = new BroadcastChannel('auth_logout');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      try {
        if (firebaseUser) {
          const userData = await updateUserInFirestore(firebaseUser);
          if (userData) {
            setUser(userData);
          } else {
            // If user update fails (document doesn't exist)
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
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Listen for logout events from other tabs
    const handleLogoutEvent = (event: MessageEvent) => {
      if (event.data === 'logout') {
        handleLogout();
      }
    };

    logoutChannel.addEventListener('message', handleLogoutEvent);

    // Cleanup listener on unmount
    return () => {
      logoutChannel.removeEventListener('message', handleLogoutEvent);
      logoutChannel.close();
    };
  }, []);

  const loginWithPhone = async (phoneNumber: string): Promise<ConfirmationResult> => {
    setLoginLoading(true);
    try {
      setAuthLoading(true);

      // Clear existing verifier first
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
        } catch (e) {
          console.warn('Error clearing recaptcha:', e);
        }
        window.recaptchaVerifier = undefined;
      }

      // Clean up existing recaptcha container
      const existingContainer = document.getElementById('recaptcha-container');
      if (existingContainer) {
        existingContainer.remove();
      }

      // Create new recaptcha container
      const container = document.createElement('div');
      container.id = 'recaptcha-container';
      document.body.appendChild(container);

      // Create new recaptcha verifier
      const recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        'size': 'invisible',
        'callback': () => {
          console.log('reCAPTCHA solved');
        },
        'expired-callback': () => {
          toast.error('reCAPTCHA expired. Please try again.');
        }
      });

      window.recaptchaVerifier = recaptchaVerifier;

      // Send OTP
      const confirmation = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);

      console.log('OTP sent successfully');

      // DON'T clean up here - keep recaptcha active until OTP is verified
      return confirmation;
    } catch (error) {
      // Clean up on error only
      const container = document.getElementById('recaptcha-container');
      if (container) {
        container.remove();
      }
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
        } catch (e) {
          console.warn('Error clearing recaptcha on error:', e);
        }
        window.recaptchaVerifier = undefined;
      }
      console.error('Phone login error:', error);
      throw error;
    } finally {
      setLoginLoading(false);
      setAuthLoading(false);
    }
  };

  const verifyOTP = async (confirmationResult: ConfirmationResult, otp: string): Promise<User> => {
    try {
      const userCredential = await confirmationResult.confirm(otp);

      // Clean up reCAPTCHA after successful verification
      const container = document.getElementById('recaptcha-container');
      if (container) {
        container.remove();
      }
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
        } catch (e) {
          console.warn('Error clearing recaptcha after OTP verify:', e);
        }
        window.recaptchaVerifier = undefined;
      }

      const userRef = doc(db, 'users', userCredential.user.uid);

      // Fetch user data first
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        await signOut(auth);
        throw new Error('User not registered');
      }

      const userData = userDoc.data() as User;

      // Update last login in background (don't wait)
      updateDoc(userRef, { lastLoginAt: serverTimestamp() }).catch(err =>
        console.error('Failed to update lastLoginAt:', err)
      );

      // Prepare user data
      const userDataToReturn = {
        ...userData,
        uid: userCredential.user.uid,
        lastLoginAt: new Date(),
        createdAt: convertTimestampToDate(userData?.createdAt),
        dateOfBirth: convertTimestampToDate(userData?.dateOfBirth),
        lastDonation: convertTimestampToDate(userData?.lastDonation),
      } as User;

      // Update user state immediately for navigation
      setUser(userDataToReturn);

      // Return user data for immediate navigation
      return userDataToReturn;
    } catch (error) {
      console.error('OTP verification error:', error);

      // Clean up reCAPTCHA on error too
      const container = document.getElementById('recaptcha-container');
      if (container) {
        container.remove();
      }
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
        } catch (e) {
          console.warn('Error clearing recaptcha on OTP error:', e);
        }
        window.recaptchaVerifier = undefined;
      }

      throw error;
    }
  };

  const loginWithEmail = async (email: string, password: string): Promise<LoginResponse> => {
    try {
      setLoginLoading(true);
      setAuthLoading(true);

      const result = await signInWithEmailAndPassword(auth, email, password);

      if (!result) {
        throw new Error('Failed to sign in with email');
      }

      // Check if user exists in Firestore
      const userRef = doc(db, 'users', result.user.uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        await signOut(auth);
        throw new Error('User not registered. Please register first.');
      }

      // Get the token
      const token = await result.user.getIdToken();

      const userDataToReturn = {
        ...userDoc.data(),
        uid: result.user.uid,
        createdAt: convertTimestampToDate(userDoc.data()?.createdAt),
        dateOfBirth: convertTimestampToDate(userDoc.data()?.dateOfBirth),
        lastLoginAt: new Date(),
        lastDonation: convertTimestampToDate(userDoc.data()?.lastDonation),
      } as User;

      // Update last login time in background
      updateDoc(userRef, { lastLoginAt: serverTimestamp() }).catch(err =>
        console.error('Failed to update lastLoginAt:', err)
      );

      // Update user state immediately
      setUser(userDataToReturn);

      return {
        token,
        user: userDataToReturn
      };
    } catch (error: any) {
      console.error('Email login error:', error);

      // Provide user-friendly error messages
      let errorMessage = 'Failed to sign in';
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      } else if (error.code === 'auth/user-disabled') {
        errorMessage = 'This account has been disabled';
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      toast.error(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoginLoading(false);
      setAuthLoading(false);
    }
  };

  const registerWithEmail = async (
    email: string,
    password: string,
    displayName: string
  ): Promise<FirebaseUser> => {
    try {
      setAuthLoading(true);

      // Create user account
      const result = await createUserWithEmailAndPassword(auth, email, password);

      // Update profile with display name
      await updateProfile(result.user, { displayName });

      // Send email verification
      await sendEmailVerification(result.user);

      toast.success('Registration successful! Please check your email for verification.');

      return result.user;
    } catch (error: any) {
      console.error('Email registration error:', error);

      // Provide user-friendly error messages
      let errorMessage = 'Failed to register';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'An account with this email already exists';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Use at least 6 characters';
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      toast.error(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setAuthLoading(false);
    }
  };

  const resetPassword = async (email: string): Promise<void> => {
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success('Password reset email sent! Please check your inbox.');
    } catch (error: any) {
      console.error('Password reset error:', error);

      let errorMessage = 'Failed to send password reset email';
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      toast.error(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const loginWithGoogle = async (): Promise<LoginResponse> => {
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

      // Check if user exists before proceeding
      const userRef = doc(db, 'users', result.user.uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        await signOut(auth);
        throw new Error('User not registered. Please register first.');
      }

      // Get the token
      const token = await result.user.getIdToken();

      const userDataToReturn = {
        ...userDoc.data(),
        uid: result.user.uid,
        createdAt: convertTimestampToDate(userDoc.data()?.createdAt),
        dateOfBirth: convertTimestampToDate(userDoc.data()?.dateOfBirth),
        lastLoginAt: new Date(),
        lastDonation: convertTimestampToDate(userDoc.data()?.lastDonation),
      } as User;

      // Update user state immediately for navigation
      setUser(userDataToReturn);

      return {
        token,
        user: userDataToReturn
      };
    } catch (error) {
      console.error('Google login error:', error);
      if (error instanceof Error) {
        toast.error(error.message);
      }
      throw error;
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      setUser(null);
      localStorage.removeItem('authToken');
      sessionStorage.clear();
      
      // Clear any other auth-related storage
      localStorage.removeItem('user');
      localStorage.removeItem('lastLoginTime');
      
      // Optional: Clear any cached data
      indexedDB.deleteDatabase('firebaseLocalStorageDb');
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  const logout = async (navigate: NavigateFunction) => {
    try {
      await handleLogout();
      
      // Broadcast logout event to other tabs
      logoutChannel.postMessage('logout');
      
      toast.success('Successfully logged out!');
      navigate('/donor/login');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to log out. Please try again.');
    }
  };

  // Update updateUserProfile method to handle onboarding
  const updateUserProfile = async (data: Partial<User>): Promise<void> => {
    if (!user) {
      throw new Error('No user logged in');
    }
    console.log('Updating user profile with:', data);
    try {
      await setDoc(doc(db, 'users', user.uid),
        {
          ...data,
          onboardingCompleted: true // Set this to true upon successful completion
        },
        { merge: true }
      );
      setUser (prev => ({
        ...prev,
        ...data,
        onboardingCompleted: true // Ensure this is updated in the state
      } as User));
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error; // Re-throw the error so the caller can handle it
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      authLoading,
      loginWithGoogle,
      loginWithPhone,
      loginWithEmail,
      registerWithEmail,
      resetPassword,
      logout,
      updateUserProfile,
      loginLoading,
      setLoginLoading,
      verifyOTP,
      setAuthLoading
    }}>
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