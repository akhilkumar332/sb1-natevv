// src/components/ErrorBoundary.tsx

import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Home } from 'lucide-react';
import { captureFatalError } from '../services/errorLog.service';
import { ROUTES } from '../constants/routes';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('Uncaught error:', error, errorInfo);
    }
    void captureFatalError(error, {
      source: 'frontend',
      metadata: {
        kind: 'react.error_boundary',
        componentStack: errorInfo.componentStack,
      },
    });

    // Log to monitoring service in production
    if (import.meta.env.PROD) {
      import('../services/monitoring.service').then(({ monitoringService }) => {
        monitoringService.logError(error, {
          componentStack: errorInfo.componentStack,
          errorBoundary: true,
        });
      });
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[80vh] flex items-center justify-center px-4 sm:px-6 lg:px-8">
          <div className="max-w-md w-full text-center">
            <AlertTriangle className="mx-auto h-16 w-16 text-red-500" />
            <h1 className="mt-6 text-3xl font-bold text-gray-900">Oops! Something went wrong</h1>
            <p className="mt-4 text-gray-500">
              We're sorry, but something went wrong. Please try again later.
            </p>
            <div className="mt-8">
              <Link
                to={ROUTES.home}
                className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-red-600 hover:bg-red-700 transition"
              >
                <Home className="w-5 h-5 mr-2" />
                Back to Home
              </Link>
            </div>
            <div className="mt-8 text-sm text-gray-500">
              <p>
                Need help?{' '}
                <Link to={ROUTES.contact} className="text-red-600 hover:text-red-500 font-medium">
                  Contact Support
                </Link>
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Add this line to export ErrorBoundary as the default export
export default ErrorBoundary;
