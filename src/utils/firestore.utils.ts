/**
 * Firestore Utility Functions
 *
 * This file provides helper functions for working with Firestore,
 * including type-safe converters, timestamp handling, and batch operations.
 */

import {
  Timestamp,
  FirestoreDataConverter,
  DocumentData,
  QueryDocumentSnapshot,
  SnapshotOptions,
  WriteBatch,
  Transaction,
  DocumentReference,
  collection,
  doc,
  writeBatch,
  runTransaction,
  serverTimestamp,
  FieldValue,
} from 'firebase/firestore';
import { db } from '../firebase';

// ============================================================================
// TIMESTAMP CONVERSION UTILITIES
// ============================================================================

/**
 * Converts a Firestore Timestamp to a JavaScript Date
 * @param timestamp - Firestore Timestamp object or null/undefined
 * @returns JavaScript Date object or undefined
 */
export const timestampToDate = (timestamp: Timestamp | null | undefined): Date | undefined => {
  if (!timestamp) return undefined;
  // Check if it's a Timestamp by checking for toDate method
  if (typeof timestamp === 'object' && 'toDate' in timestamp && typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }
  // Handle case where timestamp is already a Date
  if (timestamp instanceof Date) {
    return timestamp;
  }
  // Handle case where timestamp has seconds property (Firestore format)
  if (typeof timestamp === 'object' && 'seconds' in timestamp) {
    return new Date((timestamp as any).seconds * 1000);
  }
  return undefined;
};

/**
 * Converts a JavaScript Date to a Firestore Timestamp
 * @param date - JavaScript Date object, number (milliseconds), or string
 * @returns Firestore Timestamp object or undefined
 */
export const dateToTimestamp = (date: Date | number | string | null | undefined): Timestamp | undefined => {
  if (!date) return undefined;

  // Check if it's already a Timestamp
  if (typeof date === 'object' && 'toDate' in date && typeof date.toDate === 'function') {
    return date as unknown as Timestamp;
  }

  if (date instanceof Date) {
    return Timestamp.fromDate(date);
  }

  if (typeof date === 'number') {
    return Timestamp.fromMillis(date);
  }

  if (typeof date === 'string') {
    return Timestamp.fromDate(new Date(date));
  }

  return undefined;
};

/**
 * Gets the current server timestamp for Firestore
 * @returns FieldValue for server timestamp
 */
export const getServerTimestamp = (): FieldValue => {
  return serverTimestamp();
};

/**
 * Converts multiple timestamp fields in an object to Dates
 * @param data - Object containing timestamp fields
 * @param fields - Array of field names that contain timestamps
 * @returns Object with timestamps converted to Dates
 */
export const convertTimestamps = <T extends Record<string, any>>(
  data: T,
  fields: (keyof T)[]
): T => {
  const result = { ...data };
  fields.forEach(field => {
    if (result[field]) {
      result[field] = timestampToDate(result[field] as any) as any;
    }
  });
  return result;
};

// ============================================================================
// FIRESTORE DATA CONVERTERS
// ============================================================================

/**
 * Creates a generic Firestore data converter for type safety
 * @param timestampFields - Array of field names that should be converted between Timestamp and Date
 * @returns FirestoreDataConverter for the specified type
 */
export function createConverter<T extends { id?: string }>(
  timestampFields: (keyof T)[] = []
): FirestoreDataConverter<T> {
  return {
    toFirestore(data: T): DocumentData {
      const { id, ...dataWithoutId } = data;
      const result: any = { ...dataWithoutId };

      // Convert Date fields to Timestamps
      timestampFields.forEach(field => {
        if (result[field] instanceof Date) {
          result[field] = dateToTimestamp(result[field]);
        }
      });

      return result;
    },

    fromFirestore(
      snapshot: QueryDocumentSnapshot,
      options: SnapshotOptions
    ): T {
      const data = snapshot.data(options);
      const result: any = { ...data, id: snapshot.id };

      // Convert Timestamp fields to Dates
      timestampFields.forEach(field => {
        const fieldName = field as string;
        if (data[fieldName]) {
          result[field] = timestampToDate(data[fieldName]);
        }
      });

      return result as T;
    },
  };
}

