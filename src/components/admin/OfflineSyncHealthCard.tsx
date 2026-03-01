import { Activity, RefreshCw, WifiOff } from 'lucide-react';
import { useNetworkStatus } from '../../contexts/NetworkStatusContext';
import { useOfflineMutationTelemetry } from '../../hooks/useOfflineMutationTelemetry';

const formatTime = (value: number | null) => {
  if (!value) return 'N/A';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return 'N/A';
  }
};

function OfflineSyncHealthCard() {
  const { isOnline } = useNetworkStatus();
  const { telemetry, resetTelemetry } = useOfflineMutationTelemetry();

  return (
    <div className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-bold text-gray-900">Offline Sync Health</h3>
        </div>
        <button
          type="button"
          onClick={resetTelemetry}
          className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Reset
        </button>
      </div>

      <div className="mb-3 flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm">
        <span className="text-blue-900 font-semibold">Network</span>
        <span className={`inline-flex items-center gap-1 font-semibold ${isOnline ? 'text-emerald-700' : 'text-amber-700'}`}>
          {!isOnline && <WifiOff className="h-3.5 w-3.5" />}
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
        <p className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2"><span>Queued</span><span className="font-semibold">{telemetry.pendingCount}</span></p>
        <p className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2"><span>Enqueued</span><span className="font-semibold">{telemetry.enqueued}</span></p>
        <p className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2"><span>Flush Runs</span><span className="font-semibold">{telemetry.flushRuns}</span></p>
        <p className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2"><span>Processed</span><span className="font-semibold">{telemetry.flushedProcessed}</span></p>
        <p className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2"><span>Succeeded</span><span className="font-semibold text-emerald-700">{telemetry.flushedSucceeded}</span></p>
        <p className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2"><span>Failed</span><span className="font-semibold text-rose-700">{telemetry.flushedFailed}</span></p>
      </div>

      <div className="mt-3 space-y-1 text-xs text-gray-500">
        <p>Last enqueue: {formatTime(telemetry.lastEnqueueAt)}</p>
        <p>Last flush: {formatTime(telemetry.lastFlushAt)}</p>
        <p>Last failure: {formatTime(telemetry.lastFailureAt)}</p>
        {telemetry.lastFailureMessage ? <p className="text-rose-700">{telemetry.lastFailureMessage}</p> : null}
      </div>

      {telemetry.recentEvents.length > 0 && (
        <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-gray-500">Recent Events</p>
          <div className="space-y-1 text-xs text-gray-600">
            {telemetry.recentEvents.slice(0, 5).map((event, index) => (
              <p key={`${event.at}-${event.kind}-${index}`}>
                {new Date(event.at).toLocaleTimeString()} • {event.kind}
                {typeof event.processed === 'number' ? ` (${event.succeeded ?? 0}/${event.processed})` : ''}
                {event.message ? ` • ${event.message}` : ''}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default OfflineSyncHealthCard;
