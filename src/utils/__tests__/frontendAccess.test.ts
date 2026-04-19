import { describe, expect, it } from 'vitest';
import { CMS_DEFAULTS, CMS_FRONTEND_ACCESS_MODE } from '../../constants/cms';
import { ROUTES } from '../../constants/routes';
import {
  fromDateTimeLocalValue,
  getFrontendAccessCountdown,
  isAdminRoutePath,
  normalizeFrontendAccess,
  normalizeFrontendAccessDateTime,
  toDateTimeLocalValue,
} from '../frontendAccess';

describe('normalizeFrontendAccess', () => {
  it('returns safe defaults for missing input', () => {
    expect(normalizeFrontendAccess(null)).toEqual(CMS_DEFAULTS.frontendAccess);
  });

  it('normalizes invalid mode and clamps session ttl', () => {
    expect(normalizeFrontendAccess({
      mode: 'invalid',
      passwordSessionTtlMinutes: 1,
    })).toMatchObject({
      mode: CMS_FRONTEND_ACCESS_MODE.open,
      passwordSessionTtlMinutes: 5,
    });
  });

  it('preserves supported mode and trims copy fields', () => {
    const result = normalizeFrontendAccess({
      mode: CMS_FRONTEND_ACCESS_MODE.passwordProtected,
      maintenanceTitle: '  title  ',
      passwordPromptMessage: '  Enter access  ',
      passwordSessionTtlMinutes: 500,
    });

    expect(result).toMatchObject({
      mode: CMS_FRONTEND_ACCESS_MODE.passwordProtected,
      maintenanceTitle: 'title',
      passwordPromptMessage: 'Enter access',
      passwordSessionTtlMinutes: 168,
    });
  });

  it('normalizes maintenance end time when valid', () => {
    const result = normalizeFrontendAccess({
      mode: CMS_FRONTEND_ACCESS_MODE.maintenance,
      maintenanceEndsAt: '2026-04-20T10:30',
    });

    expect(result.maintenanceEndsAt).toMatch(/^2026-04-20T/);
  });
});

describe('isAdminRoutePath', () => {
  it('detects admin login and dashboard paths', () => {
    expect(isAdminRoutePath(ROUTES.portal.admin.login)).toBe(true);
    expect(isAdminRoutePath(ROUTES.portal.admin.dashboard.settings)).toBe(true);
  });

  it('does not mark public paths as admin routes', () => {
    expect(isAdminRoutePath(ROUTES.home)).toBe(false);
    expect(isAdminRoutePath(ROUTES.portal.donor.login)).toBe(false);
  });
});

describe('frontend access datetime helpers', () => {
  it('normalizes and round-trips datetime-local values', () => {
    const iso = fromDateTimeLocalValue('2026-04-20T10:30');
    expect(iso).not.toBeNull();
    expect(normalizeFrontendAccessDateTime(iso)).toBe(iso);
    expect(toDateTimeLocalValue(iso)).toBeTruthy();
  });

  it('builds a countdown breakdown', () => {
    const countdown = getFrontendAccessCountdown('2026-04-20T01:01:01.000Z', Date.parse('2026-04-19T00:00:00.000Z'));
    expect(countdown).toMatchObject({
      expired: false,
      days: 1,
      hours: 1,
      minutes: 1,
      seconds: 1,
    });
  });

  it('marks expired countdowns as expired', () => {
    const countdown = getFrontendAccessCountdown('2026-04-19T00:00:00.000Z', Date.parse('2026-04-19T00:05:00.000Z'));
    expect(countdown).toMatchObject({
      expired: true,
      totalMsRemaining: 0,
    });
  });
});
