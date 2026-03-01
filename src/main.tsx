// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
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
import { startOfflineMutationOutboxWorker } from './services/offlineMutationOutbox.service';
import '../index.css';

// Initialize performance monitoring
initPerformanceMonitoring();
initGlobalErrorLogging();
void initializeFirestoreOfflinePersistence();
startOfflineMutationOutboxWorker();

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

// Register service worker for PWA support
serviceWorkerRegistration.register();
