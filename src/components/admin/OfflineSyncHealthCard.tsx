import { Activity, WifiOff } from 'lucide-react';
import { useNetworkStatus } from '../../contexts/NetworkStatusContext';
import { useOfflineMutationTelemetry } from '../../hooks/useOfflineMutationTelemetry';
import { useOfflineMutationDeadLetters } from '../../hooks/useOfflineMutationDeadLetters';
import { ROUTES } from '../../constants/routes';

type OfflineSyncHealthCardProps = {
  variant?: 'compact' | 'full';
};

function OfflineSyncHealthCard({ variant = 'compact' }: OfflineSyncHealthCardProps) {
  const { isOnline } = useNetworkStatus();
  const { telemetry } = useOfflineMutationTelemetry();
  const { entries: deadLetters } = useOfflineMutationDeadLetters();

  if (variant === 'full') {
    return null;
  }

  const successRate = telemetry.flushedProcessed > 0
    ? (telemetry.flushedSucceeded / telemetry.flushedProcessed) * 100
    : 0;

  return (
    <div className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">Offline Sync Health</h3>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${isOnline ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'}`}>
          {!isOnline && <WifiOff className="h-3.5 w-3.5" />}
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm text-gray-700 dark:text-slate-300">
        <p className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 dark:border-slate-700"><span>Queued</span><span className="font-semibold">{telemetry.pendingCount}</span></p>
        <p className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 dark:border-slate-700"><span>Failed items</span><span className="font-semibold text-rose-700 dark:text-rose-300">{deadLetters.length}</span></p>
        <p className="col-span-2 flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 dark:border-slate-700"><span>Sync success</span><span className="font-semibold text-emerald-700 dark:text-emerald-300">{successRate.toFixed(1)}%</span></p>
      </div>

      <a
        href={ROUTES.portal.admin.dashboard.offlineSyncHealth}
        className="mt-3 inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300"
      >
        Open Full Offline Sync Health
      </a>
    </div>
  );
}

export default OfflineSyncHealthCard;
