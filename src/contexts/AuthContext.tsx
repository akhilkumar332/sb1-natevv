import { ONE_DAY_MS, TEN_MINUTES_MS, THIRTY_MINUTES_MS, TWELVE_HOURS_MS, ZERO_MS } from '../constants/time';
// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { NavigateFunction } from 'react-router-dom';
import { notify } from 'services/notify.service';
import {
  signInWithPopup,
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
  updateDoc, 
  serverTimestamp, 
  DocumentReference,
  DocumentSnapshot,
  disableNetwork,
  enableNetwork
} from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';
import { COLLECTIONS } from '../constants/firestore';
import { getMessaging } from 'firebase/messaging';
import { initializeFCM, saveFCMDeviceToken, saveFCMToken } from '../services/notification.service';
import { requestImpersonation, requestImpersonationResume } from '../services/impersonation.service';
import { captureHandledError, flushQueuedErrorLogs } from '../services/errorLog.service';
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
import { cleanupAuthSession } from '../utils/authSessionCleanup';
import { readFcmTokenMeta, readStoredFcmToken, writeFcmTokenMeta, writeStoredFcmToken } from '../utils/fcmStorage';
import { authMessages } from '../constants/messages';
import { ROUTES } from '../constants/routes';
import { buildUserWriteDiagnosticMetadata, captureFirestoreOperationError } from '../utils/firestoreDiagnostics';
import {
  clearPendingPortalRole,
  clearRegistrationIntent,
  readPendingPortalRole,
  readRegistrationIntent,
} from '../utils/registrationIntent';
import { createUserDocumentViaRest, patchUserDocumentViaRest } from '../utils/firestoreRestUserWrite';

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

const isSameProfileValue = (current: unknown, next: unknown): boolean => {
  if (current === next) return true;
  const currentDate = normalizeUserDate(current);
  const nextDate = normalizeUserDate(next);
  if (currentDate || nextDate) {
    if (!currentDate || !nextDate) return false;
    return currentDate.getTime() === nextDate.getTime();
  }
  if (typeof current === 'object' && typeof next === 'object' && current && next) {
    try {
      return JSON.stringify(current) === JSON.stringify(next);
    } catch {
      return false;
    }
  }
  return false;
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

type PendingPhoneLinkContinuation = {
  phoneNumber: string;
  targetUid: string;
  createdAt: number;
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
  pendingPhoneLinkContinuation: PendingPhoneLinkContinuation | null;
  clearPendingPhoneLinkContinuation: () => void;
}

interface LoginResponse {
  token: string;
  user: User;
  phoneLinkRequiresFreshOtp?: boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);

const pendingPhoneLinkKey = 'pendingPhoneLink';
const pendingPhoneLinkContinuationKey = 'pendingPhoneLinkContinuation';
const portalRoleStorageKey = 'bh_superadmin_portal_role';
const impersonationStorageKey = 'bh_superadmin_impersonation';
const userCacheKey = 'bh_user_cache';
const userCacheAtKey = 'bh_user_cache_at';
const userCacheTtlMs = ONE_DAY_MS;
const IMPERSONATION_TTL_MS = THIRTY_MINUTES_MS;
const authOwnedSessionStorageKeys = [
  pendingPhoneLinkKey,
  pendingPhoneLinkContinuationKey,
  portalRoleStorageKey,
  impersonationStorageKey,
  'bh_pending_portal_role',
  'bh_registration_intent',
] as const;

const decodeJwtSubject = (token: string | null): string | null => {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = JSON.parse(atob(padded)) as { sub?: unknown; user_id?: unknown };
    if (typeof decoded?.sub === 'string' && decoded.sub) return decoded.sub;
    if (typeof decoded?.user_id === 'string' && decoded.user_id) return decoded.user_id;
  } catch {
    // ignore invalid token payloads
  }
  return null;
};

const clearAuthOwnedSessionStorage = () => {
  if (typeof window === 'undefined') return;
  authOwnedSessionStorageKeys.forEach((key) => {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // ignore storage cleanup errors
    }
  });
};

const reportAuthContextError = (
  error: unknown,
  kind: string,
  metadata?: Record<string, unknown>
) => {
  void captureHandledError(error, {
    source: 'frontend',
    scope: 'auth',
    metadata: {
      kind,
      page: 'AuthContext',
      ...(metadata || {}),
    },
  });
};

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
    const hydrated = hydrateCachedUser(JSON.parse(raw));
    const tokenSubject = decodeJwtSubject(authToken);
    if (tokenSubject && hydrated?.uid && hydrated.uid !== tokenSubject) {
      localStorage.removeItem(userCacheKey);
      localStorage.removeItem(userCacheAtKey);
      return null;
    }
    return hydrated;
  } catch {
    return null;
  }
};

const savePendingPhoneLink = (data: {
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

const savePendingPhoneLinkContinuation = (data: Omit<PendingPhoneLinkContinuation, 'createdAt'>) => {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(pendingPhoneLinkContinuationKey, JSON.stringify({
    ...data,
    createdAt: Date.now(),
  }));
};

const clearPendingPhoneLinkContinuationStorage = () => {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(pendingPhoneLinkContinuationKey);
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
      reportAuthContextError(error, 'auth.recaptcha.clear');
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
      phoneNumber: string;
      targetUid: string;
      createdAt: number;
    };
    if (parsed.createdAt && Date.now() - parsed.createdAt > TEN_MINUTES_MS) {
      clearPendingPhoneLink();
      return null;
    }
    return parsed;
  } catch (error) {
    reportAuthContextError(error, 'auth.pending_phone_link.parse');
    clearPendingPhoneLink();
    return null;
  }
};

