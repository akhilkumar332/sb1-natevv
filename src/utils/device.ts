const DEVICE_ID_KEY = 'fcmDeviceId';

export interface DeviceInfo {
  userAgent?: string;
  platform?: string;
  vendor?: string;
  language?: string;
  timezone?: string;
  screen?: {
    width: number;
    height: number;
    pixelRatio: number;
  };
  memoryGB?: number;
  cores?: number;
  touch?: boolean;
}

const generateDeviceId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const timePart = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${timePart}${randomPart}`;
};

export const getDeviceId = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const id = generateDeviceId();
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return null;
  }
};

export const getDeviceInfo = (): DeviceInfo | null => {
  if (typeof window === 'undefined') return null;
  try {
    const screenInfo = typeof screen !== 'undefined'
      ? {
          width: screen.width,
          height: screen.height,
          pixelRatio: typeof window.devicePixelRatio === 'number' ? window.devicePixelRatio : 1,
        }
      : undefined;

    const timezone = (() => {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
      } catch {
        return undefined;
      }
    })();

    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      vendor: navigator.vendor,
      language: navigator.language,
      timezone,
      screen: screenInfo,
      memoryGB: typeof (navigator as any).deviceMemory === 'number' ? (navigator as any).deviceMemory : undefined,
      cores: typeof navigator.hardwareConcurrency === 'number' ? navigator.hardwareConcurrency : undefined,
      touch: 'maxTouchPoints' in navigator ? navigator.maxTouchPoints > 0 : undefined,
    };
  } catch {
    return null;
  }
};
