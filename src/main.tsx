// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { QueryProvider } from './contexts/QueryContext';
import ErrorBoundary from './components/ErrorBoundary';
import * as serviceWorkerRegistration from './utils/serviceWorkerRegistration';
import { initPerformanceMonitoring } from './utils/performanceMonitoring';
import '../index.css';

// Initialize performance monitoring
initPerformanceMonitoring();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryProvider>
        <AuthProvider>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </AuthProvider>
      </QueryProvider>
    </BrowserRouter>
  </StrictMode>
);

// Register service worker for PWA support
serviceWorkerRegistration.register();