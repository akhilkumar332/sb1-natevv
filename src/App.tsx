// src/App.tsx
import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Loading from './components/Loading';
import { AuthProvider } from './contexts/AuthContext';
import { LoadingProvider } from './contexts/LoadingContext'; // Add this import

// Helper function for lazy loading with delay
const lazyLoad = (importPromise: Promise<any>) => {
  return Promise.all([
    importPromise,
    new Promise(resolve => setTimeout(resolve, 1000))
  ]).then(([moduleExports]) => moduleExports);
};

// Lazy load components with loading states
const Home = lazy(() => lazyLoad(import('./pages/Home')));
const DonorLogin = lazy(() => lazyLoad(import('./pages/auth/DonorLogin')));
const HospitalLogin = lazy(() => lazyLoad(import('./pages/auth/HospitalLogin')));
const NgoLogin = lazy(() => lazyLoad(import('./pages/auth/NgoLogin')));
const AdminLogin = lazy(() => lazyLoad(import('./pages/auth/AdminLogin')));
const FindDonors = lazy(() => lazyLoad(import('./pages/FindDonors')));
const RequestBlood = lazy(() => lazyLoad(import('./pages/RequestBlood')));
const About = lazy(() => lazyLoad(import('./pages/About')));
const Contact = lazy(() => lazyLoad(import('./pages/Contact')));
const DonorRegister = lazy(() => lazyLoad(import('./pages/DonorRegister')));
const NotFound = lazy(() => lazyLoad(import('./pages/NotFound')));
const ForgotPassword = lazy(() => lazyLoad(import('./pages/ForgotPassword')));

function App() {
  return (
    <AuthProvider>
      <LoadingProvider>
        <BrowserRouter>
          <div className="min-h-screen flex flex-col bg-gray-50">
            <Navbar />
            <Suspense fallback={<Loading />}>
              <main className="flex-grow">
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/donors" element={<FindDonors />} />
                  <Route path="/request-blood" element={<RequestBlood />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/contact" element={<Contact />} />
                  <Route path="/donor/register" element={<DonorRegister />} />
                  <Route path="/donor/login" element={<DonorLogin />} />
                  <Route path="/hospital/login" element={<HospitalLogin />} />
                  <Route path="/ngo/login" element={<NgoLogin />} />
                  <Route path="/admin/login" element={<AdminLogin />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </main>
            </Suspense>
            <Footer />
            <Toaster position="top-right" />
          </div>
        </BrowserRouter>
      </LoadingProvider>
    </AuthProvider>
  );
}

export default App;