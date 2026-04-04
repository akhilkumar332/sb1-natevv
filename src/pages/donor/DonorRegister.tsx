// src/pages/auth/DonorRegister.tsx
import { useEffect, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Phone, Heart, Shield, Users, Award, ArrowRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import PhoneInput from 'react-phone-number-input';
import { useRegister } from '../../hooks/useRegister';
import 'react-phone-number-input/style.css';
import LogoMark from '../../components/LogoMark';
import { ROUTES } from '../../constants/routes';
import { readRegistrationIntent } from '../../utils/registrationIntent';

export function DonorRegister() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, profileResolved } = useAuth();
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
    handleGoogleRegister
  } = useRegister();

  useEffect(() => {
    if (!user || !profileResolved || hasNavigated.current) {
      return;
    }
    if (readRegistrationIntent()) {
      return;
    }
    if (user.role !== 'donor') {
      return;
    }
    hasNavigated.current = true;
    if (!user.onboardingCompleted) {
      navigate(ROUTES.portal.donor.onboarding);
      return;
    }
    navigate(ROUTES.portal.donor.dashboard.root);
  }, [navigate, profileResolved, user]);

  const renderInitialForm = () => (
    <div className="space-y-6">
      <div>
        <label htmlFor="identifier" className="block text-sm font-semibold text-gray-700 mb-2">
          {t('auth.phoneNumber')}
        </label>
        <div className="relative">
          <PhoneInput
            international
            defaultCountry="IN"
            countryCallingCodeEditable={false}
            value={formData.identifier}
            onChange={(value) => handleIdentifierChange(value || '')}
            className="block w-full rounded-xl border-2 border-gray-200 px-4 py-3 transition-colors focus:border-red-500 focus:outline-none [&_.PhoneInputInput]:bg-white [&_.PhoneInputInput]:text-gray-900 [&_.PhoneInputInput]:outline-none [&_.PhoneInputInput]:placeholder:text-gray-400 dark:[&_.PhoneInputInput]:bg-white dark:[&_.PhoneInputInput]:text-gray-900"
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
            <span>{t('common.processing')}</span>
          </>
        ) : (
          <>
            <span>{t('auth.sendOtp')}</span>
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
          {t('auth.enterOtp')}
        </label>
        <div className="relative">
          <input
            id="otp"
            name="otp"
            type="text"
            required
            value={formData.otp}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              const numericOtp = event.target.value.replace(/\D/g, '').slice(0, 6);
              handleChange({
                ...event,
                target: {
                  ...event.target,
                  name: 'otp',
                  value: numericOtp,
                },
              } as ChangeEvent<HTMLInputElement>);
            }}
            disabled={otpLoading}
            maxLength={6}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            className="block w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none transition-colors text-center text-2xl font-bold tracking-widest disabled:opacity-50"
            placeholder="000000"
          />
        </div>
        <p className="mt-2 text-sm text-gray-500 text-center">
          {t('auth.weSentCode')}
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
            <span>{t('common.verifying')}</span>
          </>
        ) : (
          <>
            <span>{t('auth.verifyOtp')}</span>
            <ArrowRight className="w-5 h-5" />
          </>
        )}
      </button>

      <div className="text-center">
        {otpResendTimer > 0 ? (
          <p className="text-sm text-gray-500">
            {t('auth.resendOtpIn', { seconds: otpResendTimer })}
          </p>
        ) : (
          <button
            type="button"
            onClick={handleResendOTP}
            disabled={otpLoading}
            className="text-sm text-red-600 hover:text-red-700 font-semibold disabled:opacity-50 transition-colors"
          >
            {t('auth.resendOtp')}
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
              <LogoMark className="w-12 h-12" />
              <div>
                <h1 className="text-3xl font-extrabold">BloodHub</h1>
                <p className="text-sm tracking-wider opacity-90">{t('brand.india')}</p>
              </div>
            </div>
            <h2 className="text-4xl font-bold mb-4">{t('auth.becomeLifeSaver')}</h2>
            <p className="text-xl opacity-90 leading-relaxed">
              {t('auth.joinHeroes')}
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-white/10 backdrop-blur-lg rounded-xl flex items-center justify-center">
                <Heart className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">{t('auth.saveLives')}</h3>
                <p className="opacity-90 text-sm">{t('auth.saveLivesText')}</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-white/10 backdrop-blur-lg rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">{t('auth.joinCommunity')}</h3>
                <p className="opacity-90 text-sm">{t('auth.joinCommunityText')}</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-white/10 backdrop-blur-lg rounded-xl flex items-center justify-center">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">{t('auth.trackImpact')}</h3>
                <p className="opacity-90 text-sm">{t('auth.trackImpactText')}</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-white/10 backdrop-blur-lg rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">{t('auth.safeSecure')}</h3>
                <p className="opacity-90 text-sm">{t('auth.safeSecureText')}</p>
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
                  <span className="font-extrabold text-2xl bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
                    BloodHub
                  </span>
                </div>
              </div>
            </div>

            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-red-600 to-red-700 rounded-2xl mb-4">
                <Heart className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">{t('auth.donorRegister')}</h2>
              <p className="text-gray-600">{t('auth.registerSubtitle')}</p>
            </div>

            <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
              {confirmationResult ? renderOTPForm() : renderInitialForm()}

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-500 font-medium">{t('auth.orContinueWith')}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleRegister}
                disabled={authLoading || googleLoading || otpLoading}
                className="w-full flex items-center justify-center px-6 py-4 border-2 border-gray-200 rounded-xl shadow-sm text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {googleLoading || otpLoading ? (
                  <span className="flex items-center space-x-2">
                    <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                    <span>{googleLoading ? t('auth.registerNow') : t('common.verifying')}</span>
                  </span>
                ) : (
                  <>
                    <img
                      className="h-5 w-5 mr-3"
                      src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                      alt="Google logo"
                    />
                    {t('auth.signInWithGoogle')}
                  </>
                )}
              </button>

              <div className="pt-4 border-t border-gray-100">
                <p className="text-center text-sm text-gray-600">
                  {t('auth.alreadyHaveAccount')}{' '}
                  <Link
                    to={ROUTES.portal.donor.login}
                    className="font-semibold text-red-600 hover:text-red-700 transition-colors"
                  >
                    {t('auth.loginNow')}
                  </Link>
                </p>
              </div>
            </form>
          </div>

          {/* Benefits */}
          <div className="mt-6 bg-gradient-to-r from-red-50 to-pink-50 rounded-2xl p-6 border border-red-100">
            <h3 className="font-bold text-gray-900 mb-3 flex items-center">
              <Heart className="w-5 h-5 text-red-600 mr-2" />
              {t('auth.whyDonateBlood')}
            </h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-center">
                <span className="w-1.5 h-1.5 bg-red-600 rounded-full mr-2"></span>
                {t('auth.benefitSaveThreeLives')}
              </li>
              <li className="flex items-center">
                <span className="w-1.5 h-1.5 bg-red-600 rounded-full mr-2"></span>
                {t('auth.benefitFreeCheckup')}
              </li>
              <li className="flex items-center">
                <span className="w-1.5 h-1.5 bg-red-600 rounded-full mr-2"></span>
                {t('auth.benefitHeartRisk')}
              </li>
              <li className="flex items-center">
                <span className="w-1.5 h-1.5 bg-red-600 rounded-full mr-2"></span>
                {t('auth.benefitJoinHeroes')}
              </li>
            </ul>
          </div>

          {/* Terms */}
          <div className="mt-4 text-center text-xs text-gray-500">
            <p>{t('auth.registerConsent')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DonorRegister;
