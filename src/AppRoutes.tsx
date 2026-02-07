// src/AppRoutes.tsx
import { lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';

// Helper function for lazy loading with delay
const lazyLoad = (importPromise: Promise<any>) => {
    return importPromise.catch(error => {
      console.error("Error loading component:", error);
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
const DonorJourney = lazy(() => lazyLoad(import('./pages/donor/dashboard/Journey')));
const DonorReferrals = lazy(() => lazyLoad(import('./pages/donor/dashboard/Referrals')));
const DonorAccount = lazy(() => lazyLoad(import('./pages/donor/dashboard/Account')));
const HospitalRegister = lazy(() => lazyLoad(import('./pages/hospital/HospitalRegister')));
const HospitalLogin = lazy(() => lazyLoad(import('./pages/hospital/HospitalLogin')));
const HospitalDashboard = lazy(() => lazyLoad(import('./pages/hospital/HospitalDashboard')));
const HospitalOnboarding = lazy(() => lazyLoad(import('./pages/hospital/HospitalOnboarding')));
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
const AdminDashboard = lazy(() => lazyLoad(import('./pages/admin/AdminDashboard')));
const AdminOnboarding = lazy(() => lazyLoad(import('./pages/admin/AdminOnboarding')));
const FindDonors = lazy(() => lazyLoad(import('./pages/FindDonors')));
const RequestBlood = lazy(() => lazyLoad(import('./pages/RequestBlood')));
const About = lazy(() => lazyLoad(import('./pages/About')));
const Contact = lazy(() => lazyLoad(import('./pages/Contact')));
const NotFound = lazy(() => lazyLoad(import('./pages/NotFound')));


const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Home />} />
      <Route path="/donors" element={<FindDonors />} />
      <Route path="/request-blood" element={<RequestBlood />} />
      <Route path="/about" element={<About />} />
      <Route path="/contact" element={<Contact />} />
      
      {/* Auth Routes */}
      <Route path="/donor/register" element={<DonorRegister />} />
      <Route path="/donor/login" element={<DonorLogin />} />
      <Route path="/hospital/register" element={<HospitalRegister />} />
      <Route path="/hospital/login" element={<HospitalLogin />} />
      <Route path="/ngo/register" element={<NgoRegister />} />
      <Route path="/ngo/login" element={<NgoLogin />} />
      <Route path="/admin/login" element={<AdminLogin />} />

      {/* Protected Routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/donor/onboarding" element={<DonorOnboarding />} />
        <Route path="/donor/dashboard" element={<DonorDashboard />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<DonorOverview />} />
          <Route path="readiness" element={<DonorReadiness />} />
          <Route path="requests" element={<DonorRequests />} />
          <Route path="journey" element={<DonorJourney />} />
          <Route path="referrals" element={<DonorReferrals />} />
          <Route path="account" element={<DonorAccount />} />
        </Route>
        <Route path="/hospital/onboarding" element={<HospitalOnboarding />} />
        <Route path="/hospital/dashboard" element={<HospitalDashboard />} />
        <Route path="/ngo/onboarding" element={<NgoOnboarding />} />
        <Route path="/ngo/dashboard" element={<NgoDashboard />}>
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
        <Route path="/admin/onboarding" element={<AdminOnboarding />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
      </Route>

      {/* 404 Route */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default AppRoutes;
