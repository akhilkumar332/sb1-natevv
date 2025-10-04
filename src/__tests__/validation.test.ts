/**
 * Validation Tests
 *
 * Tests for validation utilities
 */

import { describe, it, expect } from 'vitest';
import {
  validateEmail,
  validatePhoneNumber,
  validateBloodType,
  validatePassword,
  validatePasswordMatch,
  validateDateOfBirth,
  validatePostalCode,
  validatePositiveNumber,
  validateNumberRange,
  validateRequiredString,
  isValidEmail,
  isValidPhoneNumber,
  formatPhoneNumber,
  calculateAge,
} from '../utils/validation';

describe('Validation Utilities', () => {
  describe('Email Validation', () => {
    it('should validate correct email addresses', () => {
      const result = validateEmail('test@example.com');
      expect(result.valid).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(validateEmail('invalid-email').valid).toBe(false);
      expect(validateEmail('test@').valid).toBe(false);
      expect(validateEmail('@example.com').valid).toBe(false);
      expect(validateEmail('test@example').valid).toBe(false);
    });

    it('should reject empty email', () => {
      const result = validateEmail('');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should check email validity with isValidEmail', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('invalid')).toBe(false);
    });
  });

  describe('Phone Number Validation', () => {
    it('should validate correct Indian phone numbers', () => {
      expect(validatePhoneNumber('9876543210').valid).toBe(true);
      expect(validatePhoneNumber('+919876543210').valid).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(validatePhoneNumber('1234567890').valid).toBe(false); // Doesn't start with 6-9
      expect(validatePhoneNumber('12345').valid).toBe(false); // Too short
      expect(validatePhoneNumber('').valid).toBe(false); // Empty
    });

    it('should format phone numbers correctly', () => {
      expect(formatPhoneNumber('9876543210')).toBe('+919876543210');
      expect(formatPhoneNumber('+919876543210')).toBe('+919876543210');
      expect(formatPhoneNumber('919876543210')).toBe('+919876543210');
    });

    it('should check phone validity with isValidPhoneNumber', () => {
      expect(isValidPhoneNumber('9876543210')).toBe(true);
      expect(isValidPhoneNumber('+919876543210')).toBe(true);
      expect(isValidPhoneNumber('1234567890')).toBe(false);
    });
  });

  describe('Blood Type Validation', () => {
    it('should validate correct blood types', () => {
      const types = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
      types.forEach(type => {
        const result = validateBloodType(type);
        expect(result.valid).toBe(true);
      });
    });

    it('should reject invalid blood types', () => {
      expect(validateBloodType('C+').valid).toBe(false);
      expect(validateBloodType('A').valid).toBe(false);
      expect(validateBloodType('').valid).toBe(false);
    });
  });

  describe('Password Validation', () => {
    it('should validate strong passwords', () => {
      const result = validatePassword('StrongPass123!');
      expect(result.valid).toBe(true);
      expect(result.strength).toBe('strong');
    });

    it('should validate medium strength passwords', () => {
      const result = validatePassword('StrongPass123');
      expect(result.valid).toBe(true);
      expect(result.strength).toBe('medium');
    });

    it('should reject weak passwords', () => {
      expect(validatePassword('weak').valid).toBe(false);
      expect(validatePassword('12345678').valid).toBe(false);
      expect(validatePassword('password').valid).toBe(false);
    });

    it('should check password match', () => {
      expect(validatePasswordMatch('password123', 'password123').valid).toBe(true);
      expect(validatePasswordMatch('password123', 'different').valid).toBe(false);
    });
  });

  describe('Date of Birth Validation', () => {
    it('should validate valid age (between 18 and 65)', () => {
      const dob = new Date();
      dob.setFullYear(dob.getFullYear() - 25); // 25 years old
      const result = validateDateOfBirth(dob);
      expect(result.valid).toBe(true);
      expect(result.age).toBe(25);
    });

    it('should reject age below 18', () => {
      const dob = new Date();
      dob.setFullYear(dob.getFullYear() - 15); // 15 years old
      const result = validateDateOfBirth(dob);
      expect(result.valid).toBe(false);
      expect(result.age).toBe(15);
    });

    it('should reject age above 65', () => {
      const dob = new Date();
      dob.setFullYear(dob.getFullYear() - 70); // 70 years old
      const result = validateDateOfBirth(dob);
      expect(result.valid).toBe(false);
      expect(result.age).toBe(70);
    });

    it('should calculate age correctly', () => {
      const dob = new Date();
      dob.setFullYear(dob.getFullYear() - 30);
      expect(calculateAge(dob)).toBe(30);
    });
  });

  describe('Postal Code Validation', () => {
    it('should validate correct Indian postal codes', () => {
      expect(validatePostalCode('400001').valid).toBe(true);
      expect(validatePostalCode('110001').valid).toBe(true);
    });

    it('should reject invalid postal codes', () => {
      expect(validatePostalCode('00001').valid).toBe(false); // Starts with 0
      expect(validatePostalCode('12345').valid).toBe(false); // Too short
      expect(validatePostalCode('1234567').valid).toBe(false); // Too long
      expect(validatePostalCode('').valid).toBe(false); // Empty
    });
  });

  describe('Number Validation', () => {
    it('should validate positive numbers', () => {
      expect(validatePositiveNumber(5, 'Count').valid).toBe(true);
      expect(validatePositiveNumber(100, 'Amount').valid).toBe(true);
    });

    it('should reject zero and negative numbers', () => {
      expect(validatePositiveNumber(0, 'Count').valid).toBe(false);
      expect(validatePositiveNumber(-5, 'Count').valid).toBe(false);
    });

    it('should validate number within range', () => {
      expect(validateNumberRange(50, 0, 100, 'Value').valid).toBe(true);
      expect(validateNumberRange(0, 0, 100, 'Value').valid).toBe(true);
      expect(validateNumberRange(100, 0, 100, 'Value').valid).toBe(true);
    });

    it('should reject number outside range', () => {
      expect(validateNumberRange(-1, 0, 100, 'Value').valid).toBe(false);
      expect(validateNumberRange(101, 0, 100, 'Value').valid).toBe(false);
    });
  });

  describe('String Validation', () => {
    it('should validate required non-empty strings', () => {
      expect(validateRequiredString('Hello', 'Name').valid).toBe(true);
    });

    it('should reject empty strings', () => {
      expect(validateRequiredString('', 'Name').valid).toBe(false);
      expect(validateRequiredString('   ', 'Name').valid).toBe(false);
    });

    it('should validate string length', () => {
      expect(validateRequiredString('Hello', 'Name', 3, 10).valid).toBe(true);
      expect(validateRequiredString('Hi', 'Name', 3, 10).valid).toBe(false); // Too short
      expect(validateRequiredString('Very long string', 'Name', 3, 10).valid).toBe(false); // Too long
    });
  });
});
