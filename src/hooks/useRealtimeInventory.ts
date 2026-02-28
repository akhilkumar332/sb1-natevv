/**
 * useRealtimeInventory Hook
 *
 * Real-time blood inventory monitoring using Firebase onSnapshot
 */

import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import { BloodInventory } from '../types/database.types';
import { extractQueryData } from '../utils/firestore.utils';
import { failRealtimeLoad, reportRealtimeError } from '../utils/realtimeError';
import { useSyncedRef } from './useSyncedRef';

interface UseRealtimeInventoryOptions {
  hospitalId: string;
  onLowStock?: (inventory: BloodInventory) => void;
  onCriticalStock?: (inventory: BloodInventory) => void;
}

interface UseRealtimeInventoryResult {
  inventory: BloodInventory[];
  loading: boolean;
  error: string | null;
  lowStockItems: BloodInventory[];
  criticalStockItems: BloodInventory[];
  totalUnits: number;
}

/**
 * Hook for real-time blood inventory monitoring
 * Automatically updates when inventory changes
 */
export const useRealtimeInventory = ({
  hospitalId,
  onLowStock,
  onCriticalStock,
}: UseRealtimeInventoryOptions): UseRealtimeInventoryResult => {
  const [inventory, setInventory] = useState<BloodInventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lowStockItems, setLowStockItems] = useState<BloodInventory[]>([]);
  const [criticalStockItems, setCriticalStockItems] = useState<BloodInventory[]>([]);
  const [totalUnits, setTotalUnits] = useState(0);
  const inventoryRef = useSyncedRef(inventory);
  const lowStockItemsRef = useSyncedRef(lowStockItems);
  const criticalStockItemsRef = useSyncedRef(criticalStockItems);
  const onLowStockRef = useSyncedRef(onLowStock);
  const onCriticalStockRef = useSyncedRef(onCriticalStock);

  useEffect(() => {
    if (!hospitalId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const q = query(
      collection(db, 'bloodInventory'),
      where('hospitalId', '==', hospitalId)
    );

    // Set up real-time listener
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          const inventoryData = extractQueryData<BloodInventory>(snapshot, [
            'lastRestocked',
            'updatedAt',
          ]);

          // Separate by status
          const lowStock = inventoryData.filter(item => item.status === 'low');
          const criticalStock = inventoryData.filter(item => item.status === 'critical');

          // Detect new low/critical stock items
          const previousInventory = inventoryRef.current;
          const previousLowStock = lowStockItemsRef.current;
          const previousCriticalStock = criticalStockItemsRef.current;
          if (previousInventory.length > 0) {
            // Check for newly critical items
            criticalStock.forEach(item => {
              const wasCritical = previousCriticalStock.find(i => i.id === item.id);
              if (!wasCritical && onCriticalStockRef.current) {
                onCriticalStockRef.current(item);
              }
            });

            // Check for newly low stock items
            lowStock.forEach(item => {
              const wasLow = previousLowStock.find(i => i.id === item.id);
              const wasCritical = previousCriticalStock.find(i => i.id === item.id);
              if (!wasLow && !wasCritical && onLowStockRef.current) {
                onLowStockRef.current(item);
              }
            });
          }

          setInventory(inventoryData);
          setLowStockItems(lowStock);
          setCriticalStockItems(criticalStock);
          setTotalUnits(inventoryData.reduce((sum, item) => sum + item.units, 0));
          setLoading(false);
        } catch (err) {
          failRealtimeLoad(
            { scope: 'bloodbank', hook: 'useRealtimeInventory' },
            {
              error: err,
              kind: 'inventory.process',
              fallbackMessage: 'Failed to load inventory',
              setError,
              setLoading,
            }
          );
        }
      },
      (err) => {
        failRealtimeLoad(
          { scope: 'bloodbank', hook: 'useRealtimeInventory' },
          {
            error: err,
            kind: 'inventory.listen',
            fallbackMessage: 'Failed to listen to inventory',
            setError,
            setLoading,
          }
        );
      }
    );

    return () => unsubscribe();
  }, [hospitalId]);

  return {
    inventory,
    loading,
    error,
    lowStockItems,
    criticalStockItems,
    totalUnits,
  };
};

/**
 * Hook for monitoring specific blood type inventory
 */
export const useRealtimeBloodTypeInventory = (
  hospitalId: string,
  bloodType: string
): BloodInventory | null => {
  const [inventoryItem, setInventoryItem] = useState<BloodInventory | null>(null);

  useEffect(() => {
    if (!hospitalId || !bloodType) return;

    const q = query(
      collection(db, 'bloodInventory'),
      where('hospitalId', '==', hospitalId),
      where('bloodType', '==', bloodType)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = extractQueryData<BloodInventory>(snapshot, [
          'lastRestocked',
          'updatedAt',
        ]);
        setInventoryItem(items.length > 0 ? items[0] : null);
      },
      (err) => {
        reportRealtimeError(
          { scope: 'bloodbank', hook: 'useRealtimeBloodTypeInventory' },
          err,
          'inventory.blood_type.listen',
          {
            hospitalId,
            bloodType,
          }
        );
      }
    );

    return () => unsubscribe();
  }, [hospitalId, bloodType]);

  return inventoryItem;
};

/**
 * Hook for monitoring all low/critical inventory across platform (admin)
 */
export const useRealtimeLowInventoryAlerts = (): {
  alerts: BloodInventory[];
  loading: boolean;
} => {
  const [alerts, setAlerts] = useState<BloodInventory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'bloodInventory'),
      where('status', 'in', ['low', 'critical'])
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const alertData = extractQueryData<BloodInventory>(snapshot, [
          'lastRestocked',
          'updatedAt',
        ]);
        setAlerts(alertData);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        reportRealtimeError(
          { scope: 'admin', hook: 'useRealtimeLowInventoryAlerts' },
          err,
          'inventory.low_alerts.listen'
        );
      }
    );

    return () => unsubscribe();
  }, []);

  return { alerts, loading };
};

/**
 * Hook for inventory statistics
 */
export const useRealtimeInventoryStats = (
  hospitalId: string
): {
  totalUnits: number;
  adequateCount: number;
  lowCount: number;
  criticalCount: number;
  surplusCount: number;
} => {
  const [stats, setStats] = useState({
    totalUnits: 0,
    adequateCount: 0,
    lowCount: 0,
    criticalCount: 0,
    surplusCount: 0,
  });

  useEffect(() => {
    if (!hospitalId) return;

    const q = query(
      collection(db, 'bloodInventory'),
      where('hospitalId', '==', hospitalId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const inventory = extractQueryData<BloodInventory>(snapshot, [
          'lastRestocked',
          'updatedAt',
        ]);

        setStats({
          totalUnits: inventory.reduce((sum, item) => sum + item.units, 0),
          adequateCount: inventory.filter(item => item.status === 'adequate').length,
          lowCount: inventory.filter(item => item.status === 'low').length,
          criticalCount: inventory.filter(item => item.status === 'critical').length,
          surplusCount: inventory.filter(item => item.status === 'surplus').length,
        });
      },
      (err) => {
        reportRealtimeError(
          { scope: 'bloodbank', hook: 'useRealtimeInventoryStats' },
          err,
          'inventory.stats.listen',
          { hospitalId }
        );
      }
    );

    return () => unsubscribe();
  }, [hospitalId]);

  return stats;
};
