// src/pages/auth/AdminLogin.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Droplet, Heart, Settings, Lock, BarChart3, Shield } from 'lucide-react';

export function AdminLogin() {
  const navigate = useNavigate();
  const { user, loginWithGoogle, logout } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (user) {
      const targetPath = user.onboardingCompleted ? '/admin/dashboard' : '/admin/onboarding';
      navigate(targetPath);
    }
  }, []);

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

      if (response.user.onboardingCompleted === true) {
        navigate('/admin/dashboard');
      } else {
        navigate('/admin/onboarding');
      }
    } catch (error) {
      toast.error('Failed to sign in with Google. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Gradient Background with Info */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-red-600 via-red-700 to-red-800 relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-red-900 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>

        <div className="relative z-10 flex flex-col justify-center px-12 py-12 text-white">
          <div className="mb-12">
            <div className="flex items-center space-x-3 mb-6">
              <div className="relative">
                <Droplet className="w-12 h-12" />
                <Heart className="w-5 h-5 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
              </div>
              <div>
                <h1 className="text-3xl font-extrabold">BloodHub</h1>
                <p className="text-sm tracking-wider opacity-90">INDIA</p>
              </div>
            </div>
            <h2 className="text-4xl font-bold mb-4">Admin Portal</h2>
            <p className="text-xl opacity-90 leading-relaxed">
              Manage the entire platform, monitor operations, and ensure smooth functionality.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-white/10 backdrop-blur-lg rounded-xl flex items-center justify-center">
                <Settings className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">Platform Management</h3>
                <p className="opacity-90 text-sm">Control all aspects of the BloodHub ecosystem</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-white/10 backdrop-blur-lg rounded-xl flex items-center justify-center">
                <BarChart3 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">Analytics & Reports</h3>
                <p className="opacity-90 text-sm">Access comprehensive insights and metrics</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-white/10 backdrop-blur-lg rounded-xl flex items-center justify-center">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">User Management</h3>
                <p className="opacity-90 text-sm">Manage users, roles, and permissions</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-white/10 backdrop-blur-lg rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">Security Controls</h3>
                <p className="opacity-90 text-sm">Enhanced security and audit capabilities</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-4 py-12 bg-gray-50">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-10 border border-gray-100">
            {/* Mobile Logo */}
            <div className="lg:hidden text-center mb-8">
              <div className="inline-flex items-center space-x-2">
                <div className="relative">
                  <Droplet className="w-10 h-10 text-red-600" />
                  <Heart className="w-4 h-4 text-red-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                </div>
                <div>
                  <span className="font-extrabold text-2xl bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
                    BloodHub
                  </span>
                </div>
              </div>
            </div>

            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-red-600 to-red-700 rounded-2xl mb-4">
                <Settings className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Admin Login</h2>
              <p className="text-gray-600">Secure administrative access</p>
            </div>

            <div className="space-y-6">
              <div className="bg-gradient-to-r from-red-50 to-pink-50 rounded-2xl p-6 border border-red-100">
                <div className="flex items-start space-x-3">
                  <Shield className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Restricted Access</h3>
                    <p className="text-sm text-gray-600">
                      This portal is restricted to authorized BloodHub administrators only.
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={googleLoading}
                className="w-full flex items-center justify-center px-6 py-4 border-2 border-gray-200 rounded-xl shadow-sm text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {googleLoading ? (
                  <span className="flex items-center space-x-2">
                    <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                    <span>Signing in...</span>
                  </span>
                ) : (
                  <>
                    <img
                      className="h-5 w-5 mr-3"
                      src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                      alt="Google logo"
                    />
                    Sign in with Google
                  </>
                )}
              </button>

              <div className="pt-4 border-t border-gray-100">
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <div className="flex items-start space-x-3">
                    <Lock className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-yellow-900 text-sm mb-1">Security Notice</h4>
                      <p className="text-xs text-yellow-800">
                        All admin activities are logged and monitored for security purposes.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Additional Info */}
          <div className="mt-6 text-center text-sm text-gray-500">
            <p>Unauthorized access attempts will be reported</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminLogin;
