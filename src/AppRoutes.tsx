// src/AppRoutes.tsx
import { lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import { captureHandledError } from './services/errorLog.service';
import { ROUTES } from './constants/routes';

const LAZY_RELOAD_KEY = 'bh_lazy_reload_attempted';

const isChunkLoadError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('Loading chunk') ||
    message.includes('ChunkLoadError') ||
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Importing a module script failed') ||
    message.includes('Cannot find module')
  );
};

const tryAutoReload = (error: unknown) => {
  if (!import.meta.env.PROD) return false;
  if (!isChunkLoadError(error)) return false;
  try {
    if (window.sessionStorage.getItem(LAZY_RELOAD_KEY)) {
      return false;
    }
    window.sessionStorage.setItem(LAZY_RELOAD_KEY, String(Date.now()));
  } catch {
    // If storage is unavailable, still attempt a one-time reload.
  }
  window.location.reload();
  return true;
};

// Helper function for lazy loading with retry
const lazyLoad = (importPromise: Promise<any>) => {
  return importPromise.catch(error => {
    void captureHandledError(error, {
      source: 'frontend',
      scope: 'unknown',
      metadata: {
        kind: 'route.lazy_load',
      },
    });
    const reloading = tryAutoReload(error);
    if (reloading) {
      return { default: () => <div>Reloading...</div> };
    }
    return { default: () => <div>Error loading, please reload.</div> };
  });
};

