/**
 * Data Transformation Utilities
 *
 * This file provides functions for transforming data between
 * Firestore format and application format, handling null/undefined values,
 * and array manipulation.
 */

import { Timestamp } from 'firebase/firestore';
import { timestampToDate, dateToTimestamp } from './firestore.utils';
import {
  User,
  Donation,
  BloodRequest,
  Campaign,
  Appointment,
  Notification,
} from '../types/database.types';

// ============================================================================
// USER DATA TRANSFORMATION
// ============================================================================

/**
 * Transform Firestore user data to application format
 * @param firestoreData - Raw data from Firestore
 * @returns Transformed user data
 */
export const transformUserFromFirestore = (firestoreData: any): User => {
  return {
    ...firestoreData,
    createdAt: timestampToDate(firestoreData.createdAt) as any,
    lastLoginAt: timestampToDate(firestoreData.lastLoginAt) as any,
    dateOfBirth: timestampToDate(firestoreData.dateOfBirth),
    lastDonation: timestampToDate(firestoreData.lastDonation),
  } as User;
};

/**
 * Transform application user data to Firestore format
 * @param userData - User data from application
 * @returns Data ready for Firestore
 */
export const transformUserToFirestore = (userData: Partial<User>): any => {
  const result: any = { ...userData };

  if (result.createdAt instanceof Date) {
    result.createdAt = dateToTimestamp(result.createdAt);
  }
  if (result.lastLoginAt instanceof Date) {
    result.lastLoginAt = dateToTimestamp(result.lastLoginAt);
  }
  if (result.dateOfBirth instanceof Date) {
    result.dateOfBirth = dateToTimestamp(result.dateOfBirth);
  }
  if (result.lastDonation instanceof Date) {
    result.lastDonation = dateToTimestamp(result.lastDonation);
  }

  // Remove undefined values
  Object.keys(result).forEach(key => {
    if (result[key] === undefined) {
      delete result[key];
    }
  });

  return result;
};

// ============================================================================
// DONATION DATA TRANSFORMATION
// ============================================================================

/**
 * Transform Firestore donation data to application format
 * @param firestoreData - Raw data from Firestore
 * @returns Transformed donation data
 */
export const transformDonationFromFirestore = (firestoreData: any): Donation => {
  return {
    ...firestoreData,
    donationDate: timestampToDate(firestoreData.donationDate) as any,
    createdAt: timestampToDate(firestoreData.createdAt) as any,
    updatedAt: timestampToDate(firestoreData.updatedAt) as any,
  } as Donation;
};

/**
 * Transform application donation data to Firestore format
 * @param donationData - Donation data from application
 * @returns Data ready for Firestore
 */
export const transformDonationToFirestore = (donationData: Partial<Donation>): any => {
  const result: any = { ...donationData };

  if (result.donationDate instanceof Date) {
    result.donationDate = dateToTimestamp(result.donationDate);
  }
  if (result.createdAt instanceof Date) {
    result.createdAt = dateToTimestamp(result.createdAt);
  }
  if (result.updatedAt instanceof Date) {
    result.updatedAt = dateToTimestamp(result.updatedAt);
  }

  return removeUndefinedFields(result);
};

// ============================================================================
// BLOOD REQUEST DATA TRANSFORMATION
// ============================================================================

/**
 * Transform Firestore blood request data to application format
 * @param firestoreData - Raw data from Firestore
 * @returns Transformed blood request data
 */
export const transformBloodRequestFromFirestore = (firestoreData: any): BloodRequest => {
  return {
    ...firestoreData,
    requestedAt: timestampToDate(firestoreData.requestedAt) as any,
    neededBy: timestampToDate(firestoreData.neededBy) as any,
    expiresAt: timestampToDate(firestoreData.expiresAt) as any,
    fulfilledAt: timestampToDate(firestoreData.fulfilledAt),
    createdAt: timestampToDate(firestoreData.createdAt) as any,
    updatedAt: timestampToDate(firestoreData.updatedAt) as any,
  } as BloodRequest;
};

