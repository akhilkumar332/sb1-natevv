// src/components/auth/BiometricLoginButton.tsx
import { Fingerprint, Loader2 } from 'lucide-react';

interface Props {
  loading: boolean;
  error: string | null;
  label: string;
  needsReenroll?: boolean;
  onLogin: () => void;
}

export function BiometricLoginButton({ loading, error, label, needsReenroll, onLogin }: Props) {
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onLogin}
        disabled={loading || needsReenroll}
        className="w-full flex items-center justify-center gap-3 py-3.5 px-4 border-2 border-gray-200 rounded-xl bg-white hover:bg-gray-50 text-sm font-semibold text-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
      >
        {loading ? (
          <Loader2 size={20} className="animate-spin text-gray-400" />
        ) : (
          <Fingerprint size={20} className="text-red-600" />
        )}
        {loading ? 'Verifying…' : `Login with ${label}`}
      </button>
      {error && (
        <p className="text-xs text-red-600 text-center">{error}</p>
      )}
    </div>
  );
}
