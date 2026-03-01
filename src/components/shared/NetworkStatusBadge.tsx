import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useNetworkStatus } from '../../contexts/NetworkStatusContext';

const APP_PREFIXES = ['/donor', '/ngo', '/bloodbank', '/admin'];

export const NetworkStatusBadge = () => {
  const location = useLocation();
  const {
    syncStatus,
    persistenceStatus,
    isLowBandwidth,
    dataSaverMode,
    setDataSaverMode,
  } = useNetworkStatus();

  const isAppRoute = APP_PREFIXES.some((prefix) => location.pathname.startsWith(prefix));
  if (!isAppRoute) return null;

  if (syncStatus === 'synced' && persistenceStatus === 'enabled' && !isLowBandwidth) return null;

  const cycleMode = () => {
    if (dataSaverMode === 'auto') setDataSaverMode('on');
    else if (dataSaverMode === 'on') setDataSaverMode('off');
    else setDataSaverMode('auto');
  };

  const dataSaverText = dataSaverMode === 'auto'
    ? (isLowBandwidth ? 'Data Saver: Auto(ON)' : 'Data Saver: Auto')
    : `Data Saver: ${dataSaverMode === 'on' ? 'ON' : 'OFF'}`;

  if (syncStatus === 'offline') {
    return (
      <button
        type="button"
        onClick={cycleMode}
        className="fixed right-4 top-16 z-40 inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 shadow-sm"
        title={dataSaverText}
      >
        <WifiOff className="h-3.5 w-3.5" />
        Offline • {dataSaverText}
      </button>
    );
  }

  if (syncStatus === 'syncing') {
    return (
      <button
        type="button"
        onClick={cycleMode}
        className="fixed right-4 top-16 z-40 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 shadow-sm"
        title={dataSaverText}
      >
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        Syncing • {dataSaverText}
      </button>
    );
  }

  if (persistenceStatus !== 'enabled') {
    return (
      <button
        type="button"
        onClick={cycleMode}
        className="fixed right-4 top-16 z-40 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-700 shadow-sm"
        title={dataSaverText}
      >
        <Wifi className="h-3.5 w-3.5" />
        Online (No offline cache) • {dataSaverText}
      </button>
    );
  }

  if (isLowBandwidth) {
    return (
      <button
        type="button"
        onClick={cycleMode}
        className="fixed right-4 top-16 z-40 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 shadow-sm"
        title={dataSaverText}
      >
        <Wifi className="h-3.5 w-3.5" />
        {dataSaverText}
      </button>
    );
  }

  return null;
};

export default NetworkStatusBadge;