const readPendingPhoneLinkContinuation = (): PendingPhoneLinkContinuation | null => {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(pendingPhoneLinkContinuationKey);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingPhoneLinkContinuation;
    if (parsed.createdAt && Date.now() - parsed.createdAt > TEN_MINUTES_MS) {
      clearPendingPhoneLinkContinuationStorage();
      return null;
    }
    if (!parsed.phoneNumber || !parsed.targetUid) {
      clearPendingPhoneLinkContinuationStorage();
      return null;
    }
    return parsed;
  } catch (error) {
    reportAuthContextError(error, 'auth.pending_phone_link_continuation.parse');
    clearPendingPhoneLinkContinuationStorage();
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

const isAuthBootstrapPermissionError = (error: unknown) => {
  const code = String((error as { code?: string })?.code || '').toLowerCase();
  return code === 'permission-denied' || code === 'unauthenticated';
};

const waitForFirestoreAuthUser = async (expectedUid?: string | null, timeoutMs: number = 5000): Promise<void> => {
  if (typeof (auth as any).authStateReady === 'function') {
    try {
      await (auth as any).authStateReady();
    } catch {
      // ignore auth readiness failures
    }
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const currentUid = auth.currentUser?.uid || null;
    if (!expectedUid || currentUid === expectedUid) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
};

const getUserDocSnapshot = async (userRef: DocumentReference): Promise<DocumentSnapshot> => {
  await waitForFirestoreAuthUser(userRef.id);

  let attempts = 0;
  let lastError: unknown = null;

  while (attempts < 5) {
    try {
      return await getDoc(userRef);
    } catch (error: any) {
      lastError = error;
      const message = String(error?.message || '');
      const isTargetCollision = error?.code === 'already-exists' || message.includes('Target ID already exists');
      const currentUid = auth.currentUser?.uid || null;
      const authNotReadyForOwnerRead = isAuthBootstrapPermissionError(error) && (!currentUid || currentUid !== userRef.id);

      if (!isTargetCollision && !authNotReadyForOwnerRead) {
        throw error;
      }

      attempts += 1;
      if (attempts >= 5) {
        throw error;
      }

      try {
        await auth.currentUser?.getIdToken(true);
      } catch {
        // ignore token refresh failures while waiting for Firestore auth to settle
      }

      await new Promise((resolve) => setTimeout(resolve, 250 * attempts));
      await waitForFirestoreAuthUser(userRef.id, 1500);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Failed to read user document');
};

const buildBootstrapFallbackUser = (
  firebaseUser: FirebaseUser,
  pendingRole?: User['role'] | null,
): User => ({
  uid: firebaseUser.uid,
  email: firebaseUser.email,
  displayName: firebaseUser.displayName,
  photoURL: firebaseUser.photoURL,
  phoneNumber: firebaseUser.phoneNumber,
  role: pendingRole || undefined,
  status: pendingRole ? 'active' : undefined,
  onboardingCompleted: pendingRole ? false : undefined,
} as User);

const ensureBootstrapUserDocument = async ({
  firebaseUser,
  role,
  currentUser,
  phoneNumberNormalized,
}: {
  firebaseUser: FirebaseUser;
  role: User['role'];
  currentUser: User;
  phoneNumberNormalized?: string;
}) => {
  const userRef = doc(db, COLLECTIONS.USERS, firebaseUser.uid);
  await setDoc(userRef, {
    uid: firebaseUser.uid,
    email: firebaseUser.email || currentUser.email || null,
    displayName: currentUser.displayName || firebaseUser.displayName || null,
    photoURL: firebaseUser.photoURL || currentUser.photoURL || null,
    phoneNumber: currentUser.phoneNumber || firebaseUser.phoneNumber || null,
    ...(phoneNumberNormalized ? { phoneNumberNormalized } : {}),
    role,
    onboardingCompleted: false,
    createdAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
    ...(currentUser.referredByUid ? { referredByUid: currentUser.referredByUid } : {}),
    ...(currentUser.referredByBhId ? { referredByBhId: currentUser.referredByBhId } : {}),
  }, { merge: true });
};

const runOwnerUserWriteWithRetry = async ({
  uid,
  write,
  restFallbackPatch,
  restFallbackMode = 'patch',
}: {
  uid: string;
  write: () => Promise<void>;
  restFallbackPatch?: Record<string, string | number | boolean | Date | null | undefined | any[] | Record<string, any>>;
  restFallbackMode?: 'create' | 'patch';
}) => {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await waitForFirestoreAuthUser(uid, 1500);
      await write();
      return;
    } catch (error: any) {
      lastError = error;
      const code = String(error?.code || '').toLowerCase();
      const currentUid = auth.currentUser?.uid || null;
      const shouldRetry =
        code === 'permission-denied'
        && currentUid === uid;

      if (!shouldRetry || attempt >= 2) {
        throw error;
      }

      try {
        await auth.currentUser?.getIdToken(true);
      } catch {
        // ignore token refresh failures and retry once Firestore auth catches up
      }

      await waitForFirestoreAuthUser(uid, 2000);
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }

  const lastCode = String((lastError as any)?.code || '').toLowerCase();
  if (lastCode === 'permission-denied' && restFallbackPatch && auth.currentUser?.uid === uid) {
    const freshToken = await auth.currentUser.getIdToken(true);
    if (restFallbackMode === 'create') {
      try {
        await createUserDocumentViaRest({
          idToken: freshToken,
          userId: uid,
          document: restFallbackPatch,
        });
      } catch (restCreateError: any) {
        if (String(restCreateError?.code || '').toLowerCase() !== 'already-exists') {
          throw restCreateError;
        }
        await patchUserDocumentViaRest({
          idToken: freshToken,
          userId: uid,
          patch: restFallbackPatch,
        });
      }
    } else {
      await patchUserDocumentViaRest({
        idToken: freshToken,
        userId: uid,
        patch: restFallbackPatch,
      });
    }
    return;
  }

  throw lastError instanceof Error ? lastError : new Error('Failed to persist owner user document');
};

const updateUserInFirestore = async (
  firebaseUser: FirebaseUser,
  additionalData?: Partial<User>
): Promise<UserFetchResult> => {
  const userRef: DocumentReference = doc(db, COLLECTIONS.USERS, firebaseUser.uid);
  try {
    let userDoc: DocumentSnapshot;
    try {
      userDoc = await getUserDocSnapshot(userRef);
    } catch (userReadError) {
      const currentUid = auth.currentUser?.uid || null;
      const shouldReportUserReadError = !(
        isAuthBootstrapPermissionError(userReadError)
        && currentUid !== firebaseUser.uid
      );

      if (shouldReportUserReadError) {
        await captureFirestoreOperationError(userReadError, {
          scope: 'auth',
          kind: 'auth.user_doc.read',
          operation: 'getDoc',
          collection: COLLECTIONS.USERS,
          docId: firebaseUser.uid,
          blocking: true,
          phase: 'auth_bootstrap',
          portalRole: additionalData?.role || null,
        });
      }
      throw userReadError;
    }

    // If user document doesn't exist, return null
    if (!userDoc.exists()) {
      reportAuthContextError(new Error('User document missing'), 'auth.user_doc.missing', { uid: firebaseUser.uid });
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
      void captureFirestoreOperationError(updateError, {
        scope: 'auth',
        kind: 'auth.user_doc.last_login_update',
        operation: 'updateDoc',
        collection: COLLECTIONS.USERS,
        docId: firebaseUser.uid,
        blocking: false,
        phase: 'auth_bootstrap',
        portalRole: existingUserData?.role || null,
      });
      reportAuthContextError(updateError, 'auth.user_doc.last_login_update');
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
          doc(db, COLLECTIONS.PUBLIC_DONORS, firebaseUser.uid),
          {
            ...buildPublicDonorPayload(resolvedUser),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (publicError) {
        void captureFirestoreOperationError(publicError, {
          scope: 'auth',
          kind: 'auth.public_donor.sync',
          operation: 'setDoc',
          collection: COLLECTIONS.PUBLIC_DONORS,
          docId: firebaseUser.uid,
          blocking: false,
          phase: 'auth_bootstrap',
          portalRole: resolvedUser.role || null,
        });
        reportAuthContextError(publicError, 'auth.public_donor.sync');
      }
    }

    return { user: resolvedUser, missing: false };
  } catch (error) {
    reportAuthContextError(error, 'auth.user_doc.update');
    throw error;
  }
};

const updateSessionMetadata = async (firebaseUser: FirebaseUser, knownUser?: User) => {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, firebaseUser.uid);
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
    void captureFirestoreOperationError(error, {
      scope: 'auth',
      kind: 'auth.session_metadata.update',
      operation: 'updateDoc',
      collection: COLLECTIONS.USERS,
      docId: firebaseUser.uid,
      blocking: false,
      phase: 'session_metadata',
      portalRole: knownUser?.role || null,
    });
    reportAuthContextError(error, 'auth.session_metadata.update');
  }
};

let isRecaptchaSettingUp = false;

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
  const [pendingPhoneLinkContinuation, setPendingPhoneLinkContinuation] = useState<PendingPhoneLinkContinuation | null>(
    readPendingPhoneLinkContinuation
  );
  const logoutChannelRef = useRef<BroadcastChannel | null>(null);
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
  const clearPendingPhoneLinkContinuation = useCallback(() => {
    setPendingPhoneLinkContinuation(null);
    clearPendingPhoneLinkContinuationStorage();
  }, []);

  const logProfileIssue = (label: string, error: unknown, context?: Record<string, unknown>) => {
    const err = error as any;
    reportAuthContextError(error, `auth.profile.${label}`, {
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
    const continuation = pendingPhoneLinkContinuation;
    if (!continuation) return;
    if (!user?.uid) {
      clearPendingPhoneLinkContinuation();
      return;
    }
    if (continuation.targetUid !== user.uid) {
      clearPendingPhoneLinkContinuation();
      return;
    }
    const currentAuthPhone = normalizePhoneNumber(auth.currentUser?.phoneNumber || '');
    if (currentAuthPhone && currentAuthPhone === continuation.phoneNumber) {
      clearPendingPhoneLinkContinuation();
    }
  }, [clearPendingPhoneLinkContinuation, pendingPhoneLinkContinuation, user?.uid]);

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
      notify.error(authMessages.onlySuperadminsCanImpersonate);
      trackImpersonationEvent('impersonation_denied', {
        reason: 'not_superadmin',
      });
      setImpersonationTransition(null);
      return null;
    }

    const targetUid = target?.uid;
    if (!targetUid) {
      notify.error(authMessages.unableToResolveSelectedUser);
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
        notify.error(authMessages.impersonationFailed);
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
      reportAuthContextError(error, 'auth.impersonation.start');
      notify.error(error?.message || authMessages.failedToStartImpersonation);
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
      reportAuthContextError(error, 'auth.impersonation.resume');
      notify.error(authMessages.failedToResumeAdminSession);
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
          reportAuthContextError(error, 'auth.firestore.network_enable_online');
        });
    };

    const handleOffline = () => {
      if (!userRef.current?.uid) return;
      disableNetwork(db)
        .then(() => {
          firestoreNetworkDisabledRef.current = true;
        })
        .catch((error) => {
          reportAuthContextError(error, 'auth.firestore.network_disable_offline');
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
        reportAuthContextError(error, 'auth.firestore.network_reenable');
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
    if (readRegistrationIntent() || user.onboardingCompleted !== true) {
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
          && Date.now() - meta.savedAt < TWELVE_HOURS_MS
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
        reportAuthContextError(error, 'auth.push.ensure_on_login');
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
      doc(db, COLLECTIONS.PUBLIC_DONORS, user.uid),
      {
        ...payload,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    ).catch((error) => {
      void captureFirestoreOperationError(error, {
        scope: 'auth',
        kind: 'auth.public_donor.sync_effect',
        operation: 'setDoc',
        collection: COLLECTIONS.PUBLIC_DONORS,
        docId: user.uid,
        blocking: false,
        phase: 'auth_sync_effect',
        portalRole: user.role || null,
      });
      reportAuthContextError(error, 'auth.public_donor.sync_effect');
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
              reportAuthContextError(error, 'auth.firestore.network_reenable_login');
            }
          }
          const now = Date.now();
          const recentLogin = recentLoginRef.current;
          const currentUser = userRef.current;
          const cachedUser = readCachedUser();
          const matchingCachedUser = cachedUser?.uid === firebaseUser.uid ? cachedUser : null;
          const pendingPortalRole = readPendingPortalRole();
          const registrationIntentRole = readRegistrationIntent();
          const bootstrapPendingRole = pendingPortalRole || registrationIntentRole;
          const isRegistrationRoute =
            typeof window !== 'undefined'
            && (window.location.pathname.includes('/register') || window.location.pathname.includes('/onboarding'));
          if (!currentUser || currentUser.uid !== firebaseUser.uid) {
            setProfileResolved(false);
          }

          if (recentLogin && recentLogin.uid === firebaseUser.uid && now - recentLogin.at < 15000) {
            if (!currentUser || currentUser.uid !== firebaseUser.uid) {
              setUser(recentLogin.user || matchingCachedUser || currentUser || null);
            }
            setProfileResolved(true);
            setLoading(false);
            void updateSessionMetadata(firebaseUser, recentLogin.user || matchingCachedUser || currentUser || undefined);
            return;
          }

          if (currentUser && currentUser.uid === firebaseUser.uid) {
            setProfileResolved(true);
            setLoading(false);
            void updateSessionMetadata(firebaseUser, currentUser);
            return;
          }

          if (matchingCachedUser) {
            setUser(matchingCachedUser);
            setProfileResolved(false);
            setLoading(false);
            void updateSessionMetadata(firebaseUser, matchingCachedUser);
            void updateUserInFirestore(firebaseUser)
              .then((result) => {
                if (result.user) {
                  setUser(result.user);
                  return;
                }
                if (result.missing) {
                  reportAuthContextError(new Error('User document missing'), 'auth.user_doc.missing_cached', { uid: firebaseUser.uid });
                  if (isRegistrationRoute) {
                    setUser(buildBootstrapFallbackUser(firebaseUser, bootstrapPendingRole));
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

          if (isRegistrationRoute && bootstrapPendingRole && (isNewUser || registrationIntentRole)) {
            setUser(buildBootstrapFallbackUser(firebaseUser, bootstrapPendingRole));
            setProfileResolved(true);
            setLoading(false);

            if (profileRetryTimeoutRef.current !== null) {
              window.clearTimeout(profileRetryTimeoutRef.current);
            }
            const refreshRegistrationProfile = (attempt: number) => {
              profileRetryTimeoutRef.current = window.setTimeout(() => {
                if (readRegistrationIntent()) {
                  if (attempt < 12) {
                    refreshRegistrationProfile(attempt + 1);
                  }
                  return;
                }
                updateUserInFirestore(firebaseUser)
                  .then((retryResult) => {
                    if (retryResult.user) {
                      setUser(retryResult.user);
                    }
                  })
                  .catch((retryError) => {
                    logProfileIssue('registration-route-profile-retry-failed', retryError, { uid: firebaseUser.uid });
                  });
              }, attempt === 0 ? 1800 : 1000);
            };
            refreshRegistrationProfile(0);
            return;
          }

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
                if (isNewUser) {
                  retries--;
                  if (retries > 0) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                  }
                }
                missingUserDoc = true;
                break;
              }

              // If document doesn't exist and user is NEW, wait for registration to complete
              if (isNewUser && !userData) {
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
              reportAuthContextError(error, 'auth.profile.retry_attempt', {
                attempt: (isNewUser ? 5 : 3) - retries + 1,
                isNewUser,
              });
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
              reportAuthContextError(new Error('User document missing'), 'auth.user_doc.missing_session', { uid: firebaseUser.uid });
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
              setUser(buildBootstrapFallbackUser(firebaseUser, bootstrapPendingRole));
            }
          }
          setProfileResolved(true);
        } else {
          if (firestoreNetworkDisabledRef.current && (typeof navigator === 'undefined' || navigator.onLine)) {
            try {
              await enableNetwork(db);
              firestoreNetworkDisabledRef.current = false;
            } catch (error) {
              reportAuthContextError(error, 'auth.firestore.network_reenable_signed_out');
            }
          }
          setUser(null);
          setProfileResolved(true);
        }
      } catch (error) {
        reportAuthContextError(error, 'auth.state_change');
        const currentFirebaseUser = auth.currentUser;
        const fallbackUser = userRef.current || readCachedUser();
        if (currentFirebaseUser && fallbackUser && fallbackUser.uid === currentFirebaseUser.uid) {
          setUser(fallbackUser);
        } else if (currentFirebaseUser && userRef.current?.uid === currentFirebaseUser.uid) {
          setUser(userRef.current);
        } else {
          setUser(null);
        }
        setProfileResolved(true);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Listen for logout events from other tabs
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    const handleLogoutEvent = (event: MessageEvent) => {
      if (event.data === 'logout') {
        handleLogout();
      }
    };

    const channel = new BroadcastChannel('auth_logout');
    logoutChannelRef.current = channel;
    channel.addEventListener('message', handleLogoutEvent);

    // Cleanup listener on unmount
    return () => {
      channel.removeEventListener('message', handleLogoutEvent);
      channel.close();
      if (logoutChannelRef.current === channel) {
        logoutChannelRef.current = null;
      }
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
        reportAuthContextError(error, 'auth.referral.deferred_apply');
      });
  }, [user?.uid, user?.referredByUid, user?.referredByBhId]);

  useEffect(() => {
    if (!user?.uid) return;
    if (!user.referredByUid) return;
    ensureReferralTrackingForExistingReferral(user).catch((error) => {
      reportAuthContextError(error, 'auth.referral.status_sync');
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
      reportAuthContextError(error, 'auth.user_cache.write');
    }
  }, [user]);

  const loginWithPhone = async (phoneNumber: string): Promise<ConfirmationResult> => {
    if (isRecaptchaSettingUp) {
      throw new Error('Please wait, a previous request is still processing.');
    }
    setLoginLoading(true);
    try {
      setAuthLoading(true);
      isRecaptchaSettingUp = true;

      // Clear existing verifier first
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
        } catch (e) {
          reportAuthContextError(e, 'auth.recaptcha.clear_login_with_phone');
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
        'callback': () => {},
        'expired-callback': () => {
          notify.error(authMessages.recaptchaExpired);
        }
      });

      window.recaptchaVerifier = recaptchaVerifier;

      // Send OTP
      const confirmation = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);

      // DON'T clean up here - keep recaptcha active until OTP is verified
      return confirmation;
    } catch (error) {
      // Clean up on error only
      cleanupRecaptcha();
      reportAuthContextError(error, 'auth.phone_login');
      throw error;
    } finally {
      isRecaptchaSettingUp = false;
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
      const userRef = doc(db, COLLECTIONS.USERS, userCredential.user.uid);

      // Fetch user data first
      let userDoc: DocumentSnapshot;
      try {
        userDoc = await getUserDocSnapshot(userRef);
      } catch (userReadError) {
        await captureFirestoreOperationError(userReadError, {
          scope: 'auth',
          kind: 'auth.phone_login.user_doc_read',
          operation: 'getDoc',
          collection: COLLECTIONS.USERS,
          docId: userCredential.user.uid,
          blocking: true,
          phase: 'otp_verify',
          portalRole: 'donor',
        });
        throw userReadError;
      }

      if (!userDoc.exists()) {
        const matches = await findUsersByPhone(normalizedPhone);

        if (matches.length === 0) {
          await cleanupAuthSession({
            scope: 'auth',
            kind: 'auth.phone_login.not_registered_cleanup',
            metadata: { page: 'AuthContext' },
            extraCleanup: () => {
              localStorage.removeItem(userCacheKey);
              localStorage.removeItem(userCacheAtKey);
              clearAuthOwnedSessionStorage();
            },
          });
          throw new PhoneAuthError('User not registered', 'not_registered');
        }

        if (matches.length > 1) {
          await cleanupAuthSession({
            scope: 'auth',
            kind: 'auth.phone_login.multiple_accounts_cleanup',
            metadata: { page: 'AuthContext' },
            extraCleanup: () => {
              localStorage.removeItem(userCacheKey);
              localStorage.removeItem(userCacheAtKey);
              clearAuthOwnedSessionStorage();
            },
          });
          throw new PhoneAuthError('Phone number linked to multiple accounts', 'multiple_accounts');
        }

        const matchedUser = matches[0];
        const matchedUid = matchedUser.uid || matchedUser.id;

        if (matchedUser.role === 'superadmin') {
          await cleanupAuthSession({
            scope: 'auth',
            kind: 'auth.phone_login.superadmin_google_only_cleanup',
            metadata: { page: 'AuthContext' },
            extraCleanup: () => {
              localStorage.removeItem(userCacheKey);
              localStorage.removeItem(userCacheAtKey);
              clearAuthOwnedSessionStorage();
            },
          });
          throw new PhoneAuthError(authMessages.superadminGoogleOnly, 'superadmin_google_only');
        }
        if (matchedUser.role && matchedUser.role !== 'donor') {
          await cleanupAuthSession({
            scope: 'auth',
            kind: 'auth.phone_login.role_mismatch_cleanup',
            metadata: { page: 'AuthContext' },
            extraCleanup: () => {
              localStorage.removeItem(userCacheKey);
              localStorage.removeItem(userCacheAtKey);
              clearAuthOwnedSessionStorage();
            },
          });
          throw new PhoneAuthError(authMessages.roleMismatch.donor, 'role_mismatch');
        }

        if (matchedUid && matchedUid !== userCredential.user.uid) {
          savePendingPhoneLink({
            phoneNumber: normalizedPhone,
            targetUid: matchedUid
          });

          try {
            await userCredential.user.delete();
          } catch (deleteError) {
            reportAuthContextError(deleteError, 'auth.phone_login.temp_user_delete');
            await cleanupAuthSession({
              scope: 'auth',
              kind: 'auth.phone_login.temp_user_delete_failed_cleanup',
              metadata: { page: 'AuthContext' },
              extraCleanup: () => {
                localStorage.removeItem(userCacheKey);
                localStorage.removeItem(userCacheAtKey);
                clearAuthOwnedSessionStorage();
              },
            });
            throw new PhoneAuthError(
              'Failed to clear temporary login. Please contact support.',
              'temp_user_delete_failed'
            );
          }

          await cleanupAuthSession({
            scope: 'auth',
            kind: 'auth.phone_login.link_required_cleanup',
            metadata: { page: 'AuthContext' },
            extraCleanup: () => {
              localStorage.removeItem(userCacheKey);
              localStorage.removeItem(userCacheAtKey);
              clearAuthOwnedSessionStorage();
            },
          });
          throw new PhoneAuthError(
            authMessages.phoneAlreadyRegisteredLinkGoogle,
            'link_required'
          );
        }

        await cleanupAuthSession({
          scope: 'auth',
          kind: 'auth.phone_login.not_registered_fallback_cleanup',
          metadata: { page: 'AuthContext' },
          extraCleanup: () => {
            localStorage.removeItem(userCacheKey);
            localStorage.removeItem(userCacheAtKey);
            clearAuthOwnedSessionStorage();
          },
        });
        throw new PhoneAuthError('User not registered', 'not_registered');
      }

      const userData = userDoc.data() as User;

      const existingMatchesForExistingUser = await findUsersByPhone(normalizedPhone);
      const conflictUser = existingMatchesForExistingUser.find(match => {
        const matchUid = match.uid || match.id;
        return matchUid !== userCredential.user.uid;
      });

      if (conflictUser) {
        await cleanupAuthSession({
          scope: 'auth',
          kind: 'auth.phone_login.multiple_accounts_existing_cleanup',
          metadata: { page: 'AuthContext' },
          extraCleanup: () => {
            localStorage.removeItem(userCacheKey);
            localStorage.removeItem(userCacheAtKey);
            clearAuthOwnedSessionStorage();
          },
        });
        throw new PhoneAuthError('Phone number linked to multiple accounts', 'multiple_accounts');
      }

      if (userData.role === 'superadmin') {
        await cleanupAuthSession({
          scope: 'auth',
          kind: 'auth.phone_login.superadmin_existing_cleanup',
          metadata: { page: 'AuthContext' },
          extraCleanup: () => {
            localStorage.removeItem(userCacheKey);
            localStorage.removeItem(userCacheAtKey);
            clearAuthOwnedSessionStorage();
          },
        });
        throw new PhoneAuthError(authMessages.superadminGoogleOnly, 'superadmin_google_only');
      }
      if (userData.role && userData.role !== 'donor') {
        await cleanupAuthSession({
          scope: 'auth',
          kind: 'auth.phone_login.role_mismatch_existing_cleanup',
          metadata: { page: 'AuthContext' },
          extraCleanup: () => {
            localStorage.removeItem(userCacheKey);
            localStorage.removeItem(userCacheAtKey);
            clearAuthOwnedSessionStorage();
          },
        });
        throw new PhoneAuthError(authMessages.roleMismatch.donor, 'role_mismatch');
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
        reportAuthContextError(err, 'auth.phone_login.last_login_update')
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
      reportAuthContextError(error, 'auth.otp.verify');

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

    if (isRecaptchaSettingUp) {
      throw new Error('Please wait, a previous request is still processing.');
    }
    
    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    if (normalizedPhone) {
      const existingMatches = await findUsersByPhone(normalizedPhone);
      const conflictUser = existingMatches.find(match => {
        const matchUid = match.uid || match.id;
        return matchUid !== auth.currentUser!.uid;
      });
      if (conflictUser) {
        throw new PhoneAuthError('This phone number is already registered to another account.', 'multiple_accounts');
      }
    }

    isRecaptchaSettingUp = true;

    try {
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
        } catch (e) {
          reportAuthContextError(e, 'auth.recaptcha.clear_start_phone_link');
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
        'callback': () => {},
        'expired-callback': () => {
          notify.error(authMessages.recaptchaExpired);
        }
      });

      window.recaptchaVerifier = recaptchaVerifier;

      const confirmation = await linkWithPhoneNumber(auth.currentUser, phoneNumber, recaptchaVerifier);
      return confirmation;
    } catch (error) {
      cleanupRecaptcha();
      throw error;
    } finally {
      isRecaptchaSettingUp = false;
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

      if (normalizedPhone) {
        const existingMatches = await findUsersByPhone(normalizedPhone);
        const conflictUser = existingMatches.find(match => {
          const matchUid = match.uid || match.id;
          return matchUid !== auth.currentUser!.uid;
        });
        if (conflictUser) {
          try {
            await unlink(auth.currentUser!, 'phone');
          } catch (e) {
            reportAuthContextError(e, 'auth.phone_link.rollback_unlink');
          }
          throw new PhoneAuthError('This phone number is already registered to another account.', 'multiple_accounts');
        }
      }

      const updatePayload: Record<string, any> = {};
      if (phoneNumber) {
        updatePayload.phoneNumber = phoneNumber;
      }
      if (normalizedPhone) {
        updatePayload.phoneNumberNormalized = normalizedPhone;
      }

      if (Object.keys(updatePayload).length > 0) {
        await runOwnerUserWriteWithRetry({
          uid: auth.currentUser.uid,
          write: () => updateDoc(doc(db, COLLECTIONS.USERS, auth.currentUser!.uid), updatePayload),
          restFallbackPatch: updatePayload,
          restFallbackMode: 'patch',
        });
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

    if (isRecaptchaSettingUp) {
      throw new Error('Please wait, a previous request is still processing.');
    }
    
    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    if (normalizedPhone) {
      const existingMatches = await findUsersByPhone(normalizedPhone);
      const conflictUser = existingMatches.find(match => {
        const matchUid = match.uid || match.id;
        return matchUid !== auth.currentUser!.uid;
      });
      if (conflictUser) {
        throw new PhoneAuthError('This phone number is already registered to another account.', 'multiple_accounts');
      }
    }

    isRecaptchaSettingUp = true;

    try {
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
        } catch (e) {
          reportAuthContextError(e, 'auth.recaptcha.clear_start_phone_update');
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
        'callback': () => {},
        'expired-callback': () => {
          notify.error(authMessages.recaptchaExpired);
        }
      });

      window.recaptchaVerifier = recaptchaVerifier;

      const confirmation = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
      return confirmation;
    } catch (error) {
      cleanupRecaptcha();
      throw error;
    } finally {
      isRecaptchaSettingUp = false;
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
      const normalizedPhoneForCheck = normalizePhoneNumber(phoneNumber);
      if (normalizedPhoneForCheck) {
        const existingMatches = await findUsersByPhone(normalizedPhoneForCheck);
        const conflictUser = existingMatches.find(match => {
          const matchUid = match.uid || match.id;
          return matchUid !== auth.currentUser!.uid;
        });
        if (conflictUser) {
          throw new PhoneAuthError('This phone number is already registered to another account.', 'multiple_accounts');
        }
      }

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
        await runOwnerUserWriteWithRetry({
          uid: auth.currentUser.uid,
          write: () => updateDoc(doc(db, COLLECTIONS.USERS, auth.currentUser!.uid), updatePayload),
          restFallbackPatch: updatePayload,
          restFallbackMode: 'patch',
        });
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
    await updateDoc(doc(db, COLLECTIONS.USERS, auth.currentUser.uid), {
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
      const userRef = doc(db, COLLECTIONS.USERS, result.user.uid);
      const userDoc = await getUserDocSnapshot(userRef);

      if (!userDoc.exists()) {
        await cleanupAuthSession({
          scope: 'auth',
          kind: 'auth.email_login.not_registered_cleanup',
          metadata: { page: 'AuthContext' },
          extraCleanup: () => {
            localStorage.removeItem(userCacheKey);
            localStorage.removeItem(userCacheAtKey);
            clearAuthOwnedSessionStorage();
          },
        });
        throw new Error('User not registered. Please register first.');
      }

      // Get the token
      const token = await result.user.getIdToken();

      const userDocData = userDoc.data() as User;
      if (userDocData.role === 'superadmin') {
        await cleanupAuthSession({
          scope: 'auth',
          kind: 'auth.email_login.superadmin_google_only_cleanup',
          metadata: { page: 'AuthContext' },
          extraCleanup: () => {
            localStorage.removeItem(userCacheKey);
            localStorage.removeItem(userCacheAtKey);
            clearAuthOwnedSessionStorage();
          },
        });
        throw new Error(authMessages.superadminGoogleOnly);
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
        reportAuthContextError(err, 'auth.email_login.last_login_update')
      );

      // Update user state immediately
      setUser(userDataToReturn);
      recentLoginRef.current = { uid: userDataToReturn.uid, at: Date.now(), user: userDataToReturn };

      return {
        token,
        user: userDataToReturn
      };
    } catch (error: any) {
      reportAuthContextError(error, 'auth.email_login');

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

      notify.error(errorMessage);
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

      notify.success('Registration successful! Please check your email for verification.');

      return result.user;
    } catch (error: any) {
      reportAuthContextError(error, 'auth.email_register');

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

      notify.error(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setAuthLoading(false);
    }
  };

  const resetPassword = async (email: string): Promise<void> => {
    try {
      await sendPasswordResetEmail(auth, email);
      notify.success('Password reset email sent! Please check your inbox.');
    } catch (error: any) {
      reportAuthContextError(error, 'auth.password_reset');

      let errorMessage = 'Failed to send password reset email';
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      notify.error(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const loginWithGoogle = async (): Promise<LoginResponse> => {
    let shouldSignOutAfterFailure = false;
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
      let phoneLinkRequiresFreshOtp = false;
      let pendingPhoneNumber: string | null = null;
      if (pendingLink) {
        shouldSignOutAfterFailure = true;
        if (pendingLink.targetUid && pendingLink.targetUid !== result.user.uid) {
          clearPendingPhoneLink();
          await cleanupAuthSession({
            scope: 'auth',
            kind: 'auth.google_login.pending_link_target_mismatch_cleanup',
            metadata: { page: 'AuthContext' },
            extraCleanup: () => {
              localStorage.removeItem(userCacheKey);
              localStorage.removeItem(userCacheAtKey);
              clearAuthOwnedSessionStorage();
            },
          });
          throw new Error('Please sign in with the account linked to this phone number.');
        }
        pendingPhoneNumber = pendingLink.phoneNumber;
        phoneLinkRequiresFreshOtp = true;
        clearPendingPhoneLink();
      }

      // Check if user exists before proceeding
      const userRef = doc(db, COLLECTIONS.USERS, result.user.uid);
      const userDoc = await getUserDocSnapshot(userRef);

      if (!userDoc.exists()) {
        await cleanupAuthSession({
          scope: 'auth',
          kind: 'auth.google_login.not_registered_cleanup',
          metadata: { page: 'AuthContext' },
          extraCleanup: () => {
            localStorage.removeItem(userCacheKey);
            localStorage.removeItem(userCacheAtKey);
            clearAuthOwnedSessionStorage();
          },
        });
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
        reportAuthContextError(err, 'auth.google_login.last_login_update')
      );

      // Update user state immediately for navigation
      setUser(userDataToReturn);
      recentLoginRef.current = { uid: userDataToReturn.uid, at: Date.now(), user: userDataToReturn };
      if (phoneLinkRequiresFreshOtp && pendingPhoneNumber) {
        const continuation = {
          phoneNumber: pendingPhoneNumber,
          targetUid: userDataToReturn.uid,
        };
        savePendingPhoneLinkContinuation(continuation);
        setPendingPhoneLinkContinuation({
          ...continuation,
          createdAt: Date.now(),
        });
      }

      return {
        token,
        user: userDataToReturn,
        ...(phoneLinkRequiresFreshOtp ? {
          phoneLinkRequiresFreshOtp: true,
        } : {}),
      };
    } catch (error) {
      if (shouldSignOutAfterFailure && auth.currentUser) {
        await cleanupAuthSession({
          scope: 'auth',
          kind: 'auth.google_login.rollback_signout',
          metadata: { page: 'AuthContext' },
          extraCleanup: () => {
            localStorage.removeItem(userCacheKey);
            localStorage.removeItem(userCacheAtKey);
            clearAuthOwnedSessionStorage();
          },
        });
      }
      reportAuthContextError(error, 'auth.google_login');
      throw error;
    }
  };

  const handleLogout = async () => {
    let signOutFailed = false;

    try {
      // Clear user state early so dashboards unmount listeners before sign-out.
      setUser(null);
      await new Promise(resolve => setTimeout(resolve, ZERO_MS));
    } catch {
      // ignore
    }

    try {
      if (!firestoreNetworkDisabledRef.current) {
        await disableNetwork(db);
        firestoreNetworkDisabledRef.current = true;
      }
    } catch (error) {
      reportAuthContextError(error, 'auth.logout.firestore_disable');
    }

    try {
      await auth.signOut();
    } catch (error) {
      signOutFailed = true;
      reportAuthContextError(error, 'auth.logout.signout');
    }

    try {
      localStorage.removeItem('authToken');
      clearAuthOwnedSessionStorage();
      // Clear any other auth-related storage
      localStorage.removeItem('user');
      localStorage.removeItem('lastLoginTime');
      localStorage.removeItem(userCacheKey);
      localStorage.removeItem(userCacheAtKey);
      localStorage.removeItem(impersonationStorageKey);
      // Optional: Clear any cached data
      indexedDB.deleteDatabase('firebaseLocalStorageDb');
    } catch (error) {
      reportAuthContextError(error, 'auth.logout.local_cleanup');
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
        ? ROUTES.portal.ngo.login
        : resolvedRole === 'bloodbank'
          ? ROUTES.portal.bloodbank.login
          : resolvedRole === 'admin'
            ? ROUTES.portal.admin.login
            : resolvedRole === 'donor'
              ? ROUTES.portal.donor.login
              : ROUTES.portal.admin.login
    );
    const { showToast = true } = options;
    let hadError = false;
    try {
      await handleLogout();
    } catch (error) {
      hadError = true;
      reportAuthContextError(error, 'auth.logout');
    }

    setPortalRole(null);

    try {
      // Broadcast logout event to other tabs
      logoutChannelRef.current?.postMessage('logout');
    } catch (error) {
      reportAuthContextError(error, 'auth.logout.broadcast');
    }

    if (showToast) {
      if (hadError) {
        notify.error('Failed to log out. Please try again.');
      } else {
        notify.success('Successfully logged out!');
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
    const bootstrapRole = !isPrivileged ? (readPendingPortalRole() || readRegistrationIntent()) : null;
    let profilePatchFieldKeys: string[] = [];
    if (!isPrivileged) {
      if (Object.prototype.hasOwnProperty.call(sanitizedData, 'role')) {
        delete sanitizedData.role;
      }
      if (Object.prototype.hasOwnProperty.call(sanitizedData, 'breakGlass')) {
        delete sanitizedData.breakGlass;
      }
    }
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

      const hasMeaningfulPatch = Object.keys(sanitizedData).some((key) => {
        const typedKey = key as keyof User;
        return !isSameProfileValue(user[typedKey], sanitizedData[typedKey]);
      });

      if (!hasMeaningfulPatch && !phoneNumberNormalized && !generatedBhId && user.onboardingCompleted === true) {
        return;
      }

      if (bootstrapRole && !user.createdAt && auth.currentUser) {
        const bootstrapPatch = {
          uid: auth.currentUser.uid,
          email: auth.currentUser.email || user.email || null,
          displayName: user.displayName || auth.currentUser.displayName || null,
          photoURL: auth.currentUser.photoURL || user.photoURL || null,
          phoneNumber: user.phoneNumber || auth.currentUser.phoneNumber || null,
          ...(phoneNumberNormalized ? { phoneNumberNormalized } : {}),
          role: bootstrapRole,
          onboardingCompleted: false,
          createdAt: new Date(),
          lastLoginAt: new Date(),
          ...(user.referredByUid ? { referredByUid: user.referredByUid } : {}),
          ...(user.referredByBhId ? { referredByBhId: user.referredByBhId } : {}),
        };
        try {
          await runOwnerUserWriteWithRetry({
            uid: user.uid,
            write: () => ensureBootstrapUserDocument({
              firebaseUser: auth.currentUser!,
              role: bootstrapRole,
              currentUser: user,
              phoneNumberNormalized,
            }),
            restFallbackPatch: bootstrapPatch,
            restFallbackMode: 'create',
          });
        } catch (bootstrapError) {
          const diagnosticMetadata = await buildUserWriteDiagnosticMetadata({
            userId: user.uid,
            payload: {
              ...bootstrapPatch,
              createdAt: '[clientDate]',
              lastLoginAt: '[clientDate]',
            },
            payloadLabel: 'onboarding_profile_bootstrap',
          });
          await captureFirestoreOperationError(bootstrapError, {
            scope: 'auth',
            kind: 'auth.profile_update.bootstrap',
            operation: 'setDoc',
            collection: COLLECTIONS.USERS,
            docId: user.uid,
            blocking: true,
            phase: 'onboarding_profile_bootstrap',
            portalRole: bootstrapRole,
            metadata: {
              firestoreFieldKeys: Object.keys(bootstrapPatch).sort(),
              firestoreTransportFallbackEnabled: true,
              ...diagnosticMetadata,
            },
          });
          throw bootstrapError;
        }
      }

      const profilePatch = {
        ...sanitizedData,
        ...(phoneNumberNormalized ? { phoneNumberNormalized } : {}),
        onboardingCompleted: true,
        ...(existingBhId ? {} : generatedBhId ? { bhId: generatedBhId } : {}),
      };
      profilePatchFieldKeys = Object.keys(profilePatch).sort();

      await runOwnerUserWriteWithRetry({
        uid: user.uid,
        write: () => setDoc(
          doc(db, COLLECTIONS.USERS, user.uid),
          {
            ...profilePatch,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        ),
        restFallbackPatch: profilePatch as Record<string, any>,
      });
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
      const nextRole = sanitizedData.role ?? user.role ?? bootstrapRole ?? undefined;
      const nextUser = {
        ...user,
        ...sanitizedData,
        ...(nextRole ? { role: nextRole } : {}),
        ...(phoneNumberNormalized ? { phoneNumberNormalized } : {}),
        onboardingCompleted: true,
        bhId: user.bhId || generatedBhId || undefined
      } as User;

      const nextStatus = sanitizedData.status ?? user.status;
      const nextOnboarding = sanitizedData.onboardingCompleted ?? true;
      const canPublishPublicDonor = nextRole === 'donor'
        && nextOnboarding === true
        && (!nextStatus || nextStatus === 'active');

      if (canPublishPublicDonor) {
        try {
          await setDoc(
            doc(db, COLLECTIONS.PUBLIC_DONORS, user.uid),
            {
              ...buildPublicDonorPayload(nextUser),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        } catch (publicError) {
          reportAuthContextError(publicError, 'auth.profile_update.public_donor');
        }
      }

      setUser(prev => ({
        ...prev,
        ...sanitizedData,
        ...(nextRole ? { role: nextRole } : {}),
        ...(phoneNumberNormalized ? { phoneNumberNormalized } : {}),
        onboardingCompleted: true, // Ensure this is updated in the state
        bhId: prev?.bhId || generatedBhId || undefined
      } as User));
      clearRegistrationIntent();
      clearPendingPortalRole();
    } catch (error) {
      const diagnosticMetadata = await buildUserWriteDiagnosticMetadata({
        userId: user.uid,
        payload: {
          ...sanitizedData,
          ...(sanitizedData.phoneNumber
            ? { phoneNumberNormalized: normalizePhoneNumber(sanitizedData.phoneNumber) }
            : {}),
          onboardingCompleted: true,
        },
        payloadLabel: 'onboarding_profile_update',
      });
      void captureFirestoreOperationError(error, {
        scope: 'auth',
        kind: 'auth.profile_update',
        operation: 'setDoc',
        collection: COLLECTIONS.USERS,
        docId: user.uid,
        blocking: true,
        phase: 'onboarding_profile_update',
        portalRole: user.role || null,
        metadata: {
          firestoreFieldKeys: profilePatchFieldKeys,
          firestoreTransportFallbackEnabled: true,
          ...diagnosticMetadata,
        },
      });
      reportAuthContextError(error, 'auth.profile_update');
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
      pendingPhoneLinkContinuation,
      clearPendingPhoneLinkContinuation,
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
