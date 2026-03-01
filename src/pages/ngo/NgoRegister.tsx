// src/pages/ngo/NgoRegister.tsx
import { useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Heart, Building2, Users, Globe, Shield } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNgoRegister } from '../../hooks/useNgoRegister';
import LogoMark from '../../components/LogoMark';
import { ROUTES } from '../../constants/routes';

export function NgoRegister() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const hasNavigated = useRef(false);
  const {
    googleLoading,
    handleGoogleRegister
  } = useNgoRegister();

  useEffect(() => {
    if (user && !hasNavigated.current) {
      hasNavigated.current = true;
      if (!user.onboardingCompleted) {
        navigate(ROUTES.portal.ngo.onboarding);
      } else if (user.role === 'ngo') {
        navigate(ROUTES.portal.ngo.dashboard.root);
      }
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Gradient Background with Info */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-red-600 via-red-700 to-amber-600 relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>

        <div className="relative z-10 flex flex-col justify-center px-12 py-12 text-white">
          <div className="mb-12">
            <div className="flex items-center space-x-3 mb-6">
              <LogoMark className="w-12 h-12" />
              <div>
                <h1 className="text-3xl font-extrabold">BloodHub</h1>
                <p className="text-sm tracking-wider opacity-90">INDIA</p>
              </div>
            </div>
            <h2 className="text-4xl font-bold mb-4">NGO Registration</h2>
            <p className="text-xl opacity-90 leading-relaxed">
              Join our platform to organize blood donation drives and save lives.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-white/10 backdrop-blur-lg rounded-xl flex items-center justify-center">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">Organize Drives</h3>
                <p className="opacity-90 text-sm">Host blood donation camps and events</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-white/10 backdrop-blur-lg rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">Connect with Donors</h3>
                <p className="opacity-90 text-sm">Access our network of active donors</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-white/10 backdrop-blur-lg rounded-xl flex items-center justify-center">
                <Globe className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">Track Impact</h3>
                <p className="opacity-90 text-sm">Monitor drives and donations collected</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-white/10 backdrop-blur-lg rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">Verified Platform</h3>
                <p className="opacity-90 text-sm">Join verified NGOs on our platform</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Register Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-4 py-12 bg-gray-50">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-10 border border-gray-100">
            {/* Mobile Logo */}
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
                <Heart className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">NGO Registration</h2>
              <p className="text-gray-600">Register your organization</p>
            </div>

            <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
              <button
                type="button"
                onClick={handleGoogleRegister}
                disabled={googleLoading}
                className="w-full flex items-center justify-center px-6 py-4 border-2 border-gray-200 rounded-xl shadow-sm text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 hover:border-amber-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {googleLoading ? (
                  <span className="flex items-center space-x-2">
                    <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                    <span>Signing up...</span>
                  </span>
                ) : (
                  <>
                    <img
                      className="h-5 w-5 mr-3"
                      src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                      alt="Google logo"
                    />
                    Sign up with Google
                  </>
                )}
              </button>

              <div className="pt-4 border-t border-gray-100">
                <p className="text-center text-sm text-gray-600">
                  Already registered?{' '}
                  <Link
                    to={ROUTES.portal.ngo.login}
                    className="font-semibold text-red-600 hover:text-red-700 transition-colors"
                  >
                    Login now
                  </Link>
                </p>
              </div>
            </form>
          </div>

          {/* Terms */}
          <div className="mt-4 text-center text-xs text-gray-500">
            <p>By registering, you agree to our Terms of Service and Privacy Policy</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NgoRegister;
