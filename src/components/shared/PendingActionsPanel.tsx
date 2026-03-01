import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, CloudOff, RefreshCw } from 'lucide-react';
import { usePendingOfflineMutations } from '../../hooks/usePendingOfflineMutations';
import { useNetworkStatus } from '../../contexts/NetworkStatusContext';

const mutationLabelMap: Record<string, string> = {
  'user.notificationPreferences': 'Notification preferences update',
};

const formatRelativeTime = (ts: number) => {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))}m ago`;
  if (diff < 86_400_000) return `${Math.max(1, Math.floor(diff / 3_600_000))}h ago`;
  return `${Math.max(1, Math.floor(diff / 86_400_000))}d ago`;
};

const formatCountdown = (targetTs: number) => {
  const diff = Math.max(0, targetTs - Date.now());
  if (diff < 60_000) return '<1m';
  if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))}m`;
  if (diff < 86_400_000) return `${Math.max(1, Math.floor(diff / 3_600_000))}h`;
  return `${Math.max(1, Math.floor(diff / 86_400_000))}d`;
};

export const PendingActionsPanel = () => {
  const { pendingCount, pendingItems, syncing, syncNow } = usePendingOfflineMutations();
  const { isOnline } = useNetworkStatus();
  const [expanded, setExpanded] = useState(false);

  const title = useMemo(() => {
    if (pendingCount === 1) return '1 action is queued for sync';
    return `${pendingCount} actions are queued for sync`;
  }, [pendingCount]);

  if (pendingCount <= 0) return null;

  return (
    <section className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
      <div className="flex items-center gap-3">
        <CloudOff className="h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs opacity-80">
            {isOnline ? 'You are online. Sync now or wait for auto-sync.' : 'You are offline. Actions will sync when reconnected.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-amber-300 bg-white text-amber-800 hover:bg-amber-100"
          aria-label={expanded ? 'Hide queued action details' : 'Show queued action details'}
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => void syncNow()}
          disabled={!isOnline || syncing}
          className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing' : 'Sync'}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2 border-t border-amber-200 pt-3">
          {pendingItems.map((item) => {
            const label = mutationLabelMap[item.type] || item.type;
            return (
              <div key={item.id} className="rounded-lg border border-amber-200 bg-white px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-amber-900">{label}</p>
                  <p className="text-[11px] text-amber-700">queued {formatRelativeTime(item.createdAt)}</p>
                </div>
                <p className="mt-1 text-[11px] text-amber-700">
                  Attempts: {item.attempts}
                  {item.nextAttemptAt > Date.now() ? ` • Next retry in ${formatCountdown(item.nextAttemptAt)}` : ''}
                  {item.lastError ? ' • Last attempt failed' : ''}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default PendingActionsPanel;
