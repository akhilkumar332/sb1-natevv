// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
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
  signInWithCustomToken,
  sendPasswordResetEmail,
  updateProfile,
  sendEmailVerification,
  PhoneAuthProvider,
  linkWithCredential,
  linkWithPopup,
  linkWithPhoneNumber,
  updateEmail,
  updatePhoneNumber,
  unlink,
} from 'firebase/auth';
import { 
  doc,
  setDoc, 
  getDoc, 
  getDocFromServer,
  updateDoc, 
  serverTimestamp, 
  DocumentReference,
  DocumentSnapshot,
  disableNetwork,
  enableNetwork
} from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';
import { getMessaging } from 'firebase/messaging';
import { initializeFCM, saveFCMDeviceToken, saveFCMToken } from '../services/notification.service';
import { requestImpersonation, requestImpersonationResume } from '../services/impersonation.service';
import { flushQueuedErrorLogs } from '../services/errorLog.service';
import { generateBhId } from '../utils/bhId';
import { getDeviceId, getDeviceInfo } from '../utils/device';
import { normalizePhoneNumber } from '../utils/phone';
import { findUsersByPhone } from '../utils/userLookup';
import { applyReferralTrackingForUser, ensureReferralTrackingForExistingReferral } from '../services/referral.service';
import { logAuditEvent } from '../services/audit.service';
import { clearReferralTracking, getReferralReferrerUid, getReferralTracking } from '../utils/referralTracking';
import { buildPublicDonorPayload } from '../utils/publicDonor';
import { PhoneAuthError } from '../errors/PhoneAuthError';
import { authStorage } from '../utils/authStorage';
import { readFcmTokenMeta, readStoredFcmToken, writeFcmTokenMeta, writeStoredFcmToken } from '../utils/fcmStorage';

const trackImpersonationEvent = (eventName: string, params?: Record<string, any>) => {
  void import('../services/monitoring.service')
    .then(({ monitoringService }) => {
      monitoringService.trackEvent(eventName, params);
    })
    .catch(() => {
      // ignore analytics failures
    });
};

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
  role?: 'donor' | 'ngo' | 'bloodbank' | 'hospital' | 'admin' | 'superadmin';
  status?: 'active' | 'inactive' | 'suspended' | 'pending_verification' | 'deleted';
  verified?: boolean;
  breakGlass?: boolean;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  bhId?: string;
  country?: string;
  bloodType?: string;
  latitude?: number;
  longitude?: number;
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
  donorLevel?: string;
  badges?: string[];
  preferredLanguage?: string;
  howHeardAboutUs?: string;
  interestedInVolunteering?: boolean;
  fcmTokens?: string[];
  organizationName?: string;
  registrationNumber?: string;
  ngoType?: string;
  bloodBankName?: string;
  bloodBankType?: string;
  hospitalName?: string;
  hospitalType?: string;
  licenseNumber?: string;
  contactPerson?: string;
  operatingHours?: string;
  facilities?: string[];
  staffRole?: 'viewer' | 'editor' | 'manager';
  parentHospitalId?: string;
  branchId?: string;
  contactPersonName?: string;
  website?: string;
  yearEstablished?: string;
  description?: string;
  privacyPolicyAgreed?: boolean;
  termsOfServiceAgreed?: boolean;
  emailVerified?: boolean;
  donorCardShareOptions?: {
    showPhone: boolean;
    showEmail: boolean;
    showBhId: boolean;
    showQr: boolean;
  };
  notificationPreferences?: {
    push?: boolean;
    email?: boolean;
    sms?: boolean;
    emergencyAlerts?: boolean;
  };
  eligibilityChecklist?: {
    hydrated?: boolean;
    weightOk?: boolean;
    hemoglobinOk?: boolean;
    rested?: boolean;
    ateMeal?: boolean;
    updatedAt?: Date;
  };
  availableUntil?: Date | null;
  referredByUid?: string;
  referredByBhId?: string;
  donorRequestTemplate?: {
    donationType: 'whole' | 'plasma' | 'platelets';
    message?: string;
  };
  findDonorsCompactMode?: boolean;
}

const normalizeUserDate = (value?: any): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
  return null;
};

type PortalRole = 'donor' | 'ngo' | 'bloodbank' | 'admin';

type ImpersonationTarget = {
  uid: string;
  role?: User['role'] | null;
  email?: string | null;
  displayName?: string | null;
  status?: User['status'] | null;
};

type ImpersonationSession = {
  actorUid: string;
  targetUid: string;
  targetRole?: User['role'] | null;
  targetEmail?: string | null;
  targetDisplayName?: string | null;
  impersonationId?: string | null;
  reason?: string | null;
  basePortalRole: PortalRole | null;
  startedAt: number;
  expiresAt?: number;
  status?: 'starting' | 'active' | 'stopping';
};

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
  startPhoneUpdate: (phoneNumber: string) => Promise<ConfirmationResult>;
  confirmPhoneUpdate: (confirmationResult: ConfirmationResult, otp: string, phoneNumber: string) => Promise<void>;
  updateEmailAddress: (email: string) => Promise<void>;
  unlinkGoogleProvider: () => Promise<void>;
  unlinkPhoneProvider: () => Promise<void>;
  portalRole: PortalRole | null;
  setPortalRole: (role: PortalRole | null) => void;
  effectiveRole: User['role'] | null;
  isSuperAdmin: boolean;
  impersonationSession: ImpersonationSession | null;
  isImpersonating: boolean;
  impersonationTransition: 'starting' | 'stopping' | null;
  startImpersonation: (
    target: Pick<User, 'uid'> | User,
    options?: { reason?: string }
  ) => Promise<ImpersonationTarget | null>;
  stopImpersonation: () => Promise<void>;
  profileResolved: boolean;
}

interface LoginResponse {
  token: string;
  user: User;
}

const AuthContext = createContext<AuthContextType | null>(null);

