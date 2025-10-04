/**
 * Validation Utility Functions
 *
 * This file provides validation functions for various data types
 * used throughout the application.
 */

import {
  BLOOD_TYPES,
  USER_ROLES,
  VALIDATION_PATTERNS,
  ERROR_MESSAGES,
  DEFAULT_VALUES,
  INDIAN_STATES,
} from '../constants/app.constants';
import { BloodType, UserRole } from '../types/database.types';

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Check if value is a valid blood type
 * @param value - Value to check
 * @returns Type predicate for BloodType
 */
export const isBloodType = (value: any): value is BloodType => {
  return BLOOD_TYPES.includes(value);
};

/**
 * Check if value is a valid user role
 * @param value - Value to check
 * @returns Type predicate for UserRole
 */
export const isUserRole = (value: any): value is UserRole => {
  return USER_ROLES.includes(value);
};

// ============================================================================
// BLOOD TYPE VALIDATION
// ============================================================================

/**
 * Validate blood type
 * @param bloodType - Blood type to validate
 * @returns Validation result with error message if invalid
 */
export const validateBloodType = (
  bloodType: string
): { valid: boolean; error?: string } => {
  if (!bloodType) {
    return { valid: false, error: 'Blood type is required' };
  }

  if (!isBloodType(bloodType)) {
    return {
      valid: false,
      error: `Invalid blood type. Must be one of: ${BLOOD_TYPES.join(', ')}`,
    };
  }

  return { valid: true };
};

// ============================================================================
// EMAIL VALIDATION
// ============================================================================

/**
 * Validate email address
 * @param email - Email to validate
 * @returns Validation result with error message if invalid
 */
export const validateEmail = (email: string): { valid: boolean; error?: string } => {
  if (!email) {
    return { valid: false, error: ERROR_MESSAGES.REQUIRED_FIELD };
  }

  if (!VALIDATION_PATTERNS.EMAIL.test(email)) {
    return { valid: false, error: ERROR_MESSAGES.INVALID_EMAIL };
  }

  return { valid: true };
};

/**
 * Check if string is a valid email (simple check)
 * @param email - Email to check
 * @returns Boolean indicating if email is valid
 */
export const isValidEmail = (email: string): boolean => {
  return VALIDATION_PATTERNS.EMAIL.test(email);
};

// ============================================================================
// PHONE NUMBER VALIDATION
// ============================================================================

/**
 * Validate Indian phone number
 * @param phone - Phone number to validate
 * @returns Validation result with error message if invalid
 */
export const validatePhoneNumber = (
  phone: string
): { valid: boolean; error?: string } => {
  if (!phone) {
    return { valid: false, error: ERROR_MESSAGES.REQUIRED_FIELD };
  }

  // Remove spaces and dashes
  const cleanPhone = phone.replace(/[\s-]/g, '');

  // Check for +91 prefix
  if (cleanPhone.startsWith('+91')) {
    const number = cleanPhone.substring(3);
    if (!VALIDATION_PATTERNS.PHONE.test(number)) {
      return { valid: false, error: ERROR_MESSAGES.INVALID_PHONE };
    }
  } else if (!VALIDATION_PATTERNS.PHONE.test(cleanPhone)) {
    return { valid: false, error: ERROR_MESSAGES.INVALID_PHONE };
  }

  return { valid: true };
};

/**
 * Format phone number with +91 country code
 * @param phone - Phone number to format
 * @returns Formatted phone number with +91 prefix
 */
export const formatPhoneNumber = (phone: string): string => {
  const cleanPhone = phone.replace(/[\s-]/g, '');

  if (cleanPhone.startsWith('+91')) {
    return cleanPhone;
  }

  if (cleanPhone.startsWith('91') && cleanPhone.length === 12) {
    return '+' + cleanPhone;
  }

  if (cleanPhone.length === 10) {
    return '+91' + cleanPhone;
  }

  return phone;
};

/**
 * Check if string is a valid phone number
 * @param phone - Phone number to check
 * @returns Boolean indicating if phone is valid
 */
export const isValidPhoneNumber = (phone: string): boolean => {
  const cleanPhone = phone.replace(/[\s-]/g, '');
  return (
    VALIDATION_PATTERNS.PHONE.test(cleanPhone) ||
    VALIDATION_PATTERNS.PHONE_WITH_CODE.test(cleanPhone)
  );
};

// ============================================================================
// DATE VALIDATION
// ============================================================================

/**
 * Validate date of birth (age eligibility for donation)
 * @param dateOfBirth - Date of birth to validate
 * @returns Validation result with error message if invalid
 */