/**
 * Transform application blood request data to Firestore format
 * @param requestData - Blood request data from application
 * @returns Data ready for Firestore
 */
export const transformBloodRequestToFirestore = (
  requestData: Partial<BloodRequest>
): any => {
  const result: any = { ...requestData };

  if (result.requestedAt instanceof Date) {
    result.requestedAt = dateToTimestamp(result.requestedAt);
  }
  if (result.neededBy instanceof Date) {
    result.neededBy = dateToTimestamp(result.neededBy);
  }
  if (result.expiresAt instanceof Date) {
    result.expiresAt = dateToTimestamp(result.expiresAt);
  }
  if (result.fulfilledAt instanceof Date) {
    result.fulfilledAt = dateToTimestamp(result.fulfilledAt);
  }
  if (result.createdAt instanceof Date) {
    result.createdAt = dateToTimestamp(result.createdAt);
  }
  if (result.updatedAt instanceof Date) {
    result.updatedAt = dateToTimestamp(result.updatedAt);
  }

  return removeUndefinedFields(result);
};

// ============================================================================
// CAMPAIGN DATA TRANSFORMATION
// ============================================================================

/**
 * Transform Firestore campaign data to application format
 * @param firestoreData - Raw data from Firestore
 * @returns Transformed campaign data
 */
export const transformCampaignFromFirestore = (firestoreData: any): Campaign => {
  return {
    ...firestoreData,
    startDate: timestampToDate(firestoreData.startDate) as any,
    endDate: timestampToDate(firestoreData.endDate) as any,
    createdAt: timestampToDate(firestoreData.createdAt) as any,
    updatedAt: timestampToDate(firestoreData.updatedAt) as any,
  } as Campaign;
};

/**
 * Transform application campaign data to Firestore format
 * @param campaignData - Campaign data from application
 * @returns Data ready for Firestore
 */
export const transformCampaignToFirestore = (campaignData: Partial<Campaign>): any => {
  const result: any = { ...campaignData };

  if (result.startDate instanceof Date) {
    result.startDate = dateToTimestamp(result.startDate);
  }
  if (result.endDate instanceof Date) {
    result.endDate = dateToTimestamp(result.endDate);
  }
  if (result.createdAt instanceof Date) {
    result.createdAt = dateToTimestamp(result.createdAt);
  }
  if (result.updatedAt instanceof Date) {
    result.updatedAt = dateToTimestamp(result.updatedAt);
  }

  return removeUndefinedFields(result);
};

// ============================================================================
// APPOINTMENT DATA TRANSFORMATION
// ============================================================================

/**
 * Transform Firestore appointment data to application format
 * @param firestoreData - Raw data from Firestore
 * @returns Transformed appointment data
 */
export const transformAppointmentFromFirestore = (firestoreData: any): Appointment => {
  return {
    ...firestoreData,
    scheduledDate: timestampToDate(firestoreData.scheduledDate) as any,
    reminderSentAt: timestampToDate(firestoreData.reminderSentAt),
    completedAt: timestampToDate(firestoreData.completedAt),
    createdAt: timestampToDate(firestoreData.createdAt) as any,
    updatedAt: timestampToDate(firestoreData.updatedAt) as any,
  } as Appointment;
};

/**
 * Transform application appointment data to Firestore format
 * @param appointmentData - Appointment data from application
 * @returns Data ready for Firestore
 */
export const transformAppointmentToFirestore = (
  appointmentData: Partial<Appointment>
): any => {
  const result: any = { ...appointmentData };

  if (result.scheduledDate instanceof Date) {
    result.scheduledDate = dateToTimestamp(result.scheduledDate);
  }
  if (result.reminderSentAt instanceof Date) {
    result.reminderSentAt = dateToTimestamp(result.reminderSentAt);
  }
  if (result.completedAt instanceof Date) {
    result.completedAt = dateToTimestamp(result.completedAt);
  }
  if (result.createdAt instanceof Date) {
    result.createdAt = dateToTimestamp(result.createdAt);
  }
  if (result.updatedAt instanceof Date) {
    result.updatedAt = dateToTimestamp(result.updatedAt);
  }

  return removeUndefinedFields(result);
};