/**
 * Converts Firestore document data to application format
 * Handles timestamp conversion and adds document ID
 * @param docSnapshot - Firestore document snapshot
 * @param timestampFields - Array of field names containing timestamps
 * @returns Converted document data with ID
 */
export const convertDocumentData = <T extends { id?: string }>(
  docSnapshot: QueryDocumentSnapshot | any,
  timestampFields: (keyof T)[] = []
): T | null => {
  if (!docSnapshot.exists()) {
    return null;
  }

  const data = docSnapshot.data();
  const result: any = { ...data, id: docSnapshot.id };

  // Convert timestamps
  timestampFields.forEach(field => {
    if (data[field as string]) {
      result[field] = timestampToDate(data[field as string]);
    }
  });

  return result as T;
};

// ============================================================================
// DOCUMENT REFERENCE UTILITIES
// ============================================================================

/**
 * Creates a typed document reference
 * @param collectionName - Name of the Firestore collection
 * @param docId - Document ID
 * @returns Typed DocumentReference
 */
export const createDocRef = <T>(
  collectionName: string,
  docId: string
): DocumentReference<T> => {
  return doc(db, collectionName, docId) as DocumentReference<T>;
};

/**
 * Gets a typed collection reference
 * @param collectionName - Name of the Firestore collection
 * @returns Typed CollectionReference
 */
export const getCollectionRef = (collectionName: string) => {
  return collection(db, collectionName);
};

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

/**
 * Batch write helper for multiple document operations
 * @param operations - Array of batch operations to perform
 * @returns Promise that resolves when batch is committed
 *
 * @example
 * await batchWrite([
 *   { type: 'set', ref: docRef1, data: { name: 'John' } },
 *   { type: 'update', ref: docRef2, data: { status: 'active' } },
 *   { type: 'delete', ref: docRef3 }
 * ]);
 */
export const batchWrite = async (
  operations: Array<
    | { type: 'set'; ref: DocumentReference; data: any; merge?: boolean }
    | { type: 'update'; ref: DocumentReference; data: any }
    | { type: 'delete'; ref: DocumentReference }
  >
): Promise<void> => {
  const batch: WriteBatch = writeBatch(db);

  operations.forEach(operation => {
    switch (operation.type) {
      case 'set':
        if (operation.merge) {
          batch.set(operation.ref, operation.data, { merge: true });
        } else {
          batch.set(operation.ref, operation.data);
        }
        break;
      case 'update':
        batch.update(operation.ref, operation.data);
        break;
      case 'delete':
        batch.delete(operation.ref);
        break;
    }
  });

  await batch.commit();
};

/**
 * Creates a new batch instance
 * @returns WriteBatch instance
 */
export const createBatch = (): WriteBatch => {
  return writeBatch(db);
};

// ============================================================================
// TRANSACTION HELPER
// ============================================================================

/**
 * Transaction helper for atomic operations
 * @param updateFunction - Function that performs operations within the transaction
 * @returns Promise that resolves with the transaction result
 *
 * @example
 * await runTransactionHelper(async (transaction) => {
 *   const doc = await transaction.get(docRef);
 *   const newValue = doc.data().value + 1;
 *   transaction.update(docRef, { value: newValue });
 *   return newValue;
 * });
 */
export const runTransactionHelper = async <T>(
  updateFunction: (transaction: Transaction) => Promise<T>
): Promise<T> => {
  return runTransaction(db, updateFunction);
};

// ============================================================================
// DATA VALIDATION HELPERS
// ============================================================================

/**
 * Removes undefined values from an object (Firestore doesn't allow undefined)
 * @param obj - Object to clean
 * @returns Object with undefined values removed
 */
export const removeUndefined = <T extends Record<string, any>>(obj: T): Partial<T> => {
  const result: any = {};
  Object.keys(obj).forEach(key => {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  });
  return result;
};

/**
 * Prepares data for Firestore by removing undefined values and converting dates
 * @param data - Data to prepare
 * @param dateFields - Fields that should be converted to Timestamps
 * @returns Cleaned data ready for Firestore
 */
