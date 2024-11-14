// src/AppRoutes.tsx
import { lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
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
const HospitalLogin = lazy(() => lazyLoad(import('./pages/hospital/HospitalLogin')));
const HospitalDashboard = lazy(() => lazyLoad(import('./pages/hospital/HospitalDashboard')));
const HospitalOnboarding = lazy(() => lazyLoad(import('./pages/hospital/HospitalOnboarding')));
const NgoLogin = lazy(() => lazyLoad(import('./pages/ngo/NgoLogin')));
const NgoDashboard = lazy(() => lazyLoad(import('./pages/ngo/NgoDashboard')));
const NgoOnboarding = lazy(() => lazyLoad(import('./pages/ngo/NgoOnboarding')));
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
      <Route path="/hospital/login" element={<HospitalLogin />} />
      <Route path="/ngo/login" element={<NgoLogin />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/donor/onboarding" element={<DonorOnboarding />} />
      <Route path="/admin/onboarding" element={<AdminOnboarding />} />
      <Route path="/ngo/onboarding" element={<NgoOnboarding />} />
      <Route path="/hospital/onboarding" element={<HospitalOnboarding />} />    

      {/* Protected Routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/donor/dashboard" element={<DonorDashboard />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/ngo/dashboard" element={<NgoDashboard />} />
        <Route path="/hospital/dashboard" element={<HospitalDashboard />} />
      </Route>

      {/* 404 Route */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default AppRoutes;