import { isValidPhoneNumber, normalizePhoneNumber } from './phone';
import i18n from '../i18n';

export const authInputMessages = {
  get invalidPhone() { return i18n.t('auth.invalidPhone'); },
  get invalidIndiaPhone() { return i18n.t('auth.invalidIndiaPhone'); },
  get requestOtpFirst() { return i18n.t('auth.requestOtpFirst'); },
  get otpRequired() { return i18n.t('auth.otpRequired'); },
  get otpInvalidLength() { return i18n.t('auth.otpInvalidLength'); },
};

export const authFlowMessages = {
  get otpSent() { return i18n.t('auth.otpSent'); },
  get otpResent() { return i18n.t('auth.otpResent'); },
  get otpSendFailed() { return i18n.t('auth.otpSendFailed'); },
  get otpResendFailed() { return i18n.t('auth.otpResendFailed'); },
  get otpVerifyFailed() { return i18n.t('auth.otpVerifyFailed'); },
  get otpInvalid() { return i18n.t('auth.otpInvalid'); },
  get otpExpired() { return i18n.t('auth.otpExpired'); },
  get verificationFailed() { return i18n.t('auth.verificationFailed'); },
  get googleSignInFailed() { return i18n.t('auth.googleSignInFailed'); },
  get registrationFailed() { return i18n.t('auth.registrationFailed'); },
  get emailRegistered() { return i18n.t('auth.emailRegistered'); },
};

export const sanitizeOtp = (value: string) => value.replace(/\D/g, '').trim();

export const getOtpValidationError = (otp: string) => {
  const sanitized = sanitizeOtp(otp);
  if (!sanitized) return authInputMessages.otpRequired;
  if (sanitized.length !== 6) return authInputMessages.otpInvalidLength;
  return null;
};

export const validateGeneralPhoneInput = (value: string) => {
  const normalized = normalizePhoneNumber(value);
  if (!isValidPhoneNumber(normalized)) {
    return { normalized, error: authInputMessages.invalidPhone };
  }
  return { normalized, error: null as string | null };
};

export const validateIndiaPhoneInput = (value: string) => {
  const digitsOnly = value.replace(/\D/g, '');
  const isValid10Digits = digitsOnly.length === 10 || (digitsOnly.startsWith('91') && digitsOnly.length === 12);
  if (!isValid10Digits) {
    return { error: authInputMessages.invalidIndiaPhone };
  }
  return {
    error: null as string | null,
    phoneNumber: value.startsWith('+') ? value : `+${value}`,
  };
};