export const prepareForFirestore = <T extends Record<string, any>>(
  data: T,
  dateFields: (keyof T)[] = []
): Partial<T> => {
  const cleaned = removeUndefined(data);

  // Convert Date fields to Timestamps
  dateFields.forEach(field => {
    const value: any = cleaned[field as string];
    if (value && value instanceof Date) {
      (cleaned as any)[field] = dateToTimestamp(value);
    }
  });

  return cleaned;
};

// ============================================================================
// QUERY HELPERS
// ============================================================================

/**
 * Helper to safely extract data from query snapshots
 * @param querySnapshot - Firestore query snapshot
 * @param timestampFields - Fields to convert from Timestamp to Date
 * @returns Array of documents with converted data
 */
export const extractQueryData = <T extends { id?: string }>(
  querySnapshot: any,
  timestampFields: (keyof T)[] = []
): T[] => {
  const results: T[] = [];

  querySnapshot.forEach((doc: any) => {
    const data = convertDocumentData<T>(doc, timestampFields);
    if (data) {
      results.push(data);
    }
  });

  return results;
};

/**
 * Checks if a document exists
 * @param docSnapshot - Document snapshot
 * @returns Boolean indicating if document exists
 */
export const documentExists = (docSnapshot: any): boolean => {
  return docSnapshot?.exists() ?? false;
};

// ============================================================================
// PAGINATION HELPERS
// ============================================================================

/**
 * Cursor for pagination
 */
export interface PaginationCursor {
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

/**
 * Creates pagination metadata from query results
 * @param querySnapshot - Query snapshot
 * @param limit - Number of documents per page
 * @returns Pagination cursor information
 */
export const createPaginationCursor = (
  querySnapshot: any,
  limit: number
): PaginationCursor => {
  const docs = querySnapshot.docs;
  return {
    lastDoc: docs.length > 0 ? docs[docs.length - 1] : null,
    hasMore: docs.length === limit,
  };
};

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Checks if an error is a Firestore permission denied error
 * @param error - Error object
 * @returns Boolean indicating if it's a permission error
 */
export const isPermissionError = (error: any): boolean => {
  return error?.code === 'permission-denied';
};

/**
 * Checks if an error is a Firestore not found error
 * @param error - Error object
 * @returns Boolean indicating if it's a not found error
 */
export const isNotFoundError = (error: any): boolean => {
  return error?.code === 'not-found';
};

/**
 * Gets a user-friendly error message from Firestore error
 * @param error - Error object
 * @returns User-friendly error message
 */
export const getFirestoreErrorMessage = (error: any): string => {
  if (isPermissionError(error)) {
    return 'You do not have permission to perform this action.';
  }
  if (isNotFoundError(error)) {
    return 'The requested resource was not found.';
  }
  if (error?.code === 'unavailable') {
    return 'Service temporarily unavailable. Please try again.';
  }
  if (error?.code === 'already-exists') {
    return 'This resource already exists.';
  }
  return error?.message || 'An unexpected error occurred.';
};

// ============================================================================
// SUBCOLLECTION HELPERS
// ============================================================================

/**
 * Gets a reference to a subcollection
 * @param parentPath - Path to parent document (e.g., 'users/userId')
 * @param subcollectionName - Name of subcollection
 * @returns Collection reference
 */
export const getSubcollectionRef = (parentPath: string, subcollectionName: string) => {
  return collection(db, parentPath, subcollectionName);
};

// ============================================================================
// ARRAY HELPERS
// ============================================================================

/**
 * Helper to add items to an array field atomically
 * @param items - Items to add
 * @returns FieldValue for array union
 */
export const arrayAdd = (...items: any[]) => {
  return { arrayUnion: items };
};

/**
 * Helper to remove items from an array field atomically
 * @param items - Items to remove
 * @returns FieldValue for array remove
 */
export const arrayRemove = (...items: any[]) => {
  return { arrayRemove: items };
};

// ============================================================================
// NUMERIC HELPERS
// ============================================================================

/**
 * Helper to increment a numeric field atomically
 * @param value - Amount to increment by (default: 1)
 * @returns FieldValue for increment
 */
export const incrementValue = (value: number = 1) => {
  return { increment: value };
};

/**
 * Helper to decrement a numeric field atomically
 * @param value - Amount to decrement by (default: 1)
 * @returns FieldValue for decrement
 */
export const decrementValue = (value: number = 1) => {
  return { increment: -value };
};
