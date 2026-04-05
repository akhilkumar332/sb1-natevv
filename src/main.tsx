// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './i18n';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { QueryProvider } from './contexts/QueryContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NetworkStatusProvider } from './contexts/NetworkStatusContext';
import ErrorBoundary from './components/ErrorBoundary';
import * as serviceWorkerRegistration from './utils/serviceWorkerRegistration';
import { initPerformanceMonitoring } from './utils/performanceMonitoring';
import { initGlobalErrorLogging } from './utils/errorLoggingBootstrap';
import { initializeFirestoreOfflinePersistence } from './firebase';
import { loadTranslationOverridesIntoI18n } from './services/translationRuntime.service';
import '../index.css';

// Initialize performance monitoring
const initRuntimeOptimizations = () => {
  initPerformanceMonitoring();
  initGlobalErrorLogging();
  void initializeFirestoreOfflinePersistence();
  void loadTranslationOverridesIntoI18n();
};

if (typeof window !== 'undefined') {
  if ('requestIdleCallback' in window) {
    (window as Window & { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(() => {
      initRuntimeOptimizations();
    });
  } else {
    globalThis.setTimeout(() => {
      initRuntimeOptimizations();
    }, 0);
  }
} else {
  initRuntimeOptimizations();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryProvider>
        <ThemeProvider>
          <NetworkStatusProvider>
            <AuthProvider>
              <ErrorBoundary>
                <App />
              </ErrorBoundary>
            </AuthProvider>
          </NetworkStatusProvider>
        </ThemeProvider>
      </QueryProvider>
    </BrowserRouter>
  </StrictMode>
);

// Register service worker for PWA support only in production.
if (import.meta.env.PROD) {
  serviceWorkerRegistration.register();
}
