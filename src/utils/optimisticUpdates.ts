/**
 * Optimistic Update Utilities
 *
 * Utilities for implementing optimistic UI updates to improve perceived performance
 */

import { useState, useCallback } from 'react';

/**
 * Generic optimistic update hook
 * Updates UI immediately, then syncs with server
 */
export function useOptimisticUpdate<T>(
  initialData: T[],
  updateFn: (data: T[], optimisticItem: T) => T[],
  rollbackFn?: (data: T[], failedItem: T) => T[]
) {
  const [data, setData] = useState<T[]>(initialData);
  const [isPending, setIsPending] = useState(false);

  const performOptimisticUpdate = useCallback(
    async (
      optimisticItem: T,
      serverUpdate: () => Promise<void>
    ): Promise<{ success: boolean; error?: string }> => {
      // Immediately update UI
      setData(currentData => updateFn(currentData, optimisticItem));
      setIsPending(true);

      try {
        // Perform server update
        await serverUpdate();
        setIsPending(false);
        return { success: true };
      } catch (error) {
        // Rollback on error
        if (rollbackFn) {
          setData(currentData => rollbackFn(currentData, optimisticItem));
        } else {
          // Default rollback: remove the optimistic item
          setData(currentData =>
            updateFn === addItem
              ? currentData.filter(item => item !== optimisticItem)
              : currentData
          );
        }
        setIsPending(false);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Update failed',
        };
      }
    },
    [updateFn, rollbackFn]
  );

  return {
    data,
    setData,
    isPending,
    performOptimisticUpdate,
  };
}

/**
 * Helper functions for common update patterns
 */

// Add item to array
export const addItem = <T>(data: T[], newItem: T): T[] => {
  return [newItem, ...data];
};

// Update item in array
export const updateItem = <T extends { id?: string }>(
  data: T[],
  updatedItem: T
): T[] => {
  return data.map(item => (item.id === updatedItem.id ? updatedItem : item));
};

// Remove item from array
export const removeItem = <T extends { id?: string }>(
  data: T[],
  itemToRemove: T
): T[] => {
  return data.filter(item => item.id !== itemToRemove.id);
};

/**
 * Optimistic notification marking
 */
export function useOptimisticNotificationRead() {
  return useCallback((notificationId: string, notifications: any[]) => {
    return notifications.map(n =>
      n.id === notificationId ? { ...n, read: true, readAt: new Date() } : n
    );
  }, []);
}

/**
 * Optimistic appointment status update
 */
export function useOptimisticAppointmentStatus() {
  return useCallback(
    (
      appointmentId: string,
      newStatus: string,
      appointments: any[]
    ) => {
      return appointments.map(a =>
        a.id === appointmentId ? { ...a, status: newStatus } : a
      );
    },
    []
  );
}

/**
 * Optimistic inventory update
 */
export function useOptimisticInventoryUpdate() {
  return useCallback(
    (inventoryId: string, newUnits: number, inventory: any[]) => {
      return inventory.map(item => {
        if (item.id === inventoryId) {
          // Calculate new status based on units
          let status = 'adequate';
          if (newUnits === 0) {
            status = 'critical';
          } else if (newUnits <= item.criticalLevel) {
            status = 'critical';
          } else if (newUnits <= item.lowLevel) {
            status = 'low';
          } else if (newUnits > item.lowLevel * 3) {
            status = 'surplus';
          }

          return { ...item, units: newUnits, status };
        }
        return item;
      });
    },
    []
  );
}

/**
 * Optimistic campaign registration
 */
export function useOptimisticCampaignRegistration() {
  return useCallback(
    (campaignId: string, donorId: string, campaigns: any[]) => {
      return campaigns.map(c =>
        c.id === campaignId
          ? {
              ...c,
              registeredDonors: [...(c.registeredDonors || []), donorId],
            }
          : c
      );
    },
    []
  );
}

/**
 * Optimistic blood request response
 */
export function useOptimisticBloodRequestResponse() {
  return useCallback(
    (requestId: string, donorId: string, requests: any[]) => {
      return requests.map(r =>
        r.id === requestId
          ? {
              ...r,
              respondedDonors: [...(r.respondedDonors || []), donorId],
            }
          : r
      );
    },
    []
  );
}

/**
 * Debounce utility for optimistic updates
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle utility for frequent updates
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Cache with TTL for optimistic reads
 */
export class OptimisticCache<T> {
  private cache: Map<string, { data: T; timestamp: number }> = new Map();
  private ttl: number;

  constructor(ttlMs: number = 5000) {
    this.ttl = ttlMs;
  }

  set(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  get(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const isExpired = Date.now() - cached.timestamp > this.ttl;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  clear(): void {
    this.cache.clear();
  }

  delete(key: string): void {
    this.cache.delete(key);
  }
}

/**
 * Request deduplication for optimistic updates
 */
export class RequestDeduplicator {
  private pendingRequests: Map<string, Promise<any>> = new Map();

  async deduplicate<T>(
    key: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    // If request is already pending, return the existing promise
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key)!;
    }

    // Create new request
    const promise = requestFn().finally(() => {
      this.pendingRequests.delete(key);
    });

    this.pendingRequests.set(key, promise);
    return promise;
  }

  clear(): void {
    this.pendingRequests.clear();
  }
}

/**
 * Retry utility for failed optimistic updates
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: any;

  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (i < maxRetries) {
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, i)));
      }
    }
  }

  throw lastError;
}
