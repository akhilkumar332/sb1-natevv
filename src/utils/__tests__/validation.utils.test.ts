/**
 * Tests for Validation Utilities
 */

import { describe, it, expect } from 'vitest';
import {
  validateEmail,
  validatePhone,
  validateBloodType,
  validatePassword,
  validateAge,
} from '../validation.utils';

describe('validateEmail', () => {
  it('should validate correct email addresses', () => {
    expect(validateEmail('test@example.com')).toBe(true);
    expect(validateEmail('user.name@domain.co.in')).toBe(true);
    expect(validateEmail('user+tag@example.com')).toBe(true);
  });

  it('should reject invalid email addresses', () => {
    expect(validateEmail('invalid')).toBe(false);
    expect(validateEmail('invalid@')).toBe(false);
    expect(validateEmail('@domain.com')).toBe(false);
    expect(validateEmail('user@')).toBe(false);
    expect(validateEmail('')).toBe(false);
  });
});

describe('validatePhone', () => {
  it('should validate correct phone numbers', () => {
    expect(validatePhone('+919876543210')).toBe(true);
    expect(validatePhone('+1234567890')).toBe(true);
  });

  it('should reject invalid phone numbers', () => {
    expect(validatePhone('123')).toBe(false);
    expect(validatePhone('abcdefghij')).toBe(false);
    expect(validatePhone('')).toBe(false);
    expect(validatePhone('123-456-7890')).toBe(false);
  });
});

describe('validateBloodType', () => {
  it('should validate correct blood types', () => {
    expect(validateBloodType('A+')).toBe(true);
    expect(validateBloodType('A-')).toBe(true);
    expect(validateBloodType('B+')).toBe(true);
    expect(validateBloodType('B-')).toBe(true);
    expect(validateBloodType('O+')).toBe(true);
    expect(validateBloodType('O-')).toBe(true);
    expect(validateBloodType('AB+')).toBe(true);
    expect(validateBloodType('AB-')).toBe(true);
  });

  it('should reject invalid blood types', () => {
    expect(validateBloodType('C+')).toBe(false);
    expect(validateBloodType('A')).toBe(false);
    expect(validateBloodType('a+')).toBe(false);
    expect(validateBloodType('')).toBe(false);
    expect(validateBloodType('ABC+')).toBe(false);
  });
});

describe('validatePassword', () => {
  it('should validate strong passwords', () => {
    expect(validatePassword('Password123!')).toBe(true);
    expect(validatePassword('MyStr0ng@Pass')).toBe(true);
    expect(validatePassword('Test@1234')).toBe(true);
  });

  it('should reject weak passwords', () => {
    expect(validatePassword('short')).toBe(false);
    expect(validatePassword('onlylowercase')).toBe(false);
    expect(validatePassword('ONLYUPPERCASE')).toBe(false);
    expect(validatePassword('NoNumbers!')).toBe(false);
    expect(validatePassword('NoSpecial123')).toBe(false);
    expect(validatePassword('')).toBe(false);
  });
});

describe('validateAge', () => {
  it('should validate eligible donor ages (18-65)', () => {
    expect(validateAge(18)).toBe(true);
    expect(validateAge(25)).toBe(true);
    expect(validateAge(65)).toBe(true);
  });

  it('should reject ineligible ages', () => {
    expect(validateAge(17)).toBe(false);
    expect(validateAge(66)).toBe(false);
    expect(validateAge(0)).toBe(false);
    expect(validateAge(-5)).toBe(false);
    expect(validateAge(100)).toBe(false);
  });
});