// Lazy load components
const Home = lazy(() => lazyLoad(import('./pages/Home')));
const DonorRegister = lazy(() => lazyLoad(import('./pages/donor/DonorRegister')));
const DonorLogin = lazy(() => lazyLoad(import('./pages/donor/DonorLogin')));
const DonorOnboarding = lazy(() => lazyLoad(import('./pages/donor/DonorOnboarding')));
const DonorDashboard = lazy(() => lazyLoad(import('./pages/donor/DonorDashboard')));
const DonorOverview = lazy(() => lazyLoad(import('./pages/donor/dashboard/Overview')));
const DonorReadiness = lazy(() => lazyLoad(import('./pages/donor/dashboard/Readiness')));
const DonorRequests = lazy(() => lazyLoad(import('./pages/donor/dashboard/Requests')));
const DonorBloodDrives = lazy(() => lazyLoad(import('./pages/donor/dashboard/BloodDrives')));
const DonorJourney = lazy(() => lazyLoad(import('./pages/donor/dashboard/Journey')));
const DonorReferrals = lazy(() => lazyLoad(import('./pages/donor/dashboard/Referrals')));
const DonorAccount = lazy(() => lazyLoad(import('./pages/donor/dashboard/Account')));
const HospitalRegister = lazy(() => lazyLoad(import('./pages/hospital/HospitalRegister')));
const HospitalLogin = lazy(() => lazyLoad(import('./pages/hospital/HospitalLogin')));
const HospitalDashboard = lazy(() => lazyLoad(import('./pages/hospital/HospitalDashboard')));
const HospitalOnboarding = lazy(() => lazyLoad(import('./pages/hospital/HospitalOnboarding')));
const BloodBankRegister = lazy(() => lazyLoad(import('./pages/bloodbank/BloodBankRegister')));
const BloodBankLogin = lazy(() => lazyLoad(import('./pages/bloodbank/BloodBankLogin')));
const BloodBankDashboard = lazy(() => lazyLoad(import('./pages/bloodbank/BloodBankDashboard')));
const BloodBankOnboarding = lazy(() => lazyLoad(import('./pages/bloodbank/BloodBankOnboarding')));
const BloodBankOverview = lazy(() => lazyLoad(import('./pages/bloodbank/dashboard/Overview')));
const BloodBankRequests = lazy(() => lazyLoad(import('./pages/bloodbank/dashboard/Requests')));
const BloodBankDonors = lazy(() => lazyLoad(import('./pages/bloodbank/dashboard/Donors')));
const BloodBankAppointments = lazy(() => lazyLoad(import('./pages/bloodbank/dashboard/Appointments')));
const BloodBankInventory = lazy(() => lazyLoad(import('./pages/bloodbank/dashboard/Inventory')));
const BloodBankAnalytics = lazy(() => lazyLoad(import('./pages/bloodbank/dashboard/Analytics')));
const BloodBankReferrals = lazy(() => lazyLoad(import('./pages/bloodbank/dashboard/Referrals')));
const BloodBankAccount = lazy(() => lazyLoad(import('./pages/bloodbank/dashboard/Account')));
const NgoRegister = lazy(() => lazyLoad(import('./pages/ngo/NgoRegister')));
const NgoLogin = lazy(() => lazyLoad(import('./pages/ngo/NgoLogin')));
const NgoDashboard = lazy(() => lazyLoad(import('./pages/ngo/NgoDashboard')));
const NgoOnboarding = lazy(() => lazyLoad(import('./pages/ngo/NgoOnboarding')));
const NgoOverview = lazy(() => lazyLoad(import('./pages/ngo/dashboard/Overview')));
const NgoCampaigns = lazy(() => lazyLoad(import('./pages/ngo/dashboard/Campaigns')));
const NgoCampaignDetail = lazy(() => lazyLoad(import('./pages/ngo/dashboard/CampaignDetail')));
const NgoVolunteers = lazy(() => lazyLoad(import('./pages/ngo/dashboard/Volunteers')));
const NgoVolunteerDetail = lazy(() => lazyLoad(import('./pages/ngo/dashboard/VolunteerDetail')));
const NgoPartnerships = lazy(() => lazyLoad(import('./pages/ngo/dashboard/Partnerships')));
const NgoPartnershipDetail = lazy(() => lazyLoad(import('./pages/ngo/dashboard/PartnershipDetail')));
const NgoDonors = lazy(() => lazyLoad(import('./pages/ngo/dashboard/Donors')));
const NgoAnalytics = lazy(() => lazyLoad(import('./pages/ngo/dashboard/Analytics')));
const NgoAccount = lazy(() => lazyLoad(import('./pages/ngo/dashboard/Account')));
const NgoReferrals = lazy(() => lazyLoad(import('./pages/ngo/dashboard/Referrals')));
const AdminLogin = lazy(() => lazyLoad(import('./pages/admin/AdminLogin')));
const AdminPortal = lazy(() => lazyLoad(import('./pages/admin/AdminPortal')));
const AdminOnboarding = lazy(() => lazyLoad(import('./pages/admin/AdminOnboarding')));
const ImpersonationAudit = lazy(() => lazyLoad(import('./pages/admin/ImpersonationAudit')));
const AdminOverview = lazy(() => lazyLoad(import('./pages/admin/dashboard/Overview')));
const AdminUsers = lazy(() => lazyLoad(import('./pages/admin/dashboard/Users')));
const AdminUserDetail = lazy(() => lazyLoad(import('./pages/admin/dashboard/UserDetail')));
const AdminDonors = lazy(() => lazyLoad(import('./pages/admin/dashboard/Donors')));
const AdminNgos = lazy(() => lazyLoad(import('./pages/admin/dashboard/Ngos')));
const AdminBloodBanks = lazy(() => lazyLoad(import('./pages/admin/dashboard/BloodBanks')));
const AdminVerification = lazy(() => lazyLoad(import('./pages/admin/dashboard/Verification')));
const AdminEmergencyRequests = lazy(() => lazyLoad(import('./pages/admin/dashboard/EmergencyRequests')));
const AdminInventoryAlerts = lazy(() => lazyLoad(import('./pages/admin/dashboard/InventoryAlerts')));
const AdminCampaigns = lazy(() => lazyLoad(import('./pages/admin/dashboard/Campaigns')));
const AdminVolunteersPartnerships = lazy(() => lazyLoad(import('./pages/admin/dashboard/VolunteersPartnerships')));
const AdminAppointmentsDonations = lazy(() => lazyLoad(import('./pages/admin/dashboard/AppointmentsDonations')));
const AdminAnalyticsReports = lazy(() => lazyLoad(import('./pages/admin/dashboard/AnalyticsReports')));
const AdminAuditSecurity = lazy(() => lazyLoad(import('./pages/admin/dashboard/AuditSecurity')));
const AdminErrorLogs = lazy(() => lazyLoad(import('./pages/admin/dashboard/ErrorLogs')));
const AdminContactSubmissions = lazy(() => lazyLoad(import('./pages/admin/dashboard/ContactSubmissions')));
const AdminNotifications = lazy(() => lazyLoad(import('./pages/admin/dashboard/Notifications')));
const AdminSettings = lazy(() => lazyLoad(import('./pages/admin/dashboard/Settings')));
const FindDonors = lazy(() => lazyLoad(import('./pages/FindDonors')));
const RequestBlood = lazy(() => lazyLoad(import('./pages/RequestBlood')));
const About = lazy(() => lazyLoad(import('./pages/About')));
const Contact = lazy(() => lazyLoad(import('./pages/Contact')));
const NotFound = lazy(() => lazyLoad(import('./pages/NotFound')));


