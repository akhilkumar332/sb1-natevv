// src/AppRoutes.tsx
import { lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';

// Helper function for lazy loading with delay
const lazyLoad = (importPromise: Promise<any>) => {
    return importPromise.catch(error => {
      console.error("Error loading component:", error);
      return { default: () => <div>Error loading component</div> };
    });
};

// Lazy load components
const Home = lazy(() => lazyLoad(import('./pages/Home')));
const DonorLogin = lazy(() => lazyLoad(import('./pages/auth/DonorLogin')));
const HospitalLogin = lazy(() => lazyLoad(import('./pages/auth/HospitalLogin')));
const NgoLogin = lazy(() => lazyLoad(import('./pages/auth/NgoLogin')));
const AdminLogin = lazy(() => lazyLoad(import('./pages/auth/AdminLogin')));
const FindDonors = lazy(() => lazyLoad(import('./pages/FindDonors')));
const RequestBlood = lazy(() => lazyLoad(import('./pages/RequestBlood')));
const About = lazy(() => lazyLoad(import('./pages/About')));
const Contact = lazy(() => lazyLoad(import('./pages/Contact')));
const DonorRegister = lazy(() => lazyLoad(import('./pages/auth/DonorRegister')));
const NotFound = lazy(() => lazyLoad(import('./pages/NotFound')));
const DonorDashboard = lazy(() => lazyLoad(import('./pages/donor/DonorDashboard')));

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

      {/* Protected Routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/donor/dashboard" element={<DonorDashboard />} />
      </Route>

      {/* 404 Route */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default AppRoutes;