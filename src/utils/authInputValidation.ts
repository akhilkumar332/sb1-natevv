import { isValidPhoneNumber, normalizePhoneNumber } from './phone';

export const authInputMessages = {
  invalidPhone: 'Please enter a valid phone number.',
  invalidIndiaPhone: 'Please enter a valid 10-digit phone number.',
  requestOtpFirst: 'Please request an OTP before verifying.',
  otpRequired: 'Please enter the OTP.',
  otpInvalidLength: 'Invalid OTP length. Please enter the 6-digit code.',
};

export const authFlowMessages = {
  otpSent: 'OTP sent successfully!',
  otpResent: 'OTP resent successfully!',
  otpSendFailed: 'Failed to send OTP. Please try again.',
  otpResendFailed: 'Failed to resend OTP. Please try again.',
  otpVerifyFailed: 'Failed to verify OTP. Please try again.',
  otpInvalid: 'Invalid OTP. Please try again.',
  otpExpired: 'OTP expired. Please request a new code.',
  verificationFailed: 'Verification failed. Please try again.',
  googleSignInFailed: 'Failed to sign in with Google. Please try again.',
  registrationFailed: 'Registration failed. Please try again.',
  emailRegistered: 'Email already registered. Please use the login page.',
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
