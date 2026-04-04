import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, CloudOff, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePendingOfflineMutations } from '../../hooks/usePendingOfflineMutations';
import { useNetworkStatus } from '../../contexts/NetworkStatusContext';
import { HOUR_MS, MINUTE_MS, ONE_DAY_MS } from '../../constants/time';
import { OFFLINE_MUTATION_LABELS } from '../../constants/offline';

const formatRelativeTime = (ts: number, t: (key: string, options?: Record<string, unknown>) => string) => {
  const diff = Date.now() - ts;
  if (diff < MINUTE_MS) return t('network.justNow');
  if (diff < HOUR_MS) return t('network.minutesAgo', { count: Math.max(1, Math.floor(diff / MINUTE_MS)) });
  if (diff < ONE_DAY_MS) return t('network.hoursAgo', { count: Math.max(1, Math.floor(diff / HOUR_MS)) });
  return t('network.daysAgo', { count: Math.max(1, Math.floor(diff / ONE_DAY_MS)) });
};

const formatCountdown = (targetTs: number, t: (key: string, options?: Record<string, unknown>) => string) => {
  const diff = Math.max(0, targetTs - Date.now());
  if (diff < MINUTE_MS) return t('network.lessThanMinute');
  if (diff < HOUR_MS) return t('network.minutesShort', { count: Math.max(1, Math.floor(diff / MINUTE_MS)) });
  if (diff < ONE_DAY_MS) return t('network.hoursShort', { count: Math.max(1, Math.floor(diff / HOUR_MS)) });
  return t('network.daysShort', { count: Math.max(1, Math.floor(diff / ONE_DAY_MS)) });
};

export const PendingActionsPanel = () => {
  const { t } = useTranslation();
  const { pendingCount, pendingItems, syncing, syncNow } = usePendingOfflineMutations();
  const { isOnline } = useNetworkStatus();
  const [expanded, setExpanded] = useState(false);

  const title = useMemo(() => {
    if (pendingCount === 1) return t('network.queuedActionsSingular');
    return t('network.queuedActionsPlural', { count: pendingCount });
  }, [pendingCount, t]);

  if (pendingCount <= 0) return null;

  return (
    <section className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
      <div className="flex items-center gap-3">
        <CloudOff className="h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs opacity-80">
            {isOnline ? t('network.onlineSyncNow') : t('network.offlineWillSyncWhenReconnected')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-amber-300 bg-white text-amber-800 hover:bg-amber-100"
          aria-label={expanded ? t('network.queuedActionDetailsHide') : t('network.queuedActionDetailsShow')}
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
          {syncing ? t('network.syncing') : t('network.sync')}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2 border-t border-amber-200 pt-3">
          {pendingItems.length === 0 && (
            <div className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-[11px] text-amber-800">
              {t('network.queuedActionsUnavailable')}
            </div>
          )}
          {pendingItems.map((item) => {
            const label = OFFLINE_MUTATION_LABELS[item.type] || item.type;
            return (
              <div key={item.id} className="rounded-lg border border-amber-200 bg-white px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-amber-900">{label}</p>
                  <p className="text-[11px] text-amber-700">{t('network.queuedAt', { time: formatRelativeTime(item.createdAt, t) })}</p>
                </div>
                <p className="mt-1 text-[11px] text-amber-700">
                  {t('network.attemptsSummary', { attempts: item.attempts })}
                  {item.nextAttemptAt > Date.now() ? ` • ${t('network.nextRetryIn', { time: formatCountdown(item.nextAttemptAt, t) })}` : ''}
                  {item.lastError ? ` • ${t('network.lastAttemptFailed')}` : ''}
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