const pendingPhoneLinkKey = 'pendingPhoneLink';
const portalRoleStorageKey = 'bh_superadmin_portal_role';
const impersonationStorageKey = 'bh_superadmin_impersonation';
const userCacheKey = 'bh_user_cache';
const userCacheAtKey = 'bh_user_cache_at';
const userCacheTtlMs = 24 * 60 * 60 * 1000;
const IMPERSONATION_TTL_MS = 30 * 60 * 1000;

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
  donorCardShareOptions: user.donorCardShareOptions ? { ...user.donorCardShareOptions } : undefined,
  eligibilityChecklist: user.eligibilityChecklist
    ? {
        ...user.eligibilityChecklist,
        updatedAt: user.eligibilityChecklist.updatedAt
          ? user.eligibilityChecklist.updatedAt.toISOString()
          : undefined,
      }
    : undefined,
});

const isPortalRole = (value?: string | null): value is PortalRole => (
  value === 'donor' || value === 'ngo' || value === 'bloodbank' || value === 'admin'
);

const readPortalRole = (): PortalRole | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(portalRoleStorageKey);
    return isPortalRole(raw) ? raw : null;
  } catch {
    return null;
  }
};

const hydrateCachedUser = (raw: any): User => ({
  ...raw,
  createdAt: parseCachedDate(raw?.createdAt),
  lastLoginAt: parseCachedDate(raw?.lastLoginAt),
  lastDonation: parseCachedDate(raw?.lastDonation),
  dateOfBirth: parseCachedDate(raw?.dateOfBirth),
  availableUntil: raw?.availableUntil ? parseCachedDate(raw.availableUntil) || null : null,
  donorCardShareOptions: raw?.donorCardShareOptions ? { ...raw.donorCardShareOptions } : undefined,
  eligibilityChecklist: raw?.eligibilityChecklist
    ? {
        ...raw.eligibilityChecklist,
        updatedAt: parseCachedDate(raw.eligibilityChecklist?.updatedAt),
      }
    : undefined,
});

const readImpersonationSession = (): ImpersonationSession | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(impersonationStorageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ImpersonationSession;
    if (!parsed?.actorUid || !parsed?.targetUid) {
      return null;
    }
    const status = parsed.status === 'starting' || parsed.status === 'stopping'
      ? parsed.status
      : 'active';
    const startedAt = typeof parsed.startedAt === 'number' ? parsed.startedAt : Date.now();
    const expiresAt = typeof parsed.expiresAt === 'number'
      ? parsed.expiresAt
      : startedAt + IMPERSONATION_TTL_MS;
    if (Date.now() >= expiresAt) {
      try {
        sessionStorage.removeItem(impersonationStorageKey);
      } catch {
        // ignore storage errors
      }
      return null;
    }
    return {
      ...parsed,
      status,
      basePortalRole: isPortalRole(parsed.basePortalRole) ? parsed.basePortalRole : null,
      startedAt,
      expiresAt,
    };
  } catch {
    return null;
  }
};

const persistImpersonationSession = (session: ImpersonationSession | null) => {
  if (typeof window === 'undefined') return;
  try {
    if (session) {
      const raw = JSON.stringify(session);
      sessionStorage.setItem(impersonationStorageKey, raw);
    } else {
      sessionStorage.removeItem(impersonationStorageKey);
    }
  } catch {
    try {
      if (session) {
        sessionStorage.setItem(impersonationStorageKey, JSON.stringify(session));
      } else {
        sessionStorage.removeItem(impersonationStorageKey);
      }
    } catch {
      // ignore storage errors
    }
  }
};

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
    rested: Boolean(checklist.rested),
    ateMeal: Boolean(checklist.ateMeal),
    ...(updatedAt ? { updatedAt } : {}),
  };
};

// Helper function to update user in Firestore
type UserFetchResult = {
  user: User | null;
  missing: boolean;
};

const getUserDocSnapshot = async (userRef: DocumentReference): Promise<DocumentSnapshot> => {
  try {
    return await getDocFromServer(userRef);
  } catch (error: any) {
    if (error?.code === 'permission-denied') {
      throw error;
    }
    return await getDoc(userRef);
  }
};