// ============================================================================
// NOTIFICATION DATA TRANSFORMATION
// ============================================================================

/**
 * Transform Firestore notification data to application format
 * @param firestoreData - Raw data from Firestore
 * @returns Transformed notification data
 */
export const transformNotificationFromFirestore = (firestoreData: any): Notification => {
  return {
    ...firestoreData,
    createdAt: timestampToDate(firestoreData.createdAt) as any,
    readAt: timestampToDate(firestoreData.readAt),
    expiresAt: timestampToDate(firestoreData.expiresAt),
  } as Notification;
};

/**
 * Transform application notification data to Firestore format
 * @param notificationData - Notification data from application
 * @returns Data ready for Firestore
 */
export const transformNotificationToFirestore = (
  notificationData: Partial<Notification>
): any => {
  const result: any = { ...notificationData };

  if (result.createdAt instanceof Date) {
    result.createdAt = dateToTimestamp(result.createdAt);
  }
  if (result.readAt instanceof Date) {
    result.readAt = dateToTimestamp(result.readAt);
  }
  if (result.expiresAt instanceof Date) {
    result.expiresAt = dateToTimestamp(result.expiresAt);
  }

  return removeUndefinedFields(result);
};

// ============================================================================
// GENERIC HELPERS
// ============================================================================

/**
 * Remove undefined fields from an object
 * @param obj - Object to clean
 * @returns Object without undefined fields
 */
export const removeUndefinedFields = <T extends Record<string, any>>(obj: T): Partial<T> => {
  const result: any = {};

  Object.keys(obj).forEach(key => {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  });

  return result;
};

/**
 * Remove null fields from an object
 * @param obj - Object to clean
 * @returns Object without null fields
 */
export const removeNullFields = <T extends Record<string, any>>(obj: T): Partial<T> => {
  const result: any = {};

  Object.keys(obj).forEach(key => {
    if (obj[key] !== null) {
      result[key] = obj[key];
    }
  });

  return result;
};

/**
 * Deep clone an object
 * @param obj - Object to clone
 * @returns Cloned object
 */
export const deepClone = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * Merge two objects, with second object taking precedence
 * @param obj1 - First object
 * @param obj2 - Second object
 * @returns Merged object
 */
export const mergeObjects = <T extends Record<string, any>>(
  obj1: T,
  obj2: Partial<T>
): T => {
  return { ...obj1, ...obj2 };
};

// ============================================================================
// ARRAY MANIPULATION
// ============================================================================

/**
 * Remove duplicates from array
 * @param array - Array with potential duplicates
 * @returns Array without duplicates
 */
export const removeDuplicates = <T>(array: T[]): T[] => {
  return Array.from(new Set(array));
};

/**
 * Group array by key
 * @param array - Array to group
 * @param key - Key to group by
 * @returns Object with grouped arrays
 */
export const groupBy = <T extends Record<string, any>>(
  array: T[],
  key: keyof T
): Record<string, T[]> => {
  return array.reduce((result, item) => {
    const groupKey = String(item[key]);
    if (!result[groupKey]) {
      result[groupKey] = [];
    }
    result[groupKey].push(item);
    return result;
  }, {} as Record<string, T[]>);
};

/**
 * Sort array by key
 * @param array - Array to sort
 * @param key - Key to sort by
 * @param order - Sort order (asc or desc)
 * @returns Sorted array
 */
export const sortBy = <T extends Record<string, any>>(
  array: T[],
  key: keyof T,
  order: 'asc' | 'desc' = 'asc'
): T[] => {
  return [...array].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];

    if (aVal < bVal) return order === 'asc' ? -1 : 1;
    if (aVal > bVal) return order === 'asc' ? 1 : -1;
    return 0;
  });
};

