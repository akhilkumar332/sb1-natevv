// src/pages/bloodbank/BloodBankRegister.tsx
import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, Activity, MapPin, Shield } from 'lucide-react';
import { useBloodBankRegister } from '../../hooks/useBloodBankRegister';
import { useAuth } from '../../contexts/AuthContext';
import LogoMark from '../../components/LogoMark';

export function BloodBankRegister() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    formData,
    otpResendTimer,
    confirmationResult,
    authLoading,
    handleIdentifierChange,
    handleChange,
    handlePhoneNumberSubmit,
    handleOTPSubmit,
    handleResendOTP,
    handleGoogleRegister,
    googleLoading,
    otpLoading,
  } = useBloodBankRegister();

  useEffect(() => {
    if (user && user.role === 'bloodbank') {
      navigate('/bloodbank/dashboard');
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Gradient Background */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-red-600 via-red-700 to-yellow-500 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
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
            <h2 className="text-4xl font-bold mb-4">BloodBank Registration</h2>
            <p className="text-xl opacity-90 leading-relaxed">
              Join trusted blood banks collaborating to save lives every day.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-white/10 backdrop-blur-lg rounded-xl flex items-center justify-center">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">Verified BloodBank</h3>
                <p className="opacity-90 text-sm">Get verified access to manage blood inventory</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-white/10 backdrop-blur-lg rounded-xl flex items-center justify-center">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">Real-time Operations</h3>
                <p className="opacity-90 text-sm">Track requests, appointments, and stock</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-white/10 backdrop-blur-lg rounded-xl flex items-center justify-center">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">Local Reach</h3>
                <p className="opacity-90 text-sm">Connect with nearby donors faster</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-white/10 backdrop-blur-lg rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">Secure Platform</h3>
                <p className="opacity-90 text-sm">Compliance-ready and secure access</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Registration Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-4 py-12 bg-gradient-to-br from-red-50 via-white to-yellow-50">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-10 border border-gray-100">
            {/* Mobile Logo */}
            <div className="lg:hidden text-center mb-8">
              <div className="inline-flex items-center space-x-2">
                <LogoMark className="w-10 h-10" />
                <div>
                  <span className="font-extrabold text-2xl bg-gradient-to-r from-red-600 to-yellow-500 bg-clip-text text-transparent">
                    BloodHub
                  </span>
                </div>
              </div>
            </div>

            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-red-600 to-yellow-500 rounded-2xl mb-4">
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">BloodBank Registration</h2>
              <p className="text-gray-600">Join verified blood banks on our platform</p>
            </div>

            <div className="space-y-6">
              <button
                type="button"
                onClick={handleGoogleRegister}
                disabled={googleLoading}
                className="w-full flex items-center justify-center px-6 py-4 border-2 border-gray-200 rounded-xl shadow-sm text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {googleLoading ? (
                  <span className="flex items-center space-x-2">
                    <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                    <span>Registering...</span>
                  </span>
                ) : (
                  <>
                    <img
                      className="h-5 w-5 mr-3"
                      src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                      alt="Google logo"
                    />
                    Register with Google
                  </>
                )}
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-500">or register with phone</span>
                </div>
              </div>

              <div className="space-y-4">
                <input
                  type="tel"
                  name="identifier"
                  value={formData.identifier}
                  onChange={(e) => handleIdentifierChange(e.target.value)}
                  placeholder="Phone number"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />

                {!confirmationResult ? (
                  <button
                    type="button"
                    onClick={handlePhoneNumberSubmit}
                    disabled={authLoading}
                    className="w-full px-4 py-3 bg-gradient-to-r from-red-600 to-yellow-500 text-white rounded-xl font-semibold hover:from-red-700 hover:to-yellow-600 transition-all"
                  >
                    Send OTP
                  </button>
                ) : (
                  <div className="space-y-4">
                    <input
                      type="text"
                      name="otp"
                      value={formData.otp}
                      onChange={handleChange}
                      placeholder="Enter OTP"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={handleOTPSubmit}
                      disabled={otpLoading}
                      className="w-full px-4 py-3 bg-gradient-to-r from-red-600 to-yellow-500 text-white rounded-xl font-semibold hover:from-red-700 hover:to-yellow-600 transition-all"
                    >
                      {otpLoading ? 'Verifying...' : 'Verify & Register'}
                    </button>
                    <button
                      type="button"
                      onClick={handleResendOTP}
                      disabled={otpResendTimer > 0}
                      className="w-full text-sm text-red-600 hover:text-red-700"
                    >
                      {otpResendTimer > 0 ? `Resend OTP in ${otpResendTimer}s` : 'Resend OTP'}
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-gray-100">
                <p className="text-center text-sm text-gray-600">
                  Already have an account?{' '}
                  <Link
                    to="/bloodbank/login"
                    className="font-semibold text-red-600 hover:text-red-700 transition-colors"
                  >
                    Log in
                  </Link>
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 text-center text-sm text-gray-500">
            <p>By registering, you agree to our Terms of Service and Privacy Policy</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BloodBankRegister;
