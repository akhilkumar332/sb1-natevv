import { CMS_DEFAULTS, CMS_FRONTEND_ACCESS, CMS_FRONTEND_ACCESS_MODE, CMS_LIMITS, type CmsFrontendAccessMode } from '../constants/cms';
import { ROUTES } from '../constants/routes';
import type { CmsSettings } from '../types/database.types';

export type FrontendAccessSettings = NonNullable<CmsSettings['frontendAccess']>;
let frontendAccessCacheSnapshot: { savedAt: number; value: FrontendAccessSettings } | null = null;

export type FrontendAccessCountdown = {
  expired: boolean;
  totalMsRemaining: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const truncate = (value: unknown, max: number, fallback: string): string => {
  const text = typeof value === 'string' ? value.trim() : '';
  return (text || fallback).slice(0, max);
};

export const normalizeFrontendAccessDateTime = (value: unknown): string | null => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) return null;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

export const toDateTimeLocalValue = (value: string | null | undefined): string => {
  const normalized = normalizeFrontendAccessDateTime(value);
  if (!normalized) return '';
  const date = new Date(normalized);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const fromDateTimeLocalValue = (value: string): string | null => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) return null;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

export const getFrontendAccessCountdown = (
  value: string | null | undefined,
  nowMs: number = Date.now(),
): FrontendAccessCountdown | null => {
  const normalized = normalizeFrontendAccessDateTime(value);
  if (!normalized) return null;
  const totalMsRemaining = Math.max(0, new Date(normalized).getTime() - nowMs);
  const totalSecondsRemaining = Math.floor(totalMsRemaining / 1000);
  const days = Math.floor(totalSecondsRemaining / 86400);
  const hours = Math.floor((totalSecondsRemaining % 86400) / 3600);
  const minutes = Math.floor((totalSecondsRemaining % 3600) / 60);
  const seconds = totalSecondsRemaining % 60;
  return {
    expired: totalMsRemaining === 0,
    totalMsRemaining,
    days,
    hours,
    minutes,
    seconds,
  };
};

export const isFrontendAccessMode = (value: unknown): value is CmsFrontendAccessMode => (
  value === CMS_FRONTEND_ACCESS_MODE.open
  || value === CMS_FRONTEND_ACCESS_MODE.maintenance
  || value === CMS_FRONTEND_ACCESS_MODE.passwordProtected
);

export const normalizeFrontendAccess = (value: unknown): FrontendAccessSettings => {
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const rawSessionTtl = Number(data.passwordSessionTtlMinutes);
  return {
    mode: isFrontendAccessMode(data.mode) ? data.mode : CMS_DEFAULTS.frontendAccess.mode,
    maintenanceTitle: truncate(
      data.maintenanceTitle,
      CMS_LIMITS.frontendAccessTitle,
      CMS_DEFAULTS.frontendAccess.maintenanceTitle
    ),
    maintenanceMessage: truncate(
      data.maintenanceMessage,
      CMS_LIMITS.frontendAccessMessage,
      CMS_DEFAULTS.frontendAccess.maintenanceMessage
    ),
    maintenanceEta: truncate(data.maintenanceEta, CMS_LIMITS.frontendAccessEta, ''),
    maintenanceEndsAt: normalizeFrontendAccessDateTime(data.maintenanceEndsAt),
    passwordPromptTitle: truncate(
      data.passwordPromptTitle,
      CMS_LIMITS.frontendAccessTitle,
      CMS_DEFAULTS.frontendAccess.passwordPromptTitle
    ),
    passwordPromptMessage: truncate(
      data.passwordPromptMessage,
      CMS_LIMITS.frontendAccessMessage,
      CMS_DEFAULTS.frontendAccess.passwordPromptMessage
    ),
    passwordSessionTtlMinutes: Number.isFinite(rawSessionTtl)
      ? clamp(Math.floor(rawSessionTtl), 5, 24 * 7)
      : CMS_DEFAULTS.frontendAccess.passwordSessionTtlMinutes,
  };
};

export const isAdminRoutePath = (pathname: string): boolean => (
  pathname === '/admin'
  || pathname === ROUTES.portal.admin.login
  || pathname.startsWith(`${ROUTES.portal.admin.dashboard.root}`)
  || pathname === ROUTES.portal.admin.onboarding
  || pathname.startsWith('/admin/')
);

export const readCachedFrontendAccess = (): FrontendAccessSettings | null => {
  if (typeof window === 'undefined') return null;
  try {
    if (!frontendAccessCacheSnapshot) return null;
    const savedAt = Number(frontendAccessCacheSnapshot.savedAt);
    if (!Number.isFinite(savedAt) || Date.now() - savedAt > CMS_FRONTEND_ACCESS.cacheMaxAgeMs) {
      frontendAccessCacheSnapshot = null;
      return null;
    }
    return normalizeFrontendAccess(frontendAccessCacheSnapshot.value);
  } catch {
    return null;
  }
};

export const writeCachedFrontendAccess = (value: unknown): void => {
  if (typeof window === 'undefined') return;
  try {
    const normalized = normalizeFrontendAccess(value);
    frontendAccessCacheSnapshot = {
      savedAt: Date.now(),
      value: normalized,
    };
  } catch {
    // Ignore storage failures so the gate still works without sessionStorage.
  }
};

export const __setCachedFrontendAccessForTest = (snapshot: {
  savedAt: number;
  value: FrontendAccessSettings;
} | null): void => {
  frontendAccessCacheSnapshot = snapshot;
};

export const __resetCachedFrontendAccessForTest = (): void => {
  frontendAccessCacheSnapshot = null;
};
