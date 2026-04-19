import { describe, expect, it } from 'vitest';
import { CMS_DEFAULTS, CMS_FRONTEND_ACCESS_MODE } from '../../constants/cms';
import { ROUTES } from '../../constants/routes';
import { isAdminRoutePath, normalizeFrontendAccess } from '../frontendAccess';

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
