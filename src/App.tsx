// src/App.tsx
import { Suspense } from 'react';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Loading from './components/Loading';
import { LoadingProvider } from './contexts/LoadingContext';
import AppRoutes from './AppRoutes';

function App() {
  return (
    <LoadingProvider>
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <Suspense fallback={<Loading />}>
          <main className="flex-grow">
            <AppRoutes />
          </main>
        </Suspense>
        <Footer />
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
                primary: '#dc2626', // red-600 (tailwind) for success icon
                secondary: '#ffffff',
              },
            },
            error: {
              duration: 3000,
              iconTheme: {
                primary: '#dc2626', // red-600 (tailwind) for error icon
                secondary: '#ffffff',
              },
            },
          }}
        />
      </div>
    </LoadingProvider>
  );
}

export default App;