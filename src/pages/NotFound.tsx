import { Link } from 'react-router-dom';
import { Home, AlertCircle } from 'lucide-react';
import { ROUTES } from '../constants/routes';

function NotFound() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full text-center">
        <AlertCircle className="mx-auto h-16 w-16 text-red-500" />
        <h1 className="mt-6 text-4xl font-bold text-gray-900">404</h1>
        <h2 className="mt-2 text-2xl font-semibold text-gray-600">Page Not Found</h2>
        <p className="mt-4 text-gray-500">
          The page you're looking for doesn't exist or has been moved.
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

export default NotFound;