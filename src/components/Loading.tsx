// src/components/Loading.tsx
import React from 'react';

const Loading: React.FC = () => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-overlay backdrop-blur-sm">
      <div className="flex flex-col items-center">
        <div className="mb-4 h-16 w-16 animate-spin rounded-full border-b-2 border-t-2 border-brand-500" />
        <div className="text-lg font-semibold text-brand-500">Loading...</div>
      </div>
    </div>
  );
};

export default Loading;