const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path={ROUTES.home} element={<Home />} />
      <Route path={ROUTES.donors} element={<FindDonors />} />
      <Route path={ROUTES.requestBlood} element={<RequestBlood />} />
      <Route path={ROUTES.about} element={<About />} />
      <Route path={ROUTES.contact} element={<Contact />} />
      
      {/* Auth Routes */}
      <Route path={ROUTES.portal.donor.register} element={<DonorRegister />} />
      <Route path={ROUTES.portal.donor.login} element={<DonorLogin />} />
      <Route path={ROUTES.portal.hospital.register} element={<HospitalRegister />} />
      <Route path={ROUTES.portal.hospital.login} element={<HospitalLogin />} />
      <Route path={ROUTES.portal.bloodbank.register} element={<BloodBankRegister />} />
      <Route path={ROUTES.portal.bloodbank.login} element={<BloodBankLogin />} />
      <Route path={ROUTES.portal.ngo.register} element={<NgoRegister />} />
      <Route path={ROUTES.portal.ngo.login} element={<NgoLogin />} />
      <Route path={ROUTES.portal.admin.login} element={<AdminLogin />} />

      {/* Protected Routes */}
      <Route element={<ProtectedRoute />}>
        <Route path={ROUTES.portal.donor.onboarding} element={<DonorOnboarding />} />
        <Route path={ROUTES.portal.donor.dashboard.root} element={<DonorDashboard />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<DonorOverview />} />
          <Route path="readiness" element={<DonorReadiness />} />
          <Route path="requests" element={<DonorRequests />} />
          <Route path="blood-drives" element={<DonorBloodDrives />} />
          <Route path="journey" element={<DonorJourney />} />
          <Route path="referrals" element={<DonorReferrals />} />
          <Route path="account" element={<DonorAccount />} />
        </Route>
        <Route path={ROUTES.portal.hospital.onboarding} element={<HospitalOnboarding />} />
        <Route path={ROUTES.portal.hospital.dashboard} element={<HospitalDashboard />} />
        <Route path={ROUTES.portal.bloodbank.onboarding} element={<BloodBankOnboarding />} />
        <Route path={ROUTES.portal.bloodbank.dashboard.root} element={<BloodBankDashboard />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<BloodBankOverview />} />
          <Route path="requests" element={<BloodBankRequests />} />
          <Route path="donors" element={<BloodBankDonors />} />
          <Route path="appointments" element={<BloodBankAppointments />} />
          <Route path="inventory" element={<BloodBankInventory />} />
          <Route path="analytics" element={<BloodBankAnalytics />} />
          <Route path="referrals" element={<BloodBankReferrals />} />
          <Route path="account" element={<BloodBankAccount />} />
        </Route>
        <Route path={ROUTES.portal.ngo.onboarding} element={<NgoOnboarding />} />
        <Route path={ROUTES.portal.ngo.dashboard.root} element={<NgoDashboard />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<NgoOverview />} />
          <Route path="campaigns" element={<NgoCampaigns />} />
          <Route path="campaigns/:campaignId" element={<NgoCampaignDetail />} />
          <Route path="volunteers" element={<NgoVolunteers />} />
          <Route path="volunteers/:volunteerId" element={<NgoVolunteerDetail />} />
          <Route path="partnerships" element={<NgoPartnerships />} />
          <Route path="partnerships/:partnershipId" element={<NgoPartnershipDetail />} />
          <Route path="donors" element={<NgoDonors />} />
          <Route path="analytics" element={<NgoAnalytics />} />
          <Route path="referrals" element={<NgoReferrals />} />
          <Route path="account" element={<NgoAccount />} />
        </Route>
        <Route path={ROUTES.portal.admin.onboarding} element={<AdminOnboarding />} />
        <Route path={ROUTES.portal.admin.dashboard.root} element={<AdminPortal />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<AdminOverview />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="users/:uid" element={<AdminUserDetail />} />
          <Route path="donors" element={<AdminDonors />} />
          <Route path="donors/:uid" element={<AdminUserDetail />} />
          <Route path="ngos" element={<AdminNgos />} />
          <Route path="ngos/:uid" element={<AdminUserDetail />} />
          <Route path="bloodbanks" element={<AdminBloodBanks />} />
          <Route path="bloodbanks/:uid" element={<AdminUserDetail />} />
          <Route path="verification" element={<AdminVerification />} />
          <Route path="emergency-requests" element={<AdminEmergencyRequests />} />
          <Route path="inventory-alerts" element={<AdminInventoryAlerts />} />
          <Route path="campaigns" element={<AdminCampaigns />} />
          <Route path="volunteers-partnerships" element={<AdminVolunteersPartnerships />} />
          <Route path="appointments-donations" element={<AdminAppointmentsDonations />} />
          <Route path="analytics-reports" element={<AdminAnalyticsReports />} />
          <Route path="reports" element={<Navigate to={ROUTES.portal.admin.dashboard.analyticsReports} replace />} />
          <Route path="audit-security" element={<AdminAuditSecurity />} />
          <Route path="error-logs" element={<AdminErrorLogs />} />
          <Route path="contact-submissions" element={<AdminContactSubmissions />} />
          <Route path="impersonation-audit" element={<ImpersonationAudit />} />
          <Route path="notifications" element={<AdminNotifications />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
        <Route path={ROUTES.portal.admin.dashboard.impersonationAudit} element={<ImpersonationAudit />} />
      </Route>

      {/* 404 Route */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default AppRoutes;
