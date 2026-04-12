// src/components/auth/BiometricLoginButton.tsx
import { Fingerprint, Loader2, WifiOff } from 'lucide-react';

interface Props {
  loading: boolean;
  error: string | null;
  label: string;
  needsReenroll?: boolean;
  isOnline?: boolean;
  onLogin: () => void;
}

export function BiometricLoginButton({
  loading,
  error,
  label,
  needsReenroll,
  isOnline = true,
  onLogin
}: Props) {
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onLogin}
        disabled={loading || needsReenroll || !isOnline}
        className="w-full flex items-center justify-center gap-3 py-3.5 px-4 border-2 border-gray-200 rounded-xl bg-white hover:bg-gray-50 text-sm font-semibold text-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
      >
        {loading ? (
          <Loader2 size={20} className="animate-spin text-gray-400" />
        ) : !isOnline ? (
          <WifiOff size={20} className="text-gray-400" />
        ) : (
          <Fingerprint size={20} className="text-red-600" />
        )}
        {loading ? 'Verifying…' : !isOnline ? 'Network Required' : `Login with ${label}`}
      </button>
      {!isOnline && (
        <p className="text-[10px] text-gray-500 text-center font-medium uppercase tracking-wider">Online required for biometric login</p>
      )}
      {isOnline && error && (
        <p className="text-xs text-red-600 text-center">{error}</p>
      )}
    </div>
  );
}
