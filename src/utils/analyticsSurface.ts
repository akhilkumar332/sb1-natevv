import { ANALYTICS_SURFACES, type AnalyticsSurface } from '../constants/analytics';
import { ROUTES } from '../constants/routes';

export const getAnalyticsSurface = (pathname: string): AnalyticsSurface => {
  if (pathname.startsWith(ROUTES.portal.admin.dashboard.root) || pathname === ROUTES.portal.admin.login) {
    return ANALYTICS_SURFACES.admin;
  }
  if (pathname.startsWith(ROUTES.portal.ngo.dashboard.root) || pathname === ROUTES.portal.ngo.login || pathname === ROUTES.portal.ngo.register) {
    return ANALYTICS_SURFACES.ngo;
  }
  if (pathname.startsWith(ROUTES.portal.bloodbank.dashboard.root) || pathname === ROUTES.portal.bloodbank.login || pathname === ROUTES.portal.bloodbank.register) {
    return ANALYTICS_SURFACES.bloodbank;
  }
  if (pathname.startsWith(ROUTES.portal.hospital.dashboard) || pathname === ROUTES.portal.hospital.login || pathname === ROUTES.portal.hospital.register) {
    return ANALYTICS_SURFACES.bloodbank;
  }
  if (pathname.startsWith(ROUTES.portal.donor.dashboard.root) || pathname === ROUTES.portal.donor.login || pathname === ROUTES.portal.donor.register) {
    return ANALYTICS_SURFACES.donor;
  }
  if (pathname.startsWith('/admin') || pathname.startsWith('/donor') || pathname.startsWith('/ngo') || pathname.startsWith('/bloodbank') || pathname.startsWith('/hospital')) {
    return ANALYTICS_SURFACES.auth;
  }
  return ANALYTICS_SURFACES.public;
};
