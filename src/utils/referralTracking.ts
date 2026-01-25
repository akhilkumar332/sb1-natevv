const referralCookieName = 'bh_referrer';
const referralStorageKey = 'bh_referrer_meta';
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

export const setReferralTracking = (bhId: string) => {
  if (!bhId) return;
  writeCookie(bhId);
  if (typeof window !== 'undefined') {
    const meta: ReferralMeta = {
      bhId,
      capturedAt: Date.now(),
    };
    localStorage.setItem(referralStorageKey, JSON.stringify(meta));
  }
};

export const getReferralTracking = () => {
  const now = Date.now();
  const maxAgeMs = referralMaxAgeDays * 24 * 60 * 60 * 1000;
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(referralStorageKey);
    if (raw) {
      try {
        const meta = JSON.parse(raw) as ReferralMeta;
        if (meta.capturedAt && now - meta.capturedAt <= maxAgeMs && meta.bhId) {
          return meta.bhId;
        }
      } catch (error) {
        console.warn('Failed to parse referral metadata:', error);
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

export const clearReferralTracking = () => {
  removeCookie();
  if (typeof window !== 'undefined') {
    localStorage.removeItem(referralStorageKey);
  }
};
