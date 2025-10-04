/**
 * Firestore Utilities Tests
 *
 * Tests for Firestore utility functions
 */

import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import {
  timestampToDate,
  dateToTimestamp,
  removeUndefined,
  convertTimestamps,
  isPermissionError,
  isNotFoundError,
  getFirestoreErrorMessage,
} from '../utils/firestore.utils';

describe('Firestore Utilities', () => {
  describe('Timestamp Conversion', () => {
    it('should convert Timestamp to Date', () => {
      const now = new Date();
      const timestamp = Timestamp.fromDate(now);
      const converted = timestampToDate(timestamp);

      expect(converted).toBeInstanceOf(Date);
      expect(converted?.getTime()).toBeCloseTo(now.getTime(), -2); // Within 100ms
    });

    it('should return undefined for null timestamp', () => {
      expect(timestampToDate(null)).toBeUndefined();
      expect(timestampToDate(undefined)).toBeUndefined();
    });

    it('should handle Date objects in timestampToDate', () => {
      const now = new Date();
      const result = timestampToDate(now as any);
      expect(result).toBeInstanceOf(Date);
    });

    it('should convert Date to Timestamp', () => {
      const now = new Date();
      const timestamp = dateToTimestamp(now);

      expect(timestamp).toBeDefined();
      expect(timestamp).toBeInstanceOf(Timestamp);
    });

    it('should return undefined for null date', () => {
      expect(dateToTimestamp(null)).toBeUndefined();
      expect(dateToTimestamp(undefined)).toBeUndefined();
    });

    it('should convert string date to Timestamp', () => {
      const dateStr = '2024-01-15';
      const timestamp = dateToTimestamp(dateStr);

      expect(timestamp).toBeDefined();
      expect(timestamp).toBeInstanceOf(Timestamp);
    });

    it('should convert milliseconds to Timestamp', () => {
      const ms = Date.now();
      const timestamp = dateToTimestamp(ms);

      expect(timestamp).toBeDefined();
      expect(timestamp).toBeInstanceOf(Timestamp);
    });
  });

  describe('Object Utilities', () => {
    it('should remove undefined values from object', () => {
      const obj = {
        name: 'John',
        age: undefined,
        email: 'john@example.com',
        phone: undefined,
      };

      const cleaned = removeUndefined(obj);

      expect(cleaned).toEqual({
        name: 'John',
        email: 'john@example.com',
      });
    });

    it('should keep null values when removing undefined', () => {
      const obj = {
        name: 'John',
        age: null,
        email: undefined,
      };

      const cleaned = removeUndefined(obj);

      expect(cleaned).toEqual({
        name: 'John',
        age: null,
      });
    });

    it('should convert multiple timestamp fields', () => {
      const now = new Date();
      const timestamp = Timestamp.fromDate(now);

      const data = {
        name: 'Test',
        createdAt: timestamp,
        updatedAt: timestamp,
        count: 5,
      };

      const converted = convertTimestamps(data, ['createdAt', 'updatedAt']);

      expect(converted.createdAt).toBeInstanceOf(Date);
      expect(converted.updatedAt).toBeInstanceOf(Date);
      expect(converted.count).toBe(5);
    });
  });

  describe('Error Handling', () => {
    it('should identify permission errors', () => {
      const permissionError = { code: 'permission-denied' };
      expect(isPermissionError(permissionError)).toBe(true);

      const otherError = { code: 'not-found' };
      expect(isPermissionError(otherError)).toBe(false);
    });

    it('should identify not found errors', () => {
      const notFoundError = { code: 'not-found' };
      expect(isNotFoundError(notFoundError)).toBe(true);

      const otherError = { code: 'permission-denied' };
      expect(isNotFoundError(otherError)).toBe(false);
    });

    it('should return user-friendly error messages', () => {
      const permissionMsg = getFirestoreErrorMessage('permission-denied');
      const notFoundMsg = getFirestoreErrorMessage('not-found');
      const unavailableMsg = getFirestoreErrorMessage('unavailable');
      const unknownMsg = getFirestoreErrorMessage('unknown-code');

      expect(permissionMsg).toBeDefined();
      expect(notFoundMsg).toBeDefined();
      expect(unavailableMsg).toBeDefined();
      expect(unknownMsg).toBeDefined();

      // Should not return undefined
      expect(typeof permissionMsg).toBe('string');
      expect(typeof notFoundMsg).toBe('string');
      expect(typeof unavailableMsg).toBe('string');
      expect(typeof unknownMsg).toBe('string');
    });
  });
});
