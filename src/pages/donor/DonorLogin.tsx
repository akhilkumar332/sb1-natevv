// src/pages/auth/DonorLogin.tsx
import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Phone } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import PhoneInput from 'react-phone-number-input';
import { useLogin } from '../../hooks/useLogin';
import 'react-phone-number-input/style.css';

export function DonorLogin() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    formData,
    otpResendTimer,
    confirmationResult,
    authLoading,
    googleLoading,
    handleIdentifierChange,
    handleChange,
    handlePhoneNumberSubmit,
    handleOTPSubmit,
    handleResendOTP,
    handleGoogleLogin
  } = useLogin();

  const [loading, setLoading] = useState<boolean>(true); // Add loading state

  useEffect(() => {
    if (user) {
      if (!user.onboardingCompleted) {
        navigate('/donor/onboarding');
      } else if (user.role === 'donor') {
        navigate('/donor/dashboard');
      }
    }
  }, [user, navigate]);

  // Simulate loading delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const renderInitialForm = () => (
    <div className="space-y-4">
      <div>
        <label htmlFor="identifier" className="block text-sm font-medium text-gray-700">
          Phone Number
        </label>
        <div className="mt-1 relative">
          <PhoneInput
            international
            defaultCountry="IN"
            countryCallingCodeEditable={false}
            value={formData.identifier}
            onChange={(value) => handleIdentifierChange(value || '')}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md"
          />
          <Phone className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
        </div>
      </div>

      <button
        type="button"
        onClick={handlePhoneNumberSubmit}
        disabled={authLoading || formData.identifier.replace(/\D/g, '').length !== 10 &&
                   formData.identifier.replace(/\D/g, '').length !== 12}
        className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {authLoading ? 'Processing...' : 'Send OTP'}
      </button>
    </div>
  );

  const renderOTPForm = () => (
    <div className="space-y-4">
      <div>
        <label htmlFor="otp" className="block text-sm font-medium text-gray-700">
          Enter OTP
        </label>
        <div className="mt-1">
          <input
            id="otp"
            name="otp"
            type="text"
            required
            value={formData.otp}
            onChange={handleChange}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder="Enter OTP"
          />
        </div>
      </div>
      
      <button
        type="button"
        onClick={handleOTPSubmit}
        disabled={authLoading}
        className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
      >
        {authLoading ? 'Verifying...' : 'Verify OTP'}
      </button>
  
      <div className="text-center">
        {otpResendTimer > 0 ? (
          <p className="text-sm text-gray-500">Resend OTP in {otpResendTimer} seconds</p>
        ) : (
          <button
            type="button"
            onClick={handleResendOTP}
            disabled={authLoading}
            className="text-sm text-red-600 hover:text-red-500"
          >
            Resend OTP
          </button>
        )}
      </div>
    </div>
  );

  // Skeleton Loader
  const SkeletonLoader = () => (
    <div className="animate-pulse">
      <div className="h-8 bg-gray-300 rounded mb-4"></div>
      <div className="h-4 bg-gray-300 rounded mb-2"></div>
      <div className="h-4 bg-gray-300 rounded mb-2"></div>
      <div className="h-12 bg-gray-300 rounded mb-4"></div>
      <div className="h-10 bg-gray-300 rounded mb-4"></div>
    </div>
  );

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-sm">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Donor Login</h2>
          <p className="mt-2 text-gray-600">Welcome back, hero!</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={(e) => e.preventDefault()}>
          {loading ? (
            <SkeletonLoader /> // Show skeleton loader while loading
          ) : confirmationResult ? renderOTPForm() : renderInitialForm()}

          <div className="relative"> 
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or continue with</span>
              </div>
            </div>
            <div className="mt-4">
              {loading ? ( // Show skeleton for Google button if loading
                <SkeletonLoader />
              ) : (
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={authLoading || googleLoading}
                  className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                >
                  {googleLoading ? (
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
                      Signing in...
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
              )}
            </div>
          </div>

          <p className="text-center text-sm text-gray-600">
            Don't have an account?{' '}
            <Link to="/donor/register" className="font-medium text-red-600 hover:text-red-500">
              Register now
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default DonorLogin;