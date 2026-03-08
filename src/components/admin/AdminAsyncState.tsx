type AdminRefreshingBannerProps = {
  show: boolean;
  message: string;
};

export function AdminRefreshingBanner({ show, message }: AdminRefreshingBannerProps) {
  if (!show) return null;
  return (
    <div className="rounded-xl border border-red-100 bg-white px-4 py-2 text-xs font-semibold text-gray-600 shadow-sm dark:border-gray-700 dark:bg-[#0b1220] dark:text-gray-300">
      {message}
    </div>
  );
}

type AdminErrorCardProps = {
  message: string | null | undefined;
  onRetry?: () => void;
  retryLabel?: string;
};

export function AdminErrorCard({ message, onRetry, retryLabel = 'Retry' }: AdminErrorCardProps) {
  if (!message) return null;
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm dark:border-red-500/40 dark:bg-red-500/12 dark:text-red-300">
      <div className="flex items-center justify-between gap-3">
        <span>{message}</span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-400"
          >
            {retryLabel}
          </button>
        )}
      </div>
    </div>
  );
}

type AdminEmptyStateCardProps = {
  message: string;
};

export function AdminEmptyStateCard({ message }: AdminEmptyStateCardProps) {
  return (
    <div className="rounded-2xl border border-red-100 bg-white p-8 text-center text-gray-500 shadow-sm dark:border-gray-700 dark:bg-[#0b1220] dark:text-gray-400">
      {message}
    </div>
  );
}
