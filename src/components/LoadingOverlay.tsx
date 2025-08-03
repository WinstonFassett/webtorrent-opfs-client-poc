import React from 'react';

export const LoadingOverlay: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-opacity-25 border-b-blue-600"></div>
        <p className="mt-4 text-lg font-medium text-gray-900">Loading WebTorrent...</p>
        <p className="mt-2 text-sm text-gray-500">Initializing storage and loading existing torrents</p>
      </div>
    </div>
  );
};
