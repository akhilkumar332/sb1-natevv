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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center mb-4">
          <AlertTriangle className="w-6 h-6 text-amber-500 mr-3" />
          <h3 className="text-lg font-semibold text-gray-900">Inactivity Warning</h3>
        </div>
        <p className="mb-4 text-gray-700">
          You will be logged out in 1 minute due to inactivity. Move your mouse or press a key to stay logged in.
        </p>
        <button
          onClick={onDismiss}
          className="w-full bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 transition duration-200"
        >
          I'm Still Here
        </button>
      </div>
    </div>
  );
};

export default WarningModal;