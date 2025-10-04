// src/pages/auth/AdminLogin.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

// Define the GoogleLoginButton component
const GoogleLoginButton = ({ onClick, loading }: { onClick: () => void; loading: boolean }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={loading}
    className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
  >
    {loading ? (
      <span className="flex items-center">
        <svg
          className="animate-spin -ml-1 mr-3 h-5 w-5 text-red-500"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        Signing in ...
      </span>
    ) : (
      <>
        <img
          className="h-5 w-5 mr-2"
          src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
          alt="Google logo"
        />
        Sign in with Google
      </>
    )}
  </button>
);

export function AdminLogin() {
  const navigate = useNavigate();
  const { user, loginWithGoogle, logout } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (user) {
      const targetPath = user.onboardingCompleted ? '/admin/dashboard' : '/admin/onboarding';
      navigate(targetPath);
    }
  }, [user, navigate]);

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const response = await loginWithGoogle();
      if (response.user.role !== 'admin') {
        toast.error("You're not an Admin");
        await logout(navigate);
        navigate('/admin/login');
        return;
      }
      toast.success('Successfully logged in as Admin!');
      navigate('/admin/dashboard');
    } catch (error) {
      toast.error('Failed to sign in with Google. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-sm">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Admin Login</h2>
          <p className="mt-2 text-gray-600">Welcome back, Admin!</p>
        </div>

        <div className="mt-8 space-y-6">
          <div className="relative">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
            </div>
            <div className="mt-4">
              <GoogleLoginButton onClick={handleGoogleLogin} loading={googleLoading} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminLogin;