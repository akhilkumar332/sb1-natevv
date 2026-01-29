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
  PhoneAuthProvider,
  linkWithCredential,
  linkWithPopup,
  linkWithPhoneNumber,
  unlink,
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
import { generateBhId } from '../utils/bhId';
import { normalizePhoneNumber } from '../utils/phone';
import { findUsersByPhone } from '../utils/userLookup';

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
  phoneNumberNormalized?: string;
  phone?: string;
  createdAt?: Date;
  lastLoginAt?: Date;
  role?: 'donor' | 'ngo' | 'hospital' | 'admin';
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  bhId?: string;
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
  notificationPreferences?: {
    emergencyAlerts?: boolean;
  };
  eligibilityChecklist?: {
    hydrated?: boolean;
    weightOk?: boolean;
    hemoglobinOk?: boolean;
    updatedAt?: Date;
  };
  availableUntil?: Date | null;
  referredByUid?: string;
  referredByBhId?: string;
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
  logout: (navigate: NavigateFunction, options?: { redirectTo?: string; showToast?: boolean }) => Promise<void>;
  updateUserProfile: (data: Partial<User>) => Promise<void>;
  loginLoading: boolean;
  setLoginLoading: (loading: boolean) => void;
  verifyOTP: (confirmationResult: ConfirmationResult, otp: string) => Promise<User>;
  setAuthLoading: (loading: boolean) => void;
  linkGoogleProvider: () => Promise<void>;
  startPhoneLink: (phoneNumber: string) => Promise<ConfirmationResult>;
  confirmPhoneLink: (confirmationResult: ConfirmationResult, otp: string) => Promise<void>;
  unlinkGoogleProvider: () => Promise<void>;
  unlinkPhoneProvider: () => Promise<void>;
}

interface LoginResponse {
  token: string;
  user: User;
}

const AuthContext = createContext<AuthContextType | null>(null);

type PhoneAuthErrorCode = 'not_registered' | 'multiple_accounts' | 'role_mismatch' | 'link_required';

export class PhoneAuthError extends Error {
  code: PhoneAuthErrorCode;

  constructor(message: string, code: PhoneAuthErrorCode) {
    super(message);
    this.name = 'PhoneAuthError';
    this.code = code;
  }
}

const pendingPhoneLinkKey = 'pendingPhoneLink';
const userCacheKey = 'bh_user_cache';
const userCacheAtKey = 'bh_user_cache_at';
const userCacheTtlMs = 24 * 60 * 60 * 1000;

const parseCachedDate = (value?: string | null) => {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const serializeUserForCache = (user: User) => ({
  ...user,
  createdAt: user.createdAt ? user.createdAt.toISOString() : undefined,
  lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : undefined,
  lastDonation: user.lastDonation ? user.lastDonation.toISOString() : undefined,
  dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString() : undefined,
  availableUntil: user.availableUntil ? user.availableUntil.toISOString() : null,
  eligibilityChecklist: user.eligibilityChecklist
    ? {
        ...user.eligibilityChecklist,
        updatedAt: user.eligibilityChecklist.updatedAt
          ? user.eligibilityChecklist.updatedAt.toISOString()
          : undefined,
      }
    : undefined,
});

const hydrateCachedUser = (raw: any): User => ({
  ...raw,
  createdAt: parseCachedDate(raw?.createdAt),
  lastLoginAt: parseCachedDate(raw?.lastLoginAt),
  lastDonation: parseCachedDate(raw?.lastDonation),
  dateOfBirth: parseCachedDate(raw?.dateOfBirth),
  availableUntil: raw?.availableUntil ? parseCachedDate(raw.availableUntil) || null : null,
  eligibilityChecklist: raw?.eligibilityChecklist
    ? {
        ...raw.eligibilityChecklist,
        updatedAt: parseCachedDate(raw.eligibilityChecklist?.updatedAt),
      }
    : undefined,
});

const readCachedUser = (): User | null => {
  if (typeof window === 'undefined') return null;
  try {
    const authToken = localStorage.getItem('authToken');
    if (!authToken) return null;
    const cachedAt = localStorage.getItem(userCacheAtKey);
    if (cachedAt && Date.now() - Number(cachedAt) > userCacheTtlMs) {
      localStorage.removeItem(userCacheKey);
      localStorage.removeItem(userCacheAtKey);
      return null;
    }
    const raw = localStorage.getItem(userCacheKey);
    if (!raw) return null;
    return hydrateCachedUser(JSON.parse(raw));
  } catch {
    return null;
  }
};

const savePendingPhoneLink = (data: {
  verificationId: string;
  otp: string;
  phoneNumber: string;
  targetUid: string;
}) => {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(pendingPhoneLinkKey, JSON.stringify({
    ...data,
    createdAt: Date.now()
  }));
};

const clearPendingPhoneLink = () => {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(pendingPhoneLinkKey);
};

const cleanupRecaptcha = () => {
  const container = document.getElementById('recaptcha-container');
  if (container) {
    container.remove();
  }
  if (window.recaptchaVerifier) {
    try {
      window.recaptchaVerifier.clear();
    } catch (error) {
      console.warn('Error clearing recaptcha:', error);
    }
    window.recaptchaVerifier = undefined;
  }
};

const readPendingPhoneLink = () => {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(pendingPhoneLinkKey);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      verificationId: string;
      otp: string;
      phoneNumber: string;
      targetUid: string;
      createdAt: number;
    };
    if (parsed.createdAt && Date.now() - parsed.createdAt > 10 * 60 * 1000) {
      clearPendingPhoneLink();
      return null;
    }
    return parsed;
  } catch (error) {
    console.warn('Failed to parse pending phone link data:', error);
    return null;
  }
};

