// src/pages/bloodbank/BloodBankLogin.tsx
import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Building2, Users, Activity, Shield } from 'lucide-react';
import LogoMark from '../../components/LogoMark';

export function BloodBankLogin() {
  const navigate = useNavigate();
  const { user, loginWithGoogle, logout } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (!user || hasRedirected.current) {
      return;
    }

    if (user.role !== 'bloodbank' && user.role !== 'hospital') {
      toast.error("You're not a BloodBank Admin", { id: 'role-mismatch-bloodbank' });
      return;
    }

    const targetPath = user.onboardingCompleted ? '/bloodbank/dashboard' : '/bloodbank/onboarding';
    hasRedirected.current = true;
    navigate(targetPath);
  }, [user, navigate]);

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const response = await loginWithGoogle();
      if (response.user.role !== 'bloodbank' && response.user.role !== 'hospital') {
        toast.error("You're not a BloodBank Admin", { id: 'role-mismatch-bloodbank' });
        await logout(navigate, { redirectTo: '/bloodbank/login', showToast: false });
        return;
      }
      toast.success('Successfully logged in as BloodBank!');

      if (response.user.onboardingCompleted === true) {
        navigate('/bloodbank/dashboard');
      } else {
        navigate('/bloodbank/onboarding');
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
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-red-600 via-red-700 to-amber-600 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-red-800 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>

        <div className="relative z-10 flex flex-col justify-center px-12 py-12 text-white">
          <div className="mb-12">
            <div className="flex items-center space-x-3 mb-6">
              <LogoMark className="w-12 h-12" />
              <div>
                <h1 className="text-3xl font-extrabold">BloodHub</h1>
                <p className="text-sm tracking-wider opacity-90">INDIA</p>
              </div>
            </div>
            <h2 className="text-4xl font-bold mb-4">BloodBank Portal</h2>
            <p className="text-xl opacity-90 leading-relaxed">
              Manage blood inventory, appointments, and requests with real-time insights.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-white/10 backdrop-blur-lg rounded-xl flex items-center justify-center">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">Inventory Control</h3>
                <p className="opacity-90 text-sm">Track blood units, expiry, and restocking needs</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-white/10 backdrop-blur-lg rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">Donor Coordination</h3>
                <p className="opacity-90 text-sm">See donor activity and appointments instantly</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-white/10 backdrop-blur-lg rounded-xl flex items-center justify-center">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">Real-time Updates</h3>
                <p className="opacity-90 text-sm">Monitor requests, fulfillment, and alerts</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-white/10 backdrop-blur-lg rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">Secure Access</h3>
                <p className="opacity-90 text-sm">Verified BloodBank team access with audits</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-4 py-12 bg-gray-50">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-10 border border-gray-100">
            <div className="lg:hidden text-center mb-8">
              <div className="inline-flex items-center space-x-2">
                <LogoMark className="w-10 h-10" />
                <div>
                  <span className="font-extrabold text-2xl bg-gradient-to-r from-red-600 to-amber-600 bg-clip-text text-transparent">
                    BloodHub
                  </span>
                </div>
              </div>
            </div>

            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-red-600 to-amber-600 rounded-2xl mb-4">
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">BloodBank Login</h2>
              <p className="text-gray-600">Welcome back, BloodBank Admin!</p>
            </div>

            <div className="space-y-6">
              <div className="bg-gradient-to-r from-amber-50 to-red-50 rounded-2xl p-6 border border-amber-100">
                <div className="flex items-start space-x-3">
                  <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Secure BloodBank Access</h3>
                    <p className="text-sm text-gray-600">
                      Sign in with your organization Google account for secure access.
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
                <p className="text-center text-sm text-gray-600">
                  Don't have an account?{' '}
                  <Link
                    to="/bloodbank/register"
                    className="font-semibold text-red-600 hover:text-red-700 transition-colors"
                  >
                    Register now
                  </Link>
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 text-center text-sm text-gray-500">
            <p>By signing in, you agree to our Terms of Service and Privacy Policy</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BloodBankLogin;