export const validateDateOfBirth = (
  dateOfBirth: Date | string
): { valid: boolean; error?: string; age?: number } => {
  if (!dateOfBirth) {
    return { valid: false, error: 'Date of birth is required' };
  }

  const dob = typeof dateOfBirth === 'string' ? new Date(dateOfBirth) : dateOfBirth;

  if (isNaN(dob.getTime())) {
    return { valid: false, error: 'Invalid date format' };
  }

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }

  if (age < DEFAULT_VALUES.MIN_DONOR_AGE) {
    return {
      valid: false,
      error: ERROR_MESSAGES.MIN_AGE,
      age,
    };
  }

  if (age > DEFAULT_VALUES.MAX_DONOR_AGE) {
    return {
      valid: false,
      error: ERROR_MESSAGES.MAX_AGE,
      age,
    };
  }

  return { valid: true, age };
};

/**
 * Calculate age from date of birth
 * @param dateOfBirth - Date of birth
 * @returns Age in years
 */
export const calculateAge = (dateOfBirth: Date | string): number => {
  const dob = typeof dateOfBirth === 'string' ? new Date(dateOfBirth) : dateOfBirth;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }

  return age;
};

/**
 * Check if date is in the past
 * @param date - Date to check
 * @returns Boolean indicating if date is in the past
 */
export const isPastDate = (date: Date | string): boolean => {
  const checkDate = typeof date === 'string' ? new Date(date) : date;
  return checkDate < new Date();
};

/**
 * Check if date is in the future
 * @param date - Date to check
 * @returns Boolean indicating if date is in the future
 */
export const isFutureDate = (date: Date | string): boolean => {
  const checkDate = typeof date === 'string' ? new Date(date) : date;
  return checkDate > new Date();
};

/**
 * Validate donation eligibility based on last donation date
 * @param lastDonationDate - Date of last donation
 * @returns Validation result with days remaining
 */
export const validateDonationEligibility = (
  lastDonationDate: Date | string | null
): { eligible: boolean; daysRemaining: number; error?: string } => {
  if (!lastDonationDate) {
    return { eligible: true, daysRemaining: 0 };
  }

  const lastDonation =
    typeof lastDonationDate === 'string' ? new Date(lastDonationDate) : lastDonationDate;

  const daysSinceLastDonation = Math.floor(
    (Date.now() - lastDonation.getTime()) / (1000 * 60 * 60 * 24)
  );

  const daysRemaining =
    DEFAULT_VALUES.MIN_DONATION_INTERVAL_DAYS - daysSinceLastDonation;

  if (daysRemaining > 0) {
    return {
      eligible: false,
      daysRemaining,
      error: `You can donate again in ${daysRemaining} days`,
    };
  }

  return { eligible: true, daysRemaining: 0 };
};

// ============================================================================
// LOCATION VALIDATION
// ============================================================================

/**
 * Validate postal code
 * @param postalCode - Postal code to validate
 * @returns Validation result with error message if invalid
 */
export const validatePostalCode = (
  postalCode: string
): { valid: boolean; error?: string } => {
  if (!postalCode) {
    return { valid: false, error: ERROR_MESSAGES.REQUIRED_FIELD };
  }

  if (!VALIDATION_PATTERNS.POSTAL_CODE.test(postalCode)) {
    return { valid: false, error: ERROR_MESSAGES.INVALID_POSTAL_CODE };
  }

  return { valid: true };
};

/**
 * Validate Indian state
 * @param state - State to validate
 * @returns Validation result with error message if invalid
 */
export const validateState = (state: string): { valid: boolean; error?: string } => {
  if (!state) {
    return { valid: false, error: 'State is required' };
  }

  if (!INDIAN_STATES.includes(state as any)) {
    return { valid: false, error: 'Invalid Indian state' };
  }

  return { valid: true };
};

/**
 * Validate coordinates
 * @param latitude - Latitude
 * @param longitude - Longitude
 * @returns Validation result with error message if invalid
 */
export const validateCoordinates = (
  latitude: number,
  longitude: number
): { valid: boolean; error?: string } => {
  if (latitude < -90 || latitude > 90) {
    return { valid: false, error: 'Latitude must be between -90 and 90' };
  }

  if (longitude < -180 || longitude > 180) {
    return { valid: false, error: 'Longitude must be between -180 and 180' };
  }

  return { valid: true };
};

// ============================================================================
// PASSWORD VALIDATION
// ============================================================================

/**
 * Validate password strength
 * @param password - Password to validate
 * @returns Validation result with error message if invalid
 */
export const validatePassword = (
  password: string
): { valid: boolean; error?: string; strength?: 'weak' | 'medium' | 'strong' } => {
  if (!password) {
    return { valid: false, error: ERROR_MESSAGES.REQUIRED_FIELD };
  }

  if (password.length < 8) {
    return {
      valid: false,
      error: 'Password must be at least 8 characters long',
      strength: 'weak',
    };
  }

  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialChar = /[@$!%*?&]/.test(password);

  const criteriaMet = [hasUpperCase, hasLowerCase, hasNumber, hasSpecialChar].filter(
    Boolean
  ).length;

  if (criteriaMet < 3) {
    return {
      valid: false,
      error: ERROR_MESSAGES.WEAK_PASSWORD,
      strength: 'weak',
    };
  }

  const strength = criteriaMet === 4 ? 'strong' : 'medium';

  return { valid: true, strength };
};