const updateUserInFirestore = async (
  firebaseUser: FirebaseUser,
  additionalData?: Partial<User>
): Promise<UserFetchResult> => {
  try {
    const userRef: DocumentReference = doc(db, 'users', firebaseUser.uid);
    const userDoc: DocumentSnapshot = await getUserDocSnapshot(userRef);

    // If user document doesn't exist, return null
    if (!userDoc.exists()) {
      console.warn('User document does not exist for:', firebaseUser.uid);
      return { user: null, missing: true };
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

    const resolvedUser = {
      ...existingUserData,
      uid: firebaseUser.uid,
      email: firebaseUser.email || existingUserData.email,
      emailVerified: firebaseUser.emailVerified,
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

    const publishStatus = resolvedUser.status;
    const canPublishPublicDonor = resolvedUser.role === 'donor'
      && resolvedUser.onboardingCompleted === true
      && (!publishStatus || publishStatus === 'active');

    if (canPublishPublicDonor) {
      try {
        await setDoc(
          doc(db, 'publicDonors', firebaseUser.uid),
          {
            ...buildPublicDonorPayload(resolvedUser),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (publicError) {
        console.warn('Failed to sync public donor record:', publicError);
      }
    }

    return { user: resolvedUser, missing: false };
  } catch (error) {
    console.error('Error in updateUserInFirestore:', error);
    throw error;
  }
};

const updateSessionMetadata = async (firebaseUser: FirebaseUser, knownUser?: User) => {
  try {
    const userRef = doc(db, 'users', firebaseUser.uid);
    const updatePayload: Record<string, any> = { lastLoginAt: serverTimestamp() };
    const rawPhone = knownUser?.phoneNumber
      || (knownUser as any)?.phone
      || firebaseUser.phoneNumber;
    if (!knownUser?.phoneNumberNormalized && rawPhone) {
      const normalizedPhone = normalizePhoneNumber(rawPhone);
      if (normalizedPhone) {
        updatePayload.phoneNumberNormalized = normalizedPhone;
      }
    }
    if (!knownUser?.bhId && knownUser?.dateOfBirth && knownUser?.postalCode) {
      const generatedBhId = generateBhId({
        dateOfBirth: knownUser.dateOfBirth,
        postalCode: knownUser.postalCode,
        uid: firebaseUser.uid,
      });
      if (generatedBhId) {
        updatePayload.bhId = generatedBhId;
      }
    }
    await updateDoc(userRef, updatePayload);
  } catch (error) {
    console.warn('Failed to update session metadata:', error);
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initialCachedUser = readCachedUser();
  const [user, setUser] = useState<User | null>(initialCachedUser);
  const [loading, setLoading] = useState(!initialCachedUser);
  const [authLoading, setAuthLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [portalRoleState, setPortalRoleState] = useState<PortalRole | null>(readPortalRole);
  const [impersonationSession, setImpersonationSession] = useState<ImpersonationSession | null>(
    readImpersonationSession
  );
  const [impersonationTransition, setImpersonationTransition] = useState<'starting' | 'stopping' | null>(null);
  const [profileResolved, setProfileResolved] = useState(!initialCachedUser);
  const logoutChannel = new BroadcastChannel('auth_logout');
  const referralApplyAttemptedRef = useRef(false);
  const recentLoginRef = useRef<{ uid: string; at: number; user?: User } | null>(null);
  const userRef = useRef<User | null>(initialCachedUser);
  const publicDonorSyncRef = useRef<string | null>(null);
  const profileRetryTimeoutRef = useRef<number | null>(null);
  const pushInitRef = useRef<string | null>(null);
  const impersonationChannelRef = useRef<BroadcastChannel | null>(null);
  const impersonationSessionRef = useRef<ImpersonationSession | null>(impersonationSession);
  const firestoreNetworkDisabledRef = useRef(false);
  const updateImpersonationSession = useCallback((session: ImpersonationSession | null) => {
    setImpersonationSession(session);
    persistImpersonationSession(session);
  }, []);

  const logProfileIssue = (label: string, error: unknown, context?: Record<string, unknown>) => {
    const err = error as any;
    console.warn(`[auth] ${label}`, {
      code: err?.code,
      name: err?.name,
      message: err?.message,
      online: typeof navigator !== 'undefined' ? navigator.onLine : undefined,
      ...context,
    });
  };

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    impersonationSessionRef.current = impersonationSession;
  }, [impersonationSession]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    const channel = new BroadcastChannel('bh_impersonation_sync');
    impersonationChannelRef.current = channel;
    channel.onmessage = (event) => {
      const data = event?.data as
        | { type: 'start'; session: ImpersonationSession }
        | { type: 'stop'; actorUid: string; targetUid: string; impersonationId?: string | null }
        | null;
      if (!data) return;

      if (data.type === 'start' && data.session) {
        const session = data.session;
        const currentUid = userRef.current?.uid;
        if (!currentUid) return;
        if (currentUid !== session.actorUid && currentUid !== session.targetUid) return;
        updateImpersonationSession({
          ...session,
          status: session.status === 'starting' || session.status === 'stopping' ? session.status : 'starting',
          expiresAt: typeof session.expiresAt === 'number'
            ? session.expiresAt
            : (session.startedAt || Date.now()) + IMPERSONATION_TTL_MS,
        });
        if (session.status === 'starting') {
          setImpersonationTransition('starting');
        }
      }

      if (data.type === 'stop') {
        const session = impersonationSessionRef.current;
        if (!session) return;
        if (session.actorUid !== data.actorUid || session.targetUid !== data.targetUid) return;
        updateImpersonationSession(null);
        setImpersonationTransition(null);
      }
    };

    return () => {
      channel.close();
      impersonationChannelRef.current = null;
    };
  }, [updateImpersonationSession]);

  const setPortalRole = (role: PortalRole | null) => {
    const previousRole = portalRoleState;
    setPortalRoleState(role);
    if (typeof window !== 'undefined') {
      try {
        if (role) {
          sessionStorage.setItem(portalRoleStorageKey, role);
        } else {
          sessionStorage.removeItem(portalRoleStorageKey);
        }
      } catch {
        // ignore storage errors
      }
    }

    const currentUser = userRef.current;
    if (currentUser?.uid && currentUser.role === 'superadmin' && previousRole !== role) {
      void logAuditEvent({
        actorUid: currentUser.uid,
        actorRole: currentUser.role,
        action: role ? 'portal_switch' : 'portal_clear',
        metadata: {
          from: previousRole ?? null,
          to: role ?? null,
          path: typeof window !== 'undefined' ? window.location.pathname : undefined,
        },
      });
    }
  };

  const startImpersonation = async (
    target: Pick<User, 'uid'> | User,
    options?: { reason?: string }
  ): Promise<ImpersonationTarget | null> => {
    const actor = userRef.current;
    setImpersonationTransition('starting');
    if (!actor || actor.role !== 'superadmin') {
      toast.error('Only superadmins can impersonate users.');
      trackImpersonationEvent('impersonation_denied', {
        reason: 'not_superadmin',
      });
      setImpersonationTransition(null);
      return null;
    }

    const targetUid = target?.uid;
    if (!targetUid) {
      toast.error('Unable to resolve the selected user.');
      trackImpersonationEvent('impersonation_denied', {
        reason: 'missing_target_uid',
      });
      setImpersonationTransition(null);
      return null;
    }

    try {
      const response = await requestImpersonation(targetUid, {
        ...(options?.reason ? { reason: options.reason } : {}),
      });
      const targetUser = response?.targetUser;
      if (!response?.targetToken || !targetUser?.uid) {
        toast.error('Impersonation failed. Please try again.');
        trackImpersonationEvent('impersonation_failed', {
          reason: 'missing_token',
          targetUid,
        });
        return null;
      }

      const startedAt = Date.now();
      const session: ImpersonationSession = {
        actorUid: actor.uid,
        targetUid: targetUser.uid,
        targetRole: targetUser.role ?? null,
        targetEmail: targetUser.email ?? null,
        targetDisplayName: targetUser.displayName ?? null,
        impersonationId: response.impersonationId ?? null,
        reason: options?.reason?.trim() || null,
        basePortalRole: portalRoleState ?? null,
        startedAt,
        expiresAt: startedAt + IMPERSONATION_TTL_MS,
        status: 'starting',
      };
      updateImpersonationSession(session);
      impersonationChannelRef.current?.postMessage({ type: 'start', session });

      await signInWithCustomToken(auth, response.targetToken);
      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (idToken) {
          authStorage.setAuthToken(idToken);
        }
      } catch {
        // ignore token refresh errors
      }

      trackImpersonationEvent('impersonation_start', {
        actorUid: actor.uid,
        actorRole: actor.role || 'superadmin',
        targetUid: targetUser.uid,
        targetRole: targetUser.role ?? null,
        impersonationId: response.impersonationId ?? null,
        reason: options?.reason?.trim() || null,
      });

      return targetUser;
    } catch (error: any) {
      console.error('Failed to start impersonation:', error);
      toast.error(error?.message || 'Failed to start impersonation.');
      updateImpersonationSession(null);
      setImpersonationTransition(null);
      trackImpersonationEvent('impersonation_failed', {
        reason: 'exception',
        targetUid,
      });
      return null;
    }
  };

  const stopImpersonation = async () => {
    const session = impersonationSession;
    if (!session?.actorUid || !session?.targetUid) return;
    setImpersonationTransition('stopping');

    const attemptResume = async (resumeToken: string) => {
      await signInWithCustomToken(auth, resumeToken);
      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (idToken) {
          authStorage.setAuthToken(idToken);
        }
      } catch {
        // ignore token refresh errors
      }
    };

    const stoppingSession: ImpersonationSession = {
      ...session,
      status: 'stopping',
    };
    updateImpersonationSession(stoppingSession);

    try {
      const refreshed = await requestImpersonationResume({
        ...(session.impersonationId ? { impersonationId: session.impersonationId } : {}),
      });
      if (!refreshed?.resumeToken) {
        throw new Error('Missing resume token.');
      }
      await attemptResume(refreshed.resumeToken);
    } catch (error) {
      console.error('Failed to resume admin session:', error);
      toast.error('Failed to resume admin session.');
      trackImpersonationEvent('impersonation_failed', {
        reason: 'resume_failed',
        actorUid: session.actorUid,
        targetUid: session.targetUid,
      });
      updateImpersonationSession({ ...session, status: 'active' });
      setImpersonationTransition(null);
      return;
    }

    trackImpersonationEvent('impersonation_stop', {
      actorUid: session.actorUid,
      targetUid: session.targetUid,
      targetRole: session.targetRole ?? null,
      impersonationId: session.impersonationId ?? null,
    });
    impersonationChannelRef.current?.postMessage({
      type: 'stop',
      actorUid: session.actorUid,
      targetUid: session.targetUid,
      impersonationId: session.impersonationId ?? null,
    });
  };

  useEffect(() => {
    if (!user?.uid) {
      if (portalRoleState !== null) {
        setPortalRole(null);
      }
      return;
    }
    if (impersonationSession) {
      return;
    }
    if (user.role && user.role !== 'superadmin' && portalRoleState !== null) {
      setPortalRole(null);
    }
  }, [impersonationSession, portalRoleState, user?.role, user?.uid]);

  useEffect(() => {
    if (!impersonationTransition) return;
    if (impersonationTransition === 'starting') {
      if (impersonationSession && user?.uid === impersonationSession.targetUid) {
        setImpersonationTransition(null);
      }
      return;
    }
    if (impersonationTransition === 'stopping') {
      if (!impersonationSession && user?.uid) {
        setImpersonationTransition(null);
      }
    }
  }, [impersonationSession, impersonationTransition, user?.uid]);

  useEffect(() => {
    if (!impersonationSession) return;
    if (!user?.uid) {
      updateImpersonationSession(null);
      return;
    }

    if (user.uid === impersonationSession.targetUid) {
      if (impersonationSession.status === 'starting') {
        updateImpersonationSession({
          ...impersonationSession,
          status: 'active',
        });
      }
      return;
    }

    if (user.uid === impersonationSession.actorUid) {
      if (impersonationSession.status === 'starting') {
        return;
      }
      setPortalRole(impersonationSession.basePortalRole ?? null);
      updateImpersonationSession(null);
      return;
    }

    updateImpersonationSession(null);
  }, [impersonationSession, user?.uid, updateImpersonationSession, stopImpersonation]);

  useEffect(() => {
    if (!impersonationSession || !user?.uid) return;
    if (user.uid !== impersonationSession.actorUid) return;
    if (impersonationSession.status !== 'starting') return;

    const thresholdMs = 15000;
    const elapsed = Date.now() - impersonationSession.startedAt;
    if (elapsed >= thresholdMs) {
      updateImpersonationSession(null);
      setImpersonationTransition(null);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const latest = readImpersonationSession();
      if (!latest || latest.status !== 'starting') return;
      if (userRef.current?.uid !== latest.actorUid) return;
      updateImpersonationSession(null);
      setImpersonationTransition(null);
    }, thresholdMs - elapsed);

    return () => window.clearTimeout(timeoutId);
  }, [impersonationSession, user?.uid, updateImpersonationSession]);

  useEffect(() => {
    if (!impersonationSession || !user?.uid) return;
    if (user.uid !== impersonationSession.targetUid) return;
    if (impersonationSession.status === 'starting') return;

    let isActive = true;
    auth.currentUser?.getIdTokenResult()
      .then((result) => {
        if (!isActive) return;
        const claims = result?.claims as Record<string, any> | undefined;
        if (claims?.impersonatedBy !== impersonationSession.actorUid) {
          updateImpersonationSession(null);
          return;
        }
        if (typeof claims?.impersonatedAt === 'number') {
          const elapsed = Date.now() - claims.impersonatedAt;
          if (elapsed >= IMPERSONATION_TTL_MS) {
            void stopImpersonation();
          }
        }
      })
      .catch(() => {
        // ignore token claim validation errors
      });

    return () => {
      isActive = false;
    };
  }, [impersonationSession, user?.uid, updateImpersonationSession]);

  useEffect(() => {
    if (!impersonationSession) return;
    const expiresAt = typeof impersonationSession.expiresAt === 'number'
      ? impersonationSession.expiresAt
      : impersonationSession.startedAt + IMPERSONATION_TTL_MS;
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) {
      if (user?.uid === impersonationSession.targetUid) {
        void stopImpersonation();
      } else {
        updateImpersonationSession(null);
        setImpersonationTransition(null);
      }
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const latest = readImpersonationSession();
      if (!latest) return;
      if (Date.now() < expiresAt) return;
      if (userRef.current?.uid === latest.targetUid) {
        void stopImpersonation();
      } else {
        updateImpersonationSession(null);
        setImpersonationTransition(null);
      }
    }, remaining);

    return () => window.clearTimeout(timeoutId);
  }, [impersonationSession, user?.uid, updateImpersonationSession, stopImpersonation]);

  useEffect(() => {
    if (!user?.uid) return;
    if (impersonationSession) return;
    auth.currentUser?.getIdTokenResult()
      .then((result) => {
        const claims = result?.claims as Record<string, any> | undefined;
        const actorUid = claims?.impersonatedBy;
        if (!actorUid || typeof actorUid !== 'string') return;
        const startedAt = typeof claims?.impersonatedAt === 'number'
          ? claims.impersonatedAt
          : Date.now();
        updateImpersonationSession({
          actorUid,
          targetUid: user.uid,
          targetRole: user.role ?? null,
          targetEmail: user.email ?? null,
          targetDisplayName: user.displayName ?? null,
          impersonationId: null,
          reason: null,
          basePortalRole: null,
          startedAt,
          expiresAt: startedAt + IMPERSONATION_TTL_MS,
          status: 'active',
        });
      })
      .catch(() => {
        // ignore claim read errors
      });
  }, [impersonationSession, updateImpersonationSession, user?.displayName, user?.email, user?.role, user?.uid]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      if (!userRef.current?.uid) return;
      enableNetwork(db)
        .then(() => {
          firestoreNetworkDisabledRef.current = false;
        })
        .catch((error) => {
          console.warn('Failed to re-enable Firestore network (online):', error);
        });
    };

    const handleOffline = () => {
      if (!userRef.current?.uid) return;
      disableNetwork(db)
        .then(() => {
          firestoreNetworkDisabledRef.current = true;
        })
        .catch((error) => {
          console.warn('Failed to disable Firestore network (offline):', error);
        });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (navigator.onLine) {
      handleOnline();
    } else {
      handleOffline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    if (!firestoreNetworkDisabledRef.current) return;
    enableNetwork(db)
      .then(() => {
        firestoreNetworkDisabledRef.current = false;
      })
      .catch((error) => {
        console.warn('Failed to re-enable Firestore network:', error);
      });
  }, [user?.uid]);

  useEffect(() => {
    return () => {
      if (profileRetryTimeoutRef.current !== null) {
        window.clearTimeout(profileRetryTimeoutRef.current);
        profileRetryTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      pushInitRef.current = null;
      return;
    }
    const pushRole = user.role === 'superadmin' ? portalRoleState : user.role;
    if (!pushRole || !['donor', 'ngo', 'bloodbank'].includes(pushRole)) {
      return;
    }
    if (pushInitRef.current === user.uid) return;
    pushInitRef.current = user.uid;

    if (typeof window === 'undefined' || !('Notification' in window)) return;

    const enablePushOnLogin = async () => {
      try {
        if (user.notificationPreferences?.push === false) {
          return;
        }

        const deviceId = getDeviceId();
        const deviceInfo = getDeviceInfo();
        const storedToken = readStoredFcmToken(user.uid);
        const meta = readFcmTokenMeta(user.uid);
        const shouldSkipSave = Boolean(
          storedToken
          && meta?.token === storedToken
          && meta?.deviceId === deviceId
          && Date.now() - meta.savedAt < 12 * 60 * 60 * 1000
        );

        if (storedToken) {
          if (!shouldSkipSave) {
            if (deviceId) {
              await saveFCMDeviceToken(user.uid, deviceId, storedToken, deviceInfo);
            } else {
              await saveFCMToken(user.uid, storedToken);
            }
            writeFcmTokenMeta(user.uid, { token: storedToken, deviceId, savedAt: Date.now() });
          }
          return;
        }

        if (Notification.permission === 'granted') {
          const messaging = getMessaging();
          const token = await initializeFCM(user.uid, messaging, deviceId, deviceInfo);
          if (token) {
            try {
              writeStoredFcmToken(user.uid, token);
              writeFcmTokenMeta(user.uid, { token, deviceId, savedAt: Date.now() });
            } catch {
              // ignore
            }
          }
        }
      } catch (error) {
        console.warn('Failed to ensure push token on login:', error);
      }
    };

    enablePushOnLogin();
  }, [portalRoleState, user?.role, user?.uid]);

  useEffect(() => {
    if (!user?.uid || user.role !== 'donor') return;
    if (user.onboardingCompleted !== true) return;
    if (user.status && user.status !== 'active') return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    if (firestoreNetworkDisabledRef.current) return;
    const payload = buildPublicDonorPayload(user);
    const payloadKey = JSON.stringify({
      uid: user.uid,
      bhId: payload.bhId,
      displayName: payload.displayName,
      bloodType: payload.bloodType,
      gender: payload.gender,
      city: payload.city,
      state: payload.state,
      address: payload.address,
      latitude: payload.latitude,
      longitude: payload.longitude,
      isAvailable: payload.isAvailable,
      availableUntil: payload.availableUntil,
      lastDonation: payload.lastDonation,
      donationTypes: payload.donationTypes,
      donationType: payload.donationType,
      status: payload.status,
      onboardingCompleted: payload.onboardingCompleted,
    });
    if (publicDonorSyncRef.current === payloadKey) return;
    publicDonorSyncRef.current = payloadKey;
    setDoc(
      doc(db, 'publicDonors', user.uid),
      {
        ...payload,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    ).catch((error) => {
      console.warn('Failed to sync public donor record:', error);
    });
  }, [
    user?.uid,
    user?.role,
    user?.bhId,
    user?.displayName,
    user?.bloodType,
    user?.gender,
    user?.city,
    user?.state,
    user?.address,
    user?.latitude,
    user?.longitude,
    user?.isAvailable,
    user?.availableUntil,
    user?.lastDonation,
    (user as any)?.donationTypes,
    (user as any)?.donationType,
    user?.status,
    user?.onboardingCompleted,
  ]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      try {
        if (firebaseUser) {
          if (firestoreNetworkDisabledRef.current) {
            try {
              await enableNetwork(db);
              firestoreNetworkDisabledRef.current = false;
            } catch (error) {
              console.warn('Failed to re-enable Firestore network on login:', error);
            }
          }
          const now = Date.now();
          const recentLogin = recentLoginRef.current;
          const currentUser = userRef.current;
          const cachedUser = readCachedUser();
          if (!currentUser || currentUser.uid !== firebaseUser.uid) {
            setProfileResolved(false);
          }

          if (recentLogin && recentLogin.uid === firebaseUser.uid && now - recentLogin.at < 15000) {
            if (!currentUser || currentUser.uid !== firebaseUser.uid) {
              setUser(recentLogin.user || cachedUser || currentUser || null);
            }
            setProfileResolved(true);
            setLoading(false);
            void updateSessionMetadata(firebaseUser, recentLogin.user || cachedUser || currentUser || undefined);
            return;
          }

          if (currentUser && currentUser.uid === firebaseUser.uid) {
            setProfileResolved(true);
            setLoading(false);
            void updateSessionMetadata(firebaseUser, currentUser);
            return;
          }

          if (cachedUser && cachedUser.uid === firebaseUser.uid) {
            setUser(cachedUser);
            setProfileResolved(false);
            setLoading(false);
            void updateSessionMetadata(firebaseUser, cachedUser);
            void updateUserInFirestore(firebaseUser)
              .then((result) => {
                const isRegistrationRoute =
                  typeof window !== 'undefined' &&
                  (window.location.pathname.includes('/register') ||
                    window.location.pathname.includes('/onboarding'));
                if (result.user) {
                  setUser(result.user);
                  return;
                }
                if (result.missing) {
                  console.warn('User document missing. Keeping cached session active.');
                  if (isRegistrationRoute) {
                    setUser({
                      uid: firebaseUser.uid,
                      email: firebaseUser.email,
                      displayName: firebaseUser.displayName,
                      photoURL: firebaseUser.photoURL,
                      phoneNumber: firebaseUser.phoneNumber,
                    } as User);
                  }
                }
              })
              .catch((error) => {
                logProfileIssue('cached-profile-refresh-failed', error, { uid: firebaseUser.uid });
                if (profileRetryTimeoutRef.current !== null) {
                  window.clearTimeout(profileRetryTimeoutRef.current);
                }
                profileRetryTimeoutRef.current = window.setTimeout(() => {
                  updateUserInFirestore(firebaseUser)
                    .then((retryResult) => {
                      if (retryResult.user) {
                        setUser(retryResult.user);
                      }
                    })
                    .catch((retryError) => {
                      logProfileIssue('cached-profile-retry-failed', retryError, { uid: firebaseUser.uid });
                    });
                }, 7000);
              })
              .finally(() => {
                setProfileResolved(true);
              });
            return;
          }

          // Check if user is newly created (within last 30 seconds)
          const creationTime = new Date(firebaseUser.metadata.creationTime!).getTime();
          const currentTime = Date.now();
          const isNewUser = (currentTime - creationTime) < 30000; // 30 seconds grace period

          // Add retry logic with delay for new users
          let userData: User | null = null;
          let missingUserDoc = false;
          let lastError: unknown = null;
          let retries = isNewUser ? 5 : 3; // More retries for new users
          let delay = isNewUser ? 1000 : 500; // Longer delay for new users

          while (retries > 0 && !userData && !missingUserDoc) {
            try {
              const result = await updateUserInFirestore(firebaseUser);
              if (result.user) {
                userData = result.user;
                break;
              }
              if (result.missing) {
                missingUserDoc = true;
                break;
              }

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
              lastError = error;
              console.warn(`Attempt ${(isNewUser ? 5 : 3) - retries + 1} failed, retrying...`, error);
              retries--;
              if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, delay));
              }
            }
          }

          if (userData) {
            setUser(userData);
          } else {
            if (missingUserDoc) {
              console.warn('User document missing. Keeping session active.');
            } else if (lastError) {
              logProfileIssue('profile-load-failed', lastError, { uid: firebaseUser.uid });
              if (profileRetryTimeoutRef.current !== null) {
                window.clearTimeout(profileRetryTimeoutRef.current);
              }
              profileRetryTimeoutRef.current = window.setTimeout(() => {
                updateUserInFirestore(firebaseUser)
                  .then((retryResult) => {
                    if (retryResult.user) {
                      setUser(retryResult.user);
                    }
                  })
                  .catch((retryError) => {
                    logProfileIssue('profile-retry-failed', retryError, { uid: firebaseUser.uid });
                  });
              }, 7000);
            }
            const fallbackUser = currentUser || cachedUser;
            if (fallbackUser) {
              setUser(fallbackUser);
            } else {
              console.log('⏳ Profile unavailable; keeping minimal session until retry.');
              setUser({
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName,
                photoURL: firebaseUser.photoURL,
                phoneNumber: firebaseUser.phoneNumber,
              } as User);
            }
          }
          setProfileResolved(true);
        } else {
          setUser(null);
          setProfileResolved(true);
        }
      } catch (error) {
        console.error('Error in auth state change:', error);
        setUser(null);
        setProfileResolved(true);
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
    if (!user?.uid) return;
    if (user.referredByUid || user.referredByBhId) return;
    const hasReferral = Boolean(getReferralTracking() || getReferralReferrerUid());
    if (!hasReferral) return;
    if (referralApplyAttemptedRef.current) return;
    referralApplyAttemptedRef.current = true;

    const createdAt = normalizeUserDate(user.createdAt);
    const now = Date.now();
    const accountAgeHours = createdAt ? (now - createdAt.getTime()) / 3600000 : null;
    if (accountAgeHours === null) {
      clearReferralTracking();
      return;
    }
    if (accountAgeHours > 24) {
      clearReferralTracking();
      return;
    }
    if (!createdAt && user.onboardingCompleted) {
      clearReferralTracking();
      return;
    }

    applyReferralTrackingForUser(user.uid)
      .then((result) => {
        if (result?.referrerUid) {
          setUser(prev => prev ? {
            ...prev,
            referredByUid: result.referrerUid,
            referredByBhId: result.referrerBhId || prev.referredByBhId,
          } as User : prev);
        }
      })
      .catch((error) => {
        console.warn('Deferred referral apply failed:', error);
      });
  }, [user?.uid, user?.referredByUid, user?.referredByBhId]);

  useEffect(() => {
    if (!user?.uid) return;
    if (!user.referredByUid) return;
    ensureReferralTrackingForExistingReferral(user).catch((error) => {
      console.warn('Referral status sync failed:', error);
    });
  }, [user?.uid, user?.referredByUid, user?.onboardingCompleted, user?.status]);

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

        if (matchedUser.role === 'superadmin') {
          await signOut(auth);
          throw new PhoneAuthError('Superadmin can only sign in with Google.', 'superadmin_google_only');
        }
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
      if (userData.role === 'superadmin') {
        await signOut(auth);
        throw new PhoneAuthError('Superadmin can only sign in with Google.', 'superadmin_google_only');
      }
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
        emailVerified: userCredential.user.emailVerified,
      } as User;

      // Update user state immediately for navigation
      setUser(userDataToReturn);
      recentLoginRef.current = { uid: userDataToReturn.uid, at: Date.now(), user: userDataToReturn };

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

  const startPhoneUpdate = async (phoneNumber: string): Promise<ConfirmationResult> => {
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
      const confirmation = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
      return confirmation;
    } catch (error) {
      cleanupRecaptcha();
      throw error;
    }
  };

  const confirmPhoneUpdate = async (
    confirmationResult: ConfirmationResult,
    otp: string,
    phoneNumber: string
  ): Promise<void> => {
    if (!auth.currentUser) {
      throw new Error('No user logged in');
    }

    try {
      const credential = PhoneAuthProvider.credential(confirmationResult.verificationId, otp);
      await updatePhoneNumber(auth.currentUser, credential);
      cleanupRecaptcha();

      const normalizedPhone = normalizePhoneNumber(phoneNumber || auth.currentUser.phoneNumber || '');
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

  const updateEmailAddress = async (email: string): Promise<void> => {
    if (!auth.currentUser) {
      throw new Error('No user logged in');
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new Error('Email is required');
    }
    await updateEmail(auth.currentUser, normalizedEmail);
    await sendEmailVerification(auth.currentUser);
    await updateDoc(doc(db, 'users', auth.currentUser.uid), {
      email: normalizedEmail,
      updatedAt: serverTimestamp(),
    });
    setUser(prev => prev ? { ...prev, email: normalizedEmail, emailVerified: false } : prev);
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
      const userDoc = await getUserDocSnapshot(userRef);

      if (!userDoc.exists()) {
        await signOut(auth);
        throw new Error('User not registered. Please register first.');
      }

      // Get the token
      const token = await result.user.getIdToken();

      const userDocData = userDoc.data() as User;
      if (userDocData.role === 'superadmin') {
        await signOut(auth);
        throw new Error('Superadmin can only sign in with Google.');
      }
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
        emailVerified: result.user.emailVerified,
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
      recentLoginRef.current = { uid: userDataToReturn.uid, at: Date.now(), user: userDataToReturn };

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
      const userDoc = await getUserDocSnapshot(userRef);

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
        emailVerified: result.user.emailVerified,
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
      recentLoginRef.current = { uid: userDataToReturn.uid, at: Date.now(), user: userDataToReturn };

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
    let signOutFailed = false;

    try {
      // Clear user state early so dashboards unmount listeners before sign-out.
      setUser(null);
      await new Promise(resolve => setTimeout(resolve, 0));
    } catch {
      // ignore
    }

    try {
      if (!firestoreNetworkDisabledRef.current) {
        await disableNetwork(db);
        firestoreNetworkDisabledRef.current = true;
      }
    } catch (error) {
      console.warn('Failed to disable Firestore network during logout:', error);
    }

    try {
      await auth.signOut();
    } catch (error) {
      signOutFailed = true;
      console.warn('Sign out failed, proceeding with local cleanup:', error);
    }

    try {
      localStorage.removeItem('authToken');
      sessionStorage.clear();
      // Clear any other auth-related storage
      localStorage.removeItem('user');
      localStorage.removeItem('lastLoginTime');
      localStorage.removeItem(userCacheKey);
      localStorage.removeItem(userCacheAtKey);
      localStorage.removeItem(impersonationStorageKey);
      // Optional: Clear any cached data
      indexedDB.deleteDatabase('firebaseLocalStorageDb');
    } catch (error) {
      console.warn('Local logout cleanup failed:', error);
    }

    if (signOutFailed) {
      return;
    }
  };

  const logout = async (
    navigate: NavigateFunction,
    options: { redirectTo?: string; showToast?: boolean } = {}
  ) => {
    updateImpersonationSession(null);
    setImpersonationTransition(null);
    const resolvedRole = user?.role === 'superadmin' ? portalRoleState : user?.role;
    const resolvedRedirect = options.redirectTo ?? (
      resolvedRole === 'ngo'
        ? '/ngo/login'
        : resolvedRole === 'bloodbank'
          ? '/bloodbank/login'
          : resolvedRole === 'admin'
            ? '/admin/login'
            : resolvedRole === 'donor'
              ? '/donor/login'
              : '/admin/login'
    );
    const { showToast = true } = options;
    let hadError = false;
    try {
      await handleLogout();
    } catch (error) {
      hadError = true;
      console.error('Logout error:', error);
    }

    setPortalRole(null);

    try {
      // Broadcast logout event to other tabs
      logoutChannel.postMessage('logout');
    } catch (error) {
      console.warn('Failed to broadcast logout event:', error);
    }

    if (showToast) {
      if (hadError) {
        toast.error('Failed to log out. Please try again.');
      } else {
        toast.success('Successfully logged out!');
      }
    }

    if (resolvedRedirect) {
      navigate(resolvedRedirect);
    }
  };

  // Update updateUserProfile method to handle onboarding
  const updateUserProfile = async (data: Partial<User>): Promise<void> => {
    if (!user) {
      throw new Error('No user logged in');
    }
    const isPrivileged = user.role === 'admin' || user.role === 'superadmin';
    const sanitizedData: Partial<User> = { ...data };
    if (!isPrivileged) {
      if (Object.prototype.hasOwnProperty.call(sanitizedData, 'role')) {
        delete sanitizedData.role;
      }
      if (Object.prototype.hasOwnProperty.call(sanitizedData, 'breakGlass')) {
        delete sanitizedData.breakGlass;
      }
    }
    console.log('Updating user profile with:', sanitizedData);
    try {
      const nextDateOfBirth = sanitizedData.dateOfBirth ?? user.dateOfBirth;
      const nextPostalCode = sanitizedData.postalCode ?? user.postalCode;
      const existingBhId = user.bhId;
      const generatedBhId = existingBhId
        ? null
        : generateBhId({
            dateOfBirth: nextDateOfBirth,
            postalCode: nextPostalCode || undefined,
            uid: user.uid
          });

      const phoneNumberNormalized = sanitizedData.phoneNumber
        ? normalizePhoneNumber(sanitizedData.phoneNumber)
        : undefined;

      await setDoc(
        doc(db, 'users', user.uid),
        {
          ...sanitizedData,
          ...(phoneNumberNormalized ? { phoneNumberNormalized } : {}),
          onboardingCompleted: true, // Set this to true upon successful completion
          ...(existingBhId ? {} : generatedBhId ? { bhId: generatedBhId } : {})
        },
        { merge: true }
      );
      if (isPrivileged && sanitizedData.role && sanitizedData.role !== user.role) {
        void logAuditEvent({
          actorUid: user.uid,
          actorRole: user.role || 'admin',
          action: 'role_change',
          targetUid: user.uid,
          metadata: {
            from: user.role ?? null,
            to: sanitizedData.role,
            source: 'updateUserProfile',
          },
        });
      }
      const nextUser = {
        ...user,
        ...sanitizedData,
        ...(phoneNumberNormalized ? { phoneNumberNormalized } : {}),
        onboardingCompleted: true,
        bhId: user.bhId || generatedBhId || undefined
      } as User;

      const nextRole = sanitizedData.role ?? user.role;
      const nextStatus = sanitizedData.status ?? user.status;
      const nextOnboarding = sanitizedData.onboardingCompleted ?? true;
      const canPublishPublicDonor = nextRole === 'donor'
        && nextOnboarding === true
        && (!nextStatus || nextStatus === 'active');

      if (canPublishPublicDonor) {
        try {
          await setDoc(
            doc(db, 'publicDonors', user.uid),
            {
              ...buildPublicDonorPayload(nextUser),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        } catch (publicError) {
          console.warn('Failed to update public donor record:', publicError);
        }
      }

      setUser(prev => ({
        ...prev,
        ...sanitizedData,
        ...(phoneNumberNormalized ? { phoneNumberNormalized } : {}),
        onboardingCompleted: true, // Ensure this is updated in the state
        bhId: prev?.bhId || generatedBhId || undefined
      } as User));
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error; // Re-throw the error so the caller can handle it
    }
  };

  useEffect(() => {
    if (!user?.uid) return;
    void flushQueuedErrorLogs();
  }, [user?.uid]);

  const isSuperAdmin = user?.role === 'superadmin';
  const isImpersonating = Boolean(
    impersonationSession && user?.uid && user.uid === impersonationSession.targetUid
  );
  const effectiveRole = isSuperAdmin ? portalRoleState : user?.role;
  const effectiveUser = isSuperAdmin && portalRoleState && user
    ? ({
        ...user,
        role: portalRoleState,
      } as User)
    : user;

  return (
    <AuthContext.Provider value={{
      user: effectiveUser,
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
      startPhoneUpdate,
      confirmPhoneUpdate,
      updateEmailAddress,
      unlinkGoogleProvider,
      unlinkPhoneProvider,
      portalRole: portalRoleState,
      setPortalRole,
      effectiveRole: effectiveRole ?? null,
      isSuperAdmin,
      impersonationSession,
      isImpersonating,
      impersonationTransition,
      startImpersonation,
      stopImpersonation,
      profileResolved,
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
