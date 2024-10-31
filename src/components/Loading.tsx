// src/components/Loading.tsx
import React from 'react';

const Loading: React.FC = () => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-50">
      <div className="flex flex-col items-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-red-500 mb-4"></div>
        <div className="text-red-500 text-lg font-semibold">Loading...</div>
      </div>
    </div>
  );
};

export default Loading;