// Helper function to convert Firestore timestamp to Date
const convertTimestampToDate = (timestamp: any): Date | undefined => {
  if (!timestamp) return undefined;
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp === 'string') {
    const parsed = new Date(timestamp);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  if (typeof timestamp?.toDate === 'function') return timestamp.toDate();
  if (typeof timestamp?.seconds === 'number') return new Date(timestamp.seconds * 1000);
  return undefined;
};

const normalizeEligibilityChecklist = (checklist: any) => {
  if (!checklist) return undefined;
  const updatedAt = convertTimestampToDate(checklist.updatedAt);
  return {
    hydrated: Boolean(checklist.hydrated),
    weightOk: Boolean(checklist.weightOk),
    hemoglobinOk: Boolean(checklist.hemoglobinOk),
    ...(updatedAt ? { updatedAt } : {}),
  };
};

// Helper function to update user in Firestore
const updateUserInFirestore = async (
  firebaseUser: FirebaseUser,
  additionalData?: Partial<User>
): Promise<User | null> => {
  try {
    const userRef: DocumentReference = doc(db, 'users', firebaseUser.uid);
    const userDoc: DocumentSnapshot = await getDoc(userRef);

    // If user document doesn't exist, return null
    if (!userDoc.exists()) {
      console.warn('User document does not exist for:', firebaseUser.uid);
      return null;
    }

    const existingUserData = userDoc.data() as User;
    const existingDob = convertTimestampToDate(existingUserData?.dateOfBirth);
    const existingBhId = existingUserData?.bhId;
    const generatedBhId = existingBhId
      ? null
      : generateBhId({
          dateOfBirth: existingDob,
          postalCode: existingUserData?.postalCode || undefined,
          uid: firebaseUser.uid
        });

    // Prepare optimized update (lastLoginAt and optional bhId)
    // Use try-catch to handle potential update failures
    try {
      const updatePayload: Record<string, any> = {
        lastLoginAt: serverTimestamp()
      };
      const rawPhone = existingUserData?.phoneNumber
        || (existingUserData as any)?.phone
        || firebaseUser.phoneNumber;
      if (!existingUserData?.phoneNumberNormalized && rawPhone) {
        const normalizedPhone = normalizePhoneNumber(rawPhone);
        if (normalizedPhone) {
          updatePayload.phoneNumberNormalized = normalizedPhone;
        }
      }
      if (!existingBhId && generatedBhId) {
        updatePayload.bhId = generatedBhId;
      }
      await updateDoc(userRef, updatePayload);
    } catch (updateError) {
      console.warn('Failed to update lastLoginAt, continuing anyway:', updateError);
      // Continue even if update fails - not critical
    }

    // Return user data without extra fetch
    return {
      ...existingUserData,
      uid: firebaseUser.uid,
      email: firebaseUser.email || existingUserData.email,
      displayName: firebaseUser.displayName || existingUserData.displayName,
      photoURL: firebaseUser.photoURL || existingUserData.photoURL,
      phoneNumber: firebaseUser.phoneNumber || existingUserData.phoneNumber,
      lastLoginAt: new Date(),
      bhId: existingBhId || generatedBhId || undefined,
      createdAt: convertTimestampToDate(existingUserData?.createdAt),
      dateOfBirth: existingDob,
      lastDonation: convertTimestampToDate(existingUserData?.lastDonation),
      availableUntil: convertTimestampToDate(existingUserData?.availableUntil) || null,
      eligibilityChecklist: normalizeEligibilityChecklist(existingUserData?.eligibilityChecklist),
      ...additionalData
    } as User;
  } catch (error) {
    console.error('Error in updateUserInFirestore:', error);
    throw error;
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initialCachedUser = readCachedUser();
  const [user, setUser] = useState<User | null>(initialCachedUser);
  const [loading, setLoading] = useState(!initialCachedUser);
  const [authLoading, setAuthLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const logoutChannel = new BroadcastChannel('auth_logout');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      try {
        if (firebaseUser) {
          // Check if user is newly created (within last 30 seconds)
          const creationTime = new Date(firebaseUser.metadata.creationTime!).getTime();
          const currentTime = Date.now();
          const isNewUser = (currentTime - creationTime) < 30000; // 30 seconds grace period

          // Add retry logic with delay for new users
          let userData = null;
          let retries = isNewUser ? 5 : 3; // More retries for new users
          let delay = isNewUser ? 1000 : 500; // Longer delay for new users

          while (retries > 0 && !userData) {
            try {
              userData = await updateUserInFirestore(firebaseUser);
              if (userData) break;

              // If document doesn't exist and user is NEW, wait for registration to complete
              if (isNewUser && !userData) {
                console.log(`⏳ New user detected, waiting for registration (${retries} retries left)...`);
                retries--;
                if (retries > 0) {
                  await new Promise(resolve => setTimeout(resolve, delay));
                }
              } else {
                // For existing users, don't retry
                break;
              }
            } catch (error) {
              console.warn(`Attempt ${(isNewUser ? 5 : 3) - retries + 1} failed, retrying...`, error);
              retries--;
              if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, delay));
              }
            }
          }

          const isRegistrationRoute =
            typeof window !== 'undefined' &&
            (window.location.pathname.includes('/register') ||
              window.location.pathname.includes('/onboarding'));

          if (userData) {
            setUser(userData);
          } else {
            // Only keep new users signed in during registration/onboarding flows
            if (!isNewUser || !isRegistrationRoute) {
              console.warn('User document not found, signing out');
              await signOut(auth);
              setUser(null);
            } else {
              console.log('⏳ New user registration in progress, keeping user signed in...');
              // Set a temporary user object so UI doesn't flicker
              setUser({
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName,
                photoURL: firebaseUser.photoURL,
                phoneNumber: firebaseUser.phoneNumber,
              } as User);
            }
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const authToken = localStorage.getItem('authToken');
      if (!authToken || !user) {
        localStorage.removeItem(userCacheKey);
        localStorage.removeItem(userCacheAtKey);
        return;
      }
      localStorage.setItem(userCacheKey, JSON.stringify(serializeUserForCache(user)));
      localStorage.setItem(userCacheAtKey, Date.now().toString());
    } catch (error) {
      console.warn('Failed to update user cache:', error);
    }
  }, [user]);

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
      cleanupRecaptcha();
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
      cleanupRecaptcha();

      const normalizedPhone = normalizePhoneNumber(userCredential.user.phoneNumber || '');
      const userRef = doc(db, 'users', userCredential.user.uid);

      // Fetch user data first
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        const matches = await findUsersByPhone(normalizedPhone);

        if (matches.length === 0) {
          await signOut(auth);
          throw new PhoneAuthError('User not registered', 'not_registered');
        }

        if (matches.length > 1) {
          await signOut(auth);
          throw new PhoneAuthError('Phone number linked to multiple accounts', 'multiple_accounts');
        }

        const matchedUser = matches[0];
        const matchedUid = matchedUser.uid || matchedUser.id;

        if (matchedUser.role && matchedUser.role !== 'donor') {
          await signOut(auth);
          throw new PhoneAuthError("You're not a Donor", 'role_mismatch');
        }

        if (matchedUid && matchedUid !== userCredential.user.uid) {
          if (confirmationResult.verificationId) {
            savePendingPhoneLink({
              verificationId: confirmationResult.verificationId,
              otp,
              phoneNumber: normalizedPhone,
              targetUid: matchedUid
            });
          }

          try {
            await userCredential.user.delete();
          } catch (deleteError) {
            console.warn('Failed to delete temporary phone user:', deleteError);
          }

          await signOut(auth);
          throw new PhoneAuthError(
            'Phone number already registered. Please sign in with Google to link.',
            'link_required'
          );
        }

        await signOut(auth);
        throw new PhoneAuthError('User not registered', 'not_registered');
      }

      const userData = userDoc.data() as User;
      const existingDob = convertTimestampToDate(userData?.dateOfBirth);
      const existingBhId = userData?.bhId;
      const generatedBhId = existingBhId
        ? null
        : generateBhId({
            dateOfBirth: existingDob,
            postalCode: userData?.postalCode || undefined,
            uid: userCredential.user.uid
          });

      // Update last login and optional bhId in background (don't wait)
      const updatePayload: Record<string, any> = { lastLoginAt: serverTimestamp() };
      const rawPhone = userData?.phoneNumber
        || (userData as any)?.phone
        || userCredential.user.phoneNumber;
      if (!userData?.phoneNumberNormalized && rawPhone) {
        const normalizedPhone = normalizePhoneNumber(rawPhone);
        if (normalizedPhone) {
          updatePayload.phoneNumberNormalized = normalizedPhone;
        }
      }
      if (!existingBhId && generatedBhId) {
        updatePayload.bhId = generatedBhId;
      }
      updateDoc(userRef, updatePayload).catch(err =>
        console.error('Failed to update lastLoginAt:', err)
      );

      // Prepare user data
      const userDataToReturn = {
        ...userData,
        uid: userCredential.user.uid,
        lastLoginAt: new Date(),
        createdAt: convertTimestampToDate(userData?.createdAt),
        dateOfBirth: existingDob,
        lastDonation: convertTimestampToDate(userData?.lastDonation),
        bhId: existingBhId || generatedBhId || undefined,
        availableUntil: convertTimestampToDate(userData?.availableUntil) || null,
        eligibilityChecklist: normalizeEligibilityChecklist(userData?.eligibilityChecklist),
      } as User;

      // Update user state immediately for navigation
      setUser(userDataToReturn);

      // Return user data for immediate navigation
      return userDataToReturn;
    } catch (error) {
      console.error('OTP verification error:', error);

      // Clean up reCAPTCHA on error too
      cleanupRecaptcha();

      throw error;
    }
  };

  const linkGoogleProvider = async (): Promise<void> => {
    if (!auth.currentUser) {
      throw new Error('No user logged in');
    }

    auth.useDeviceLanguage();

    try {
      await linkWithPopup(auth.currentUser, googleProvider);
    } catch (error: any) {
      if (error?.code === 'auth/popup-closed-by-user') {
        throw new Error('Sign-in popup was closed before completing the sign-in process.');
      }
      if (error?.code === 'auth/popup-blocked') {
        throw new Error('Sign-in popup was blocked by the browser. Please allow popups for this site.');
      }
      if (error?.code === 'auth/credential-already-in-use') {
        throw new Error('Google account is already linked to another user.');
      }
      if (error?.code === 'auth/provider-already-linked') {
        return;
      }
      throw error;
    }
  };

  const startPhoneLink = async (phoneNumber: string): Promise<ConfirmationResult> => {
    if (!auth.currentUser) {
      throw new Error('No user logged in');
    }

    if (window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier.clear();
      } catch (e) {
        console.warn('Error clearing recaptcha:', e);
      }
      window.recaptchaVerifier = undefined;
    }

    const existingContainer = document.getElementById('recaptcha-container');
    if (existingContainer) {
      existingContainer.remove();
    }

    const container = document.createElement('div');
    container.id = 'recaptcha-container';
    document.body.appendChild(container);

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

    try {
      const confirmation = await linkWithPhoneNumber(auth.currentUser, phoneNumber, recaptchaVerifier);
      return confirmation;
    } catch (error) {
      cleanupRecaptcha();
      throw error;
    }
  };

  const confirmPhoneLink = async (
    confirmationResult: ConfirmationResult,
    otp: string
  ): Promise<void> => {
    if (!auth.currentUser) {
      throw new Error('No user logged in');
    }

    try {
      const userCredential = await confirmationResult.confirm(otp);
      cleanupRecaptcha();

      const phoneNumber = userCredential.user.phoneNumber || auth.currentUser.phoneNumber || '';
      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      const updatePayload: Record<string, any> = {};
      if (phoneNumber) {
        updatePayload.phoneNumber = phoneNumber;
      }
      if (normalizedPhone) {
        updatePayload.phoneNumberNormalized = normalizedPhone;
      }

      if (Object.keys(updatePayload).length > 0) {
        await updateDoc(doc(db, 'users', auth.currentUser.uid), updatePayload);
        setUser(prev => prev ? {
          ...prev,
          phoneNumber: updatePayload.phoneNumber || prev.phoneNumber,
          phoneNumberNormalized: updatePayload.phoneNumberNormalized || prev.phoneNumberNormalized
        } : prev);
      }
    } catch (error) {
      cleanupRecaptcha();
      throw error;
    }
  };

  const ensureAnotherProvider = () => {
    const providers = auth.currentUser?.providerData?.map(provider => provider.providerId) || [];
    if (providers.length <= 1) {
      throw new Error('You must keep at least one login method linked.');
    }
  };

  const unlinkGoogleProvider = async (): Promise<void> => {
    if (!auth.currentUser) {
      throw new Error('No user logged in');
    }
    ensureAnotherProvider();
    await unlink(auth.currentUser, 'google.com');
  };

  const unlinkPhoneProvider = async (): Promise<void> => {
    if (!auth.currentUser) {
      throw new Error('No user logged in');
    }
    ensureAnotherProvider();
    await unlink(auth.currentUser, 'phone');
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

      const userDocData = userDoc.data() as User;
      const existingDob = convertTimestampToDate(userDocData?.dateOfBirth);
      const existingBhId = userDocData?.bhId;
      const generatedBhId = existingBhId
        ? null
        : generateBhId({
            dateOfBirth: existingDob,
            postalCode: userDocData?.postalCode || undefined,
            uid: result.user.uid
          });

      const userDataToReturn = {
        ...userDocData,
        uid: result.user.uid,
        createdAt: convertTimestampToDate(userDocData?.createdAt),
        dateOfBirth: existingDob,
        lastLoginAt: new Date(),
        lastDonation: convertTimestampToDate(userDocData?.lastDonation),
        bhId: existingBhId || generatedBhId || undefined,
        availableUntil: convertTimestampToDate(userDocData?.availableUntil) || null,
        eligibilityChecklist: normalizeEligibilityChecklist(userDocData?.eligibilityChecklist),
      } as User;

      // Update last login time and optional bhId in background
      const updatePayload: Record<string, any> = { lastLoginAt: serverTimestamp() };
      const rawPhone = userDocData?.phoneNumber
        || (userDocData as any)?.phone
        || result.user.phoneNumber;
      if (!userDocData?.phoneNumberNormalized && rawPhone) {
        const normalizedPhone = normalizePhoneNumber(rawPhone);
        if (normalizedPhone) {
          updatePayload.phoneNumberNormalized = normalizedPhone;
        }
      }
      if (!existingBhId && generatedBhId) {
        updatePayload.bhId = generatedBhId;
      }
      updateDoc(userRef, updatePayload).catch(err =>
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

      const pendingLink = readPendingPhoneLink();
      if (pendingLink) {
        if (pendingLink.targetUid && pendingLink.targetUid !== result.user.uid) {
          await signOut(auth);
          throw new Error('Please sign in with the account linked to this phone number.');
        }

        try {
          const credential = PhoneAuthProvider.credential(
            pendingLink.verificationId,
            pendingLink.otp
          );
          await linkWithCredential(result.user, credential);
          clearPendingPhoneLink();
        } catch (linkError: any) {
          console.error('Phone link error:', linkError);
          if (linkError?.code === 'auth/provider-already-linked') {
            clearPendingPhoneLink();
          } else if (linkError?.code === 'auth/credential-already-in-use') {
            clearPendingPhoneLink();
            throw new Error('Phone number is already linked to another account. Please contact support.');
          } else if (linkError?.code === 'auth/invalid-verification-code') {
            clearPendingPhoneLink();
            throw new Error('Verification code expired. Please retry phone login.');
          } else {
            throw linkError;
          }
        }
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

      const userDocData = userDoc.data() as User;
      const existingDob = convertTimestampToDate(userDocData?.dateOfBirth);
      const existingBhId = userDocData?.bhId;
      const generatedBhId = existingBhId
        ? null
        : generateBhId({
            dateOfBirth: existingDob,
            postalCode: userDocData?.postalCode || undefined,
            uid: result.user.uid
          });

      const userDataToReturn = {
        ...userDocData,
        uid: result.user.uid,
        createdAt: convertTimestampToDate(userDocData?.createdAt),
        dateOfBirth: existingDob,
        lastLoginAt: new Date(),
        lastDonation: convertTimestampToDate(userDocData?.lastDonation),
        bhId: existingBhId || generatedBhId || undefined,
        availableUntil: convertTimestampToDate(userDocData?.availableUntil) || null,
        eligibilityChecklist: normalizeEligibilityChecklist(userDocData?.eligibilityChecklist),
      } as User;

      const updatePayload: Record<string, any> = { lastLoginAt: serverTimestamp() };
      const rawPhone = userDocData?.phoneNumber
        || (userDocData as any)?.phone
        || result.user.phoneNumber;
      if (!userDocData?.phoneNumberNormalized && rawPhone) {
        const normalizedPhone = normalizePhoneNumber(rawPhone);
        if (normalizedPhone) {
          updatePayload.phoneNumberNormalized = normalizedPhone;
        }
      }
      if (!existingBhId && generatedBhId) {
        updatePayload.bhId = generatedBhId;
      }
      updateDoc(userRef, updatePayload).catch(err =>
        console.error('Failed to update lastLoginAt:', err)
      );

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
      localStorage.removeItem(userCacheKey);
      localStorage.removeItem(userCacheAtKey);
      
      // Optional: Clear any cached data
      indexedDB.deleteDatabase('firebaseLocalStorageDb');
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  const logout = async (
    navigate: NavigateFunction,
    options: { redirectTo?: string; showToast?: boolean } = {}
  ) => {
    const { redirectTo = '/donor/login', showToast = true } = options;
    try {
      await handleLogout();
      
      // Broadcast logout event to other tabs
      logoutChannel.postMessage('logout');
      
      if (showToast) {
        toast.success('Successfully logged out!');
      }
      if (redirectTo) {
        navigate(redirectTo);
      }
    } catch (error) {
      console.error('Logout error:', error);
      if (showToast) {
        toast.error('Failed to log out. Please try again.');
      }
    }
  };

  // Update updateUserProfile method to handle onboarding
  const updateUserProfile = async (data: Partial<User>): Promise<void> => {
    if (!user) {
      throw new Error('No user logged in');
    }
    console.log('Updating user profile with:', data);
    try {
      const nextDateOfBirth = data.dateOfBirth ?? user.dateOfBirth;
      const nextPostalCode = data.postalCode ?? user.postalCode;
      const existingBhId = user.bhId;
      const generatedBhId = existingBhId
        ? null
        : generateBhId({
            dateOfBirth: nextDateOfBirth,
            postalCode: nextPostalCode || undefined,
            uid: user.uid
          });

      const phoneNumberNormalized = data.phoneNumber
        ? normalizePhoneNumber(data.phoneNumber)
        : undefined;

      await setDoc(
        doc(db, 'users', user.uid),
        {
          ...data,
          ...(phoneNumberNormalized ? { phoneNumberNormalized } : {}),
          onboardingCompleted: true, // Set this to true upon successful completion
          ...(existingBhId ? {} : generatedBhId ? { bhId: generatedBhId } : {})
        },
        { merge: true }
      );
      setUser(prev => ({
        ...prev,
        ...data,
        ...(phoneNumberNormalized ? { phoneNumberNormalized } : {}),
        onboardingCompleted: true, // Ensure this is updated in the state
        bhId: prev?.bhId || generatedBhId || undefined
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
      setAuthLoading,
      linkGoogleProvider,
      startPhoneLink,
      confirmPhoneLink,
      unlinkGoogleProvider,
      unlinkPhoneProvider
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
