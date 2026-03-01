import { captureHandledError } from '../services/errorLog.service';
import { ONE_DAY_MS } from '../constants/time';

const referralCookieName = 'bh_referrer';
const referralStorageKey = 'bh_referrer_meta';
const referralUidStorageKey = 'bh_referrer_uid';
const referralSessionKey = 'bh_referrer_meta_session';
const referralUidSessionKey = 'bh_referrer_uid_session';
const referralMaxAgeDays = 30;

type ReferralMeta = {
  bhId: string;
  capturedAt: number;
};

const readCookie = () => {
  if (typeof document === 'undefined') return null;
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.split('=');
    if (name?.trim() === referralCookieName) {
      return decodeURIComponent(value || '').trim();
    }
  }
  return null;
};

const writeCookie = (bhId: string) => {
  if (typeof document === 'undefined') return;
  const maxAge = referralMaxAgeDays * 24 * 60 * 60;
  document.cookie = `${referralCookieName}=${encodeURIComponent(bhId)}; max-age=${maxAge}; path=/`;
};

const removeCookie = () => {
  if (typeof document === 'undefined') return;
  document.cookie = `${referralCookieName}=; max-age=0; path=/`;
};

const safeSet = (storage: Storage | undefined, key: string, value: string) => {
  if (!storage) return;
  try {
    storage.setItem(key, value);
  } catch {
    // Storage may be unavailable (private mode, quota, etc.)
  }
};

const safeGet = (storage: Storage | undefined, key: string) => {
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
};

const safeRemove = (storage: Storage | undefined, key: string) => {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // Ignore removal errors.
  }
};

export const setReferralTracking = (bhId: string) => {
  if (!bhId) return;
  writeCookie(bhId);
  if (typeof window !== 'undefined') {
    const meta: ReferralMeta = {
      bhId,
      capturedAt: Date.now(),
    };
    const payload = JSON.stringify(meta);
    safeSet(localStorage, referralStorageKey, payload);
    safeSet(sessionStorage, referralSessionKey, payload);
  }
};

export const setReferralReferrerUid = (referrerUid: string) => {
  if (!referrerUid) return;
  if (typeof window !== 'undefined') {
    safeSet(localStorage, referralUidStorageKey, referrerUid);
    safeSet(sessionStorage, referralUidSessionKey, referrerUid);
  }
};

export const getReferralTracking = () => {
  const now = Date.now();
  const maxAgeMs = referralMaxAgeDays * ONE_DAY_MS;
  if (typeof window !== 'undefined') {
    const raw =
      safeGet(localStorage, referralStorageKey)
      || safeGet(sessionStorage, referralSessionKey);
    if (raw) {
      try {
        const meta = JSON.parse(raw) as ReferralMeta;
        if (meta.capturedAt && now - meta.capturedAt <= maxAgeMs && meta.bhId) {
          return meta.bhId;
        }
      } catch (error) {
        void captureHandledError(error, {
          source: 'frontend',
          scope: 'unknown',
          metadata: { kind: 'referral_tracking.parse_meta' },
        });
      }
    }
  }

  const cookieValue = readCookie();
  if (cookieValue) {
    setReferralTracking(cookieValue);
    return cookieValue;
  }

  return null;
};

export const getReferralReferrerUid = () => {
  if (typeof window === 'undefined') return null;
  const value =
    safeGet(localStorage, referralUidStorageKey)
    || safeGet(sessionStorage, referralUidSessionKey);
  return value || null;
};

export const clearReferralTracking = () => {
  removeCookie();
  if (typeof window !== 'undefined') {
    safeRemove(localStorage, referralStorageKey);
    safeRemove(localStorage, referralUidStorageKey);
    safeRemove(sessionStorage, referralSessionKey);
    safeRemove(sessionStorage, referralUidSessionKey);
  }
};
