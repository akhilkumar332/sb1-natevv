import { RefreshCw } from 'lucide-react';

type AdminRefreshButtonProps = {
  onClick: () => void;
  label: string;
  isRefreshing?: boolean;
  disabled?: boolean;
  className?: string;
};

function AdminRefreshButton({
  onClick,
  label,
  isRefreshing = false,
  disabled = false,
  className = '',
}: AdminRefreshButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled || isRefreshing}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 ${className}`.trim()}
    >
      <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
    </button>
  );
}

export default AdminRefreshButton;