/**
 * Validate password confirmation
 * @param password - Original password
 * @param confirmPassword - Confirmation password
 * @returns Validation result with error message if invalid
 */
export const validatePasswordMatch = (
  password: string,
  confirmPassword: string
): { valid: boolean; error?: string } => {
  if (password !== confirmPassword) {
    return { valid: false, error: ERROR_MESSAGES.PASSWORD_MISMATCH };
  }

  return { valid: true };
};

// ============================================================================
// ROLE VALIDATION
// ============================================================================

/**
 * Validate user role
 * @param role - Role to validate
 * @returns Validation result with error message if invalid
 */
export const validateRole = (role: string): { valid: boolean; error?: string } => {
  if (!role) {
    return { valid: false, error: 'Role is required' };
  }

  if (!isUserRole(role)) {
    return { valid: false, error: `Invalid role. Must be one of: ${USER_ROLES.join(', ')}` };
  }

  return { valid: true };
};

// ============================================================================
// NUMERIC VALIDATION
// ============================================================================

/**
 * Validate positive number
 * @param value - Number to validate
 * @param fieldName - Name of the field for error message
 * @returns Validation result with error message if invalid
 */
export const validatePositiveNumber = (
  value: number,
  fieldName: string = 'Value'
): { valid: boolean; error?: string } => {
  if (value === null || value === undefined) {
    return { valid: false, error: `${fieldName} is required` };
  }

  if (typeof value !== 'number' || isNaN(value)) {
    return { valid: false, error: `${fieldName} must be a number` };
  }

  if (value <= 0) {
    return { valid: false, error: `${fieldName} must be greater than 0` };
  }

  return { valid: true };
};

/**
 * Validate number range
 * @param value - Number to validate
 * @param min - Minimum value
 * @param max - Maximum value
 * @param fieldName - Name of the field for error message
 * @returns Validation result with error message if invalid
 */
export const validateNumberRange = (
  value: number,
  min: number,
  max: number,
  fieldName: string = 'Value'
): { valid: boolean; error?: string } => {
  if (value === null || value === undefined) {
    return { valid: false, error: `${fieldName} is required` };
  }

  if (typeof value !== 'number' || isNaN(value)) {
    return { valid: false, error: `${fieldName} must be a number` };
  }

  if (value < min || value > max) {
    return { valid: false, error: `${fieldName} must be between ${min} and ${max}` };
  }

  return { valid: true };
};

// ============================================================================
// STRING VALIDATION
// ============================================================================

/**
 * Validate required string field
 * @param value - String to validate
 * @param fieldName - Name of the field for error message
 * @param minLength - Minimum length (optional)
 * @param maxLength - Maximum length (optional)
 * @returns Validation result with error message if invalid
 */
export const validateRequiredString = (
  value: string,
  fieldName: string = 'Field',
  minLength?: number,
  maxLength?: number
): { valid: boolean; error?: string } => {
  if (!value || value.trim().length === 0) {
    return { valid: false, error: `${fieldName} is required` };
  }

  if (minLength && value.trim().length < minLength) {
    return {
      valid: false,
      error: `${fieldName} must be at least ${minLength} characters`,
    };
  }

  if (maxLength && value.trim().length > maxLength) {
    return {
      valid: false,
      error: `${fieldName} must not exceed ${maxLength} characters`,
    };
  }

  return { valid: true };
};

/**
 * Validate URL
 * @param url - URL to validate
 * @returns Validation result with error message if invalid
 */
export const validateURL = (url: string): { valid: boolean; error?: string } => {
  if (!url) {
    return { valid: false, error: 'URL is required' };
  }

  try {
    new URL(url);
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
};

// ============================================================================
// ARRAY VALIDATION
// ============================================================================

/**
 * Validate non-empty array
 * @param array - Array to validate
 * @param fieldName - Name of the field for error message
 * @returns Validation result with error message if invalid
 */
export const validateNonEmptyArray = (
  array: any[],
  fieldName: string = 'Field'
): { valid: boolean; error?: string } => {
  if (!Array.isArray(array) || array.length === 0) {
    return { valid: false, error: `${fieldName} must contain at least one item` };
  }

  return { valid: true };
};

// ============================================================================
// COMPOSITE VALIDATION
// ============================================================================

/**
 * Validate multiple fields and return all errors
 * @param validations - Array of validation results
 * @returns Combined validation result with all errors
 */
export const combineValidations = (
  validations: Array<{ valid: boolean; error?: string }>
): { valid: boolean; errors: string[] } => {
  const errors = validations
    .filter(v => !v.valid && v.error)
    .map(v => v.error as string);

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Sanitize string input (remove potentially harmful characters)
 * @param input - String to sanitize
 * @returns Sanitized string
 */
export const sanitizeInput = (input: string): string => {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove angle brackets to prevent XSS
    .replace(/\s+/g, ' '); // Normalize whitespace
};