/**
 * Chunk array into smaller arrays
 * @param array - Array to chunk
 * @param size - Size of each chunk
 * @returns Array of chunks
 */
export const chunkArray = <T>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

/**
 * Flatten nested array
 * @param array - Nested array
 * @returns Flattened array
 */
export const flattenArray = <T>(array: (T | T[])[]): T[] => {
  return array.reduce((acc: T[], val) => {
    return Array.isArray(val) ? acc.concat(flattenArray(val)) : acc.concat(val);
  }, []);
};

// ============================================================================
// NULL/UNDEFINED HANDLING
// ============================================================================

/**
 * Get value or default if null/undefined
 * @param value - Value to check
 * @param defaultValue - Default value to return
 * @returns Value or default
 */
export const getOrDefault = <T>(value: T | null | undefined, defaultValue: T): T => {
  return value !== null && value !== undefined ? value : defaultValue;
};

/**
 * Check if value is empty (null, undefined, empty string, empty array, empty object)
 * @param value - Value to check
 * @returns Boolean indicating if value is empty
 */
export const isEmpty = (value: any): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
};

/**
 * Check if value is not empty
 * @param value - Value to check
 * @returns Boolean indicating if value is not empty
 */
export const isNotEmpty = (value: any): boolean => {
  return !isEmpty(value);
};

// ============================================================================
// STRING MANIPULATION
// ============================================================================

/**
 * Capitalize first letter of string
 * @param str - String to capitalize
 * @returns Capitalized string
 */
export const capitalizeFirst = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

/**
 * Convert string to title case
 * @param str - String to convert
 * @returns Title case string
 */
export const toTitleCase = (str: string): string => {
  return str
    .split(' ')
    .map(word => capitalizeFirst(word))
    .join(' ');
};

/**
 * Truncate string with ellipsis
 * @param str - String to truncate
 * @param maxLength - Maximum length
 * @returns Truncated string
 */
export const truncate = (str: string, maxLength: number): string => {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
};

/**
 * Generate slug from string
 * @param str - String to convert to slug
 * @returns Slug string
 */
export const slugify = (str: string): string => {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

// ============================================================================
// NUMBER FORMATTING
// ============================================================================

/**
 * Format number with comma separators
 * @param num - Number to format
 * @returns Formatted number string
 */
export const formatNumber = (num: number): string => {
  return num.toLocaleString('en-IN');
};

/**
 * Format as Indian currency
 * @param amount - Amount to format
 * @returns Formatted currency string
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  }).format(amount);
};

/**
 * Calculate percentage
 * @param value - Current value
 * @param total - Total value
 * @returns Percentage
 */
export const calculatePercentage = (value: number, total: number): number => {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
};

// ============================================================================
// DATE FORMATTING
// ============================================================================

/**
 * Format date to readable string
 * @param date - Date to format
 * @returns Formatted date string
 */
export const formatDate = (date: Date | Timestamp | string): string => {
  const d = typeof date === 'string' ? new Date(date) : timestampToDate(date as any) || new Date();

  return d.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

/**
 * Format date and time to readable string
 * @param date - Date to format
 * @returns Formatted date and time string
 */
export const formatDateTime = (date: Date | Timestamp | string): string => {
  const d = typeof date === 'string' ? new Date(date) : timestampToDate(date as any) || new Date();

  return d.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Format time only (HH:MM AM/PM)
 * @param date - Date object or Timestamp
 * @returns Formatted time string
 */
export const formatTime = (date: Date | Timestamp | string): string => {
  const d = typeof date === 'string' ? new Date(date) : timestampToDate(date as any) || new Date();

  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

/**
 * Get relative time string (e.g., "2 hours ago")
 * @param date - Date to compare
 * @returns Relative time string
 */
export const getRelativeTime = (date: Date | Timestamp | string): string => {
  const d = typeof date === 'string' ? new Date(date) : timestampToDate(date as any) || new Date();
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

  return formatDate(d);
};

/**
 * Alias for getRelativeTime for consistency
 */
export const formatRelativeTime = getRelativeTime;
