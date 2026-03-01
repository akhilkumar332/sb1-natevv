import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  getFirestorePersistenceStatus,
  subscribeFirestorePersistenceStatus,
} from '../firebase';

type SyncStatus = 'synced' | 'syncing' | 'offline';
type PersistenceStatus = 'idle' | 'enabling' | 'enabled' | 'disabled' | 'failed';
type DataSaverMode = 'auto' | 'on' | 'off';

type NetworkStatusValue = {
  isOnline: boolean;
  syncStatus: SyncStatus;
  persistenceStatus: PersistenceStatus;
  dataSaverMode: DataSaverMode;
  isLowBandwidth: boolean;
  connectionType: string | null;
  saveData: boolean;
  setDataSaverMode: (mode: DataSaverMode) => void;
};

const DATA_SAVER_KEY = 'bh_data_saver_mode';

const getConnectionState = () => {
  if (typeof navigator === 'undefined') {
    return { connectionType: null, saveData: false };
  }
  const nav = navigator as Navigator & {
    connection?: { effectiveType?: string; saveData?: boolean };
  };
  const connection = nav.connection;
  return {
    connectionType: typeof connection?.effectiveType === 'string' ? connection.effectiveType : null,
    saveData: Boolean(connection?.saveData),
  };
};

const computeLowBandwidth = (mode: DataSaverMode, connectionType: string | null, saveData: boolean) => {
  if (mode === 'on') return true;
  if (mode === 'off') return false;
  if (saveData) return true;
  return connectionType === 'slow-2g' || connectionType === '2g';
};

const NetworkStatusContext = createContext<NetworkStatusValue>({
  isOnline: true,
  syncStatus: 'synced',
  persistenceStatus: 'idle',
  dataSaverMode: 'auto',
  isLowBandwidth: false,
  connectionType: null,
  saveData: false,
  setDataSaverMode: () => {},
});

export const NetworkStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine;
  });
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => (
    typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'synced'
  ));
  const [persistenceStatus, setPersistenceStatus] = useState<PersistenceStatus>(() => getFirestorePersistenceStatus());
  const [dataSaverMode, setDataSaverModeState] = useState<DataSaverMode>(() => {
    if (typeof window === 'undefined') return 'auto';
    const raw = window.localStorage.getItem(DATA_SAVER_KEY);
    if (raw === 'on' || raw === 'off' || raw === 'auto') return raw;
    return 'auto';
  });
  const [connectionInfo, setConnectionInfo] = useState(() => getConnectionState());

  const setDataSaverMode = (mode: DataSaverMode) => {
    setDataSaverModeState(mode);
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(DATA_SAVER_KEY, mode);
    } catch {
      // ignore storage errors
    }
  };

  useEffect(() => {
    const unsubscribePersistence = subscribeFirestorePersistenceStatus((status) => {
      setPersistenceStatus(status);
    });

    if (typeof window === 'undefined') {
      return unsubscribePersistence;
    }

    let syncTimer: number | null = null;
    const clearSyncTimer = () => {
      if (syncTimer !== null) {
        window.clearTimeout(syncTimer);
        syncTimer = null;
      }
    };

    const handleOnline = () => {
      setIsOnline(true);
      setSyncStatus('syncing');
      clearSyncTimer();
      syncTimer = window.setTimeout(() => {
        setSyncStatus('synced');
        syncTimer = null;
      }, 1800);
    };

    const handleOffline = () => {
      clearSyncTimer();
      setIsOnline(false);
      setSyncStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    const nav = navigator as Navigator & {
      connection?: { addEventListener?: (type: string, listener: () => void) => void; removeEventListener?: (type: string, listener: () => void) => void };
    };
    const connection = nav.connection;
    const handleConnectionChange = () => {
      setConnectionInfo(getConnectionState());
    };
    if (connection?.addEventListener) {
      connection.addEventListener('change', handleConnectionChange);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection?.removeEventListener) {
        connection.removeEventListener('change', handleConnectionChange);
      }
      clearSyncTimer();
      unsubscribePersistence();
    };
  }, []);

  const isLowBandwidth = computeLowBandwidth(
    dataSaverMode,
    connectionInfo.connectionType,
    connectionInfo.saveData,
  );

  const value = useMemo<NetworkStatusValue>(() => ({
    isOnline,
    syncStatus,
    persistenceStatus,
    dataSaverMode,
    isLowBandwidth,
    connectionType: connectionInfo.connectionType,
    saveData: connectionInfo.saveData,
    setDataSaverMode,
  }), [
    isOnline,
    syncStatus,
    persistenceStatus,
    dataSaverMode,
    isLowBandwidth,
    connectionInfo.connectionType,
    connectionInfo.saveData,
  ]);

  return (
    <NetworkStatusContext.Provider value={value}>
      {children}
    </NetworkStatusContext.Provider>
  );
};

export const useNetworkStatus = () => useContext(NetworkStatusContext);

export default NetworkStatusContext;
