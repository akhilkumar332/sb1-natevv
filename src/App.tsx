// src/App.tsx
import { Suspense } from 'react';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Loading from './components/Loading';
import { LoadingProvider } from './contexts/LoadingContext';
import AppRoutes from './AppRoutes';
import { useAuth } from './contexts/AuthContext';
import { useAuthSync } from './hooks/useAuthSync';
import { useActivityTracker } from './hooks/useActivityTracker';
import { useInactivityCheck } from './hooks/useInactivityCheck';
import { useLocation } from 'react-router-dom';

function App() {
  useAuthSync();
  useActivityTracker();
  const { user } = useAuth();
  const { WarningComponent } = useInactivityCheck();
  const location = useLocation();

  const mobileOnlyRoutes = new Set([
    '/donor/login',
    '/donor/register',
    '/ngo/login',
    '/ngo/register',
    '/hospital/login',
    '/hospital/register',
  ]);
  const noFooterRoutes = new Set([
    '/donor/dashboard',
    '/ngo/dashboard',
    '/hospital/dashboard',
    '/donor/onboarding',
    '/ngo/onboarding',
    '/hospital/onboarding',
  ]);

  const hideCompletely = noFooterRoutes.has(location.pathname);
  const hideOnMobile = mobileOnlyRoutes.has(location.pathname);
  const footerWrapperClass = hideCompletely
    ? 'hidden'
    : hideOnMobile
      ? 'hidden md:block'
      : undefined;

  return (
    <LoadingProvider>
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <Suspense fallback={<Loading />}>
          <main className="flex-grow">
            <AppRoutes />
          </main>
        </Suspense>
        <div className={footerWrapperClass}>
          <Footer />
        </div>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 5000,
            style: {
              background: '#ffffff',
              color: '#000000',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15), 0 0 1px rgba(0, 0, 0, 0.1)',
              borderRadius: '8px',
              padding: '16px',
              border: '1px solid rgba(0, 0, 0, 0.05)',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#10B981', // green-500
                secondary: '#ffffff',
              },
            },
            error: {
              duration: 3000,
              iconTheme: {
                primary: '#EF4444', // red-500
                secondary: '#ffffff',
              },
            },
            // Add custom styling for warning toasts
            custom: {
              duration: 60000,
              style: {
                background: '#FEF3C7',
                color: '#92400E',
                border: '1px solid #FCD34D',
              },
            },
          }}
        />
        {user && <WarningComponent />}
      </div>
    </LoadingProvider>
  );
}

export default App;
