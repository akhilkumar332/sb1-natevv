// src/components/auth/BiometricEnrollPrompt.tsx
import { Fingerprint, X } from 'lucide-react';
import { ModalShell } from '../shared/ModalShell';

interface Props {
  loading: boolean;
  label: string;
  onEnable: () => void;
  onNotNow: () => void;
  onNever: () => void;
}

export function BiometricEnrollPrompt({ loading, label, onEnable, onNotNow, onNever }: Props) {
  return (
    <ModalShell containerClassName="w-full max-w-sm rounded-[24px] bg-white p-6 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-2 bg-red-600" />

      <button
        type="button"
        onClick={onNotNow}
        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        aria-label="Dismiss"
      >
        <X size={18} />
      </button>

      <div className="flex flex-col items-center text-center space-y-4 pt-2">
        <div className="flex items-center justify-center w-16 h-16 bg-red-50 text-red-600 rounded-full">
          <Fingerprint size={32} />
        </div>

        <div className="space-y-1">
          <h3 className="text-lg font-bold text-gray-900">Enable {label} Login</h3>
          <p className="text-sm text-gray-500">
            Log in faster next time using {label} — no OTP needed.
          </p>
        </div>

        <div className="w-full space-y-2 pt-1">
          <button
            type="button"
            onClick={onEnable}
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {loading ? 'Setting up…' : `Enable ${label}`}
          </button>
          <button
            type="button"
            onClick={onNotNow}
            className="w-full py-2.5 px-4 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Not Now
          </button>
          <button
            type="button"
            onClick={onNever}
            className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors py-1"
          >
            Don't ask again
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
