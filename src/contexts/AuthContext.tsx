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
  role?: 'donor' | 'recipient' | 'admin';
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
  logout: (navigate: NavigateFunction) => Promise<void>;
  updateUserProfile: (data: Partial<User>) => Promise<void>;
  loginLoading: boolean;
  setLoginLoading: (loading: boolean) => void;
  verifyOTP: (confirmationResult: ConfirmationResult, otp: string) => Promise<void>;
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

  // Prepare user data for update
  const userData: Partial<User> = {
    onboardingCompleted: false,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName,
    photoURL: firebaseUser.photoURL,
    phoneNumber: firebaseUser.phoneNumber,
    lastLoginAt: new Date(),
    ...additionalData
  };

  // Update the existing document
  await updateDoc(userRef, {
    ...userData,
    lastLoginAt: serverTimestamp(),
  });

  // Fetch the updated document
  const updatedUserDoc = await getDoc(userRef);
  const updatedUserData = updatedUserDoc.data();

  // Return updated user data
  return {
    ...(updatedUserData as User),
    uid: firebaseUser.uid,
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
  const logoutChannel = new BroadcastChannel('auth_logout');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      try {
        setAuthLoading(true);
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
        setAuthLoading(false);
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
      const userData = await updateUserInFirestore(userCredential.user);
      if (!userData) {
        throw new Error('User not registered');
      }
      setUser(userData);
    } catch (error) {
      console.error('OTP verification error:', error);
      throw error;
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
  
      const userData = await updateUserInFirestore(result.user);
      if (!userData) {
        throw new Error('User not registered. Please register first.');
      }
  
      // Get the token
      const token = await result.user.getIdToken();
  
      return {
        token,
        user: userData
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
    if (!user) return;
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
      toast.error('Failed to update profile. Please try again.');
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      authLoading, 
      loginWithGoogle, 
      loginWithPhone, 
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