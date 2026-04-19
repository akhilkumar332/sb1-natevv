import { CMS_DEFAULTS, CMS_FRONTEND_ACCESS_MODE, CMS_LIMITS, type CmsFrontendAccessMode } from '../constants/cms';
import { ROUTES } from '../constants/routes';
import type { CmsSettings } from '../types/database.types';

export type FrontendAccessSettings = NonNullable<CmsSettings['frontendAccess']>;
const FRONTEND_ACCESS_CACHE_KEY = 'bh_frontend_access_snapshot';
const FRONTEND_ACCESS_CACHE_MAX_AGE_MS = 5 * 60 * 1000;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const truncate = (value: unknown, max: number, fallback: string): string => {
  const text = typeof value === 'string' ? value.trim() : '';
  return (text || fallback).slice(0, max);
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
    const raw = window.sessionStorage.getItem(FRONTEND_ACCESS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt?: unknown; value?: unknown };
    const savedAt = Number(parsed?.savedAt);
    if (!Number.isFinite(savedAt) || Date.now() - savedAt > FRONTEND_ACCESS_CACHE_MAX_AGE_MS) {
      window.sessionStorage.removeItem(FRONTEND_ACCESS_CACHE_KEY);
      return null;
    }
    return normalizeFrontendAccess(parsed.value);
  } catch {
    return null;
  }
};

export const writeCachedFrontendAccess = (value: unknown): void => {
  if (typeof window === 'undefined') return;
  try {
    const normalized = normalizeFrontendAccess(value);
    window.sessionStorage.setItem(FRONTEND_ACCESS_CACHE_KEY, JSON.stringify({
      savedAt: Date.now(),
      value: normalized,
    }));
  } catch {
    // Ignore storage failures so the gate still works without sessionStorage.
  }
};
