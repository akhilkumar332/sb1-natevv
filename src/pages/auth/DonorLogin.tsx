// src/pages/auth/DonorLogin.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Phone } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

interface LoginFormData {
  identifier: string;
  otp: string;
}

export function DonorLogin() {
  const [formData, setFormData] = useState<LoginFormData>({
    identifier: '',
    otp: ''
  });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [otpResendTimer, setOtpResendTimer] = useState(0);
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const navigate = useNavigate();
  const { loginWithGoogle, loginWithPhone, verifyOTP, user } = useAuth();

  useEffect(() => {
    if (user) {
      navigate('/donor/dashboard');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (confirmationResult) {
      startResendTimer();
    }
  }, [confirmationResult]);

  const handleIdentifierChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      identifier: value
    }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePhoneNumberSubmit = async () => {
    const digitsOnly = formData.identifier.replace(/\D/g, '');
    const isValid10Digits = digitsOnly.length === 10 || 
      (digitsOnly.startsWith('91') && digitsOnly.length === 12);
  
    if (!isValid10Digits) {
      toast.error('Please enter a valid 10-digit phone number.');
      return;
    }
  
    try {
      setLoading(true);
      const confirmation = await loginWithPhone(formData.identifier);
      setConfirmationResult(confirmation);
      toast.success('OTP sent successfully!');
    } catch (error) {
      toast.error('Please register as a donor first before signing in.');
    } finally {
      setLoading(false);
    }
  };

  const handleOTPSubmit = async () => {
    if (!formData.otp) {
      toast.error('Please enter the OTP.');
      return;
    }
    try {
      setLoading(true);
      await verifyOTP(confirmationResult, formData.otp);
      toast.success('Login successful!');
    } catch (error) {
      toast.error('Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const startResendTimer = () => {
    setOtpResendTimer(30);
    const timer = setInterval(() => {
      setOtpResendTimer((prevTime) => {
        if (prevTime <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);
  };
  
  const handleResendOTP = async () => {
    try {
      setLoading(true);
      const confirmation = await loginWithPhone(formData.identifier);
      setConfirmationResult(confirmation);
      toast.success('OTP resent successfully!');
      startResendTimer();
    } catch (error) {
      toast.error('Failed to resend OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setGoogleLoading(true);
      await loginWithGoogle();
      toast.success('Successfully logged in with Google!');
      navigate('/donor/dashboard');
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('Failed to sign in with Google. Please try again.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

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
        disabled={loading || formData.identifier.replace(/\D/g, '').length !== 10 &&
                   formData.identifier.replace(/\D/g, '').length !== 12}
        className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Processing...' : 'Send OTP'}
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
        disabled={loading}
        className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
      >
        {loading ? 'Verifying...' : 'Verify OTP'}
      </button>
  
      <div className="text-center">
        {otpResendTimer > 0 ? (
          <p className="text-sm text-gray-500">Resend OTP in {otpResendTimer} seconds</p>
        ) : (
          <button
            type="button"
            onClick={handleResendOTP}
            disabled={loading}
            className="text-sm text-red-600 hover:text-red-500"
          >
            Resend OTP
          </button>
        )}
      </div>
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
          {confirmationResult ? renderOTPForm() : renderInitialForm()}

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
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading || googleLoading}
                className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
              >
                {googleLoading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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