// src/pages/auth/DonorLogin.tsx
import { useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Phone, Droplet, Heart, Shield, ArrowRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import PhoneInput from 'react-phone-number-input';
import { useLogin } from '../../hooks/useLogin';
import 'react-phone-number-input/style.css';

export function DonorLogin() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const hasNavigated = useRef(false);
  const {
    formData,
    otpResendTimer,
    confirmationResult,
    authLoading,
    googleLoading,
    otpLoading,
    handleIdentifierChange,
    handleChange,
    handlePhoneNumberSubmit,
    handleOTPSubmit,
    handleResendOTP,
    handleGoogleLogin
  } = useLogin();

  useEffect(() => {
    if (user && !hasNavigated.current) {
      hasNavigated.current = true;
      if (!user.onboardingCompleted) {
        navigate('/donor/onboarding');
      } else if (user.role === 'donor') {
        navigate('/donor/dashboard');
      }
    }
  }, []);

  const renderInitialForm = () => (
    <div className="space-y-6">
      <div>
        <label htmlFor="identifier" className="block text-sm font-semibold text-gray-700 mb-2">
          Phone Number
        </label>
        <div className="relative">
          <PhoneInput
            international
            defaultCountry="IN"
            countryCallingCodeEditable={false}
            value={formData.identifier}
            onChange={(value) => handleIdentifierChange(value || '')}
            className="block w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none transition-colors"
          />
          <Phone className="absolute right-4 top-3.5 h-5 w-5 text-gray-400" />
        </div>
      </div>

      <button
        type="button"
        onClick={handlePhoneNumberSubmit}
        disabled={authLoading || formData.identifier.replace(/\D/g, '').length !== 10 &&
                 formData.identifier.replace(/\D/g, '').length !== 12}
        className="w-full py-4 px-6 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-semibold hover:shadow-lg transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
      >
        {authLoading ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span>Processing...</span>
          </>
        ) : (
          <>
            <span>Send OTP</span>
            <ArrowRight className="w-5 h-5" />
          </>
        )}
      </button>
    </div>
  );

  const renderOTPForm = () => (
    <div className="space-y-6">
      <div>
        <label htmlFor="otp" className="block text-sm font-semibold text-gray-700 mb-2">
          Enter OTP
        </label>
        <div className="relative">
          <input
            id="otp"
            name="otp"
            type="text"
            required
            value={formData.otp}
            onChange={handleChange}
            disabled={otpLoading}
            maxLength={6}
            className="block w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none transition-colors text-center text-2xl font-bold tracking-widest disabled:opacity-50"
            placeholder="000000"
          />
        </div>
        <p className="mt-2 text-sm text-gray-500 text-center">
          We've sent a 6-digit code to your phone
        </p>
      </div>

      <button
        type="button"
        onClick={handleOTPSubmit}
        disabled={otpLoading}
        className="w-full py-4 px-6 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-semibold hover:shadow-lg transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
      >
        {otpLoading ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span>Verifying...</span>
          </>
        ) : (
          <>
            <span>Verify OTP</span>
            <ArrowRight className="w-5 h-5" />
          </>
        )}
      </button>

      <div className="text-center">
        {otpResendTimer > 0 ? (
          <p className="text-sm text-gray-500">
            Resend OTP in <span className="font-bold text-red-600">{otpResendTimer}s</span>
          </p>
        ) : (
          <button
            type="button"
            onClick={handleResendOTP}
            disabled={otpLoading}
            className="text-sm text-red-600 hover:text-red-700 font-semibold disabled:opacity-50 transition-colors"
          >
            Resend OTP
          </button>
        )}
      </div>
    </div>
  );

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
            <h2 className="text-4xl font-bold mb-4">Welcome Back, Hero!</h2>
            <p className="text-xl opacity-90 leading-relaxed">
              Every donation saves lives. Sign in to continue your journey of compassion.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-white/10 backdrop-blur-lg rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">Secure & Safe</h3>
                <p className="opacity-90 text-sm">Your data is protected with enterprise-grade security</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-white/10 backdrop-blur-lg rounded-xl flex items-center justify-center">
                <Droplet className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">Track Your Impact</h3>
                <p className="opacity-90 text-sm">Monitor your donations and lives saved</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-white/10 backdrop-blur-lg rounded-xl flex items-center justify-center">
                <Heart className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">Join the Community</h3>
                <p className="opacity-90 text-sm">Connect with thousands of donors across India</p>
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
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Donor Login</h2>
              <p className="text-gray-600">Enter your details to continue</p>
            </div>

            <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
              {confirmationResult ? renderOTPForm() : renderInitialForm()}

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-500 font-medium">Or continue with</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={authLoading || googleLoading || otpLoading}
                className="w-full flex items-center justify-center px-6 py-4 border-2 border-gray-200 rounded-xl shadow-sm text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {googleLoading || otpLoading ? (
                  <span className="flex items-center space-x-2">
                    <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                    <span>{googleLoading ? 'Signing in...' : 'Verifying...'}</span>
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
                    to="/donor/register"
                    className="font-semibold text-red-600 hover:text-red-700 transition-colors"
                  >
                    Register now
                  </Link>
                </p>
              </div>
            </form>
          </div>

          {/* Additional Info */}
          <div className="mt-6 text-center text-sm text-gray-500">
            <p>By signing in, you agree to our Terms of Service and Privacy Policy</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DonorLogin;
