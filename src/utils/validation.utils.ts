/**
 * Validation Utilities
 *
 * Common validation functions for forms and data
 */

/**
 * Validate email address
 */
export const validateEmail = (email: string): boolean => {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number (E.164 format)
 */
export const validatePhone = (phone: string): boolean => {
  if (!phone) return false;
  const phoneRegex = /^\+\d{10,15}$/;
  return phoneRegex.test(phone);
};

/**
 * Validate blood type
 */
export const validateBloodType = (bloodType: string): boolean => {
  const validTypes = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
  return validTypes.includes(bloodType);
};

/**
 * Validate password strength
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
export const validatePassword = (password: string): boolean => {
  if (!password || password.length < 8) return false;

  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  return hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar;
};

/**
 * Validate age for blood donation (18-65)
 */
export const validateAge = (age: number): boolean => {
  return age >= 18 && age <= 65;
};

/**
 * Validate date of birth (must be at least 18 years old)
 */
export const validateDateOfBirth = (dob: Date): boolean => {
  const today = new Date();
  const age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    return age - 1 >= 18;
  }

  return age >= 18;
};

/**
 * Validate PIN code (Indian 6-digit)
 */
export const validatePinCode = (pinCode: string): boolean => {
  if (!pinCode) return false;
  const pinRegex = /^\d{6}$/;
  return pinRegex.test(pinCode);
};

/**
 * Validate name (minimum 2 characters, only letters and spaces)
 */
export const validateName = (name: string): boolean => {
  if (!name || name.length < 2) return false;
  const nameRegex = /^[a-zA-Z\s]+$/;
  return nameRegex.test(name);
};

/**
 * Validate units (must be positive number, max 4)
 */
export const validateUnits = (units: number): boolean => {
  return units > 0 && units <= 4 && Number.isInteger(units);
};

/**
 * Validate URL
 */
export const validateURL = (url: string): boolean => {
  if (!url) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};
