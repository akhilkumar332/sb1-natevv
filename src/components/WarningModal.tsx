// src/components/WarningModal.tsx
import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface WarningModalProps {
  isVisible: boolean;
  onDismiss: () => void;
}

const WarningModal: React.FC<WarningModalProps> = ({ isVisible, onDismiss }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl border border-red-100 bg-white shadow-2xl">
        <div className="flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-red-600 to-red-700 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
              <AlertTriangle className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/70">Security</p>
              <h3 className="text-lg font-semibold">Inactivity Warning</h3>
            </div>
          </div>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-gray-700">
            You will be logged out in <span className="font-semibold text-red-600">1 minute</span> due to inactivity.
            Move your mouse or press a key to stay logged in.
          </p>
          <button
            onClick={onDismiss}
            className="mt-5 w-full rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-300 hover:bg-red-700"
          >
            I'm Still Here
          </button>
        </div>
      </div>
    </div>
  );
};

export default WarningModal;
