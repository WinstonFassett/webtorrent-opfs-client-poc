import React from 'react';
import { AlertTriangle, HardDrive, Database, CheckCircle, Info } from 'lucide-react';
import { formatBytes } from '../utils/formatters';

interface StorageWarningProps {
  opfsSupported: boolean;
  storageInfo: StorageEstimate | null;
}

export const StorageWarning: React.FC<StorageWarningProps> = ({
  opfsSupported,
  storageInfo,
}) => {
  if (opfsSupported) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <CheckCircle className="text-green-600 mt-0.5" size={20} />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-green-800 mb-2">
              OPFS Storage Active
            </h3>
            <div className="text-sm text-green-700 space-y-2">
              <div className="flex items-center gap-2">
                <HardDrive size={16} />
                <span>Files are stored persistently using Origin Private File System</span>
              </div>
              <div className="flex items-center gap-2">
                <Database size={16} />
                <span>Large files are handled efficiently without memory limitations</span>
              </div>
              {storageInfo && (
                <div className="flex items-center gap-2">
                  <Info size={16} />
                  <span>
                    Storage: {storageInfo.usage ? formatBytes(storageInfo.usage) : '0 B'} used
                    {storageInfo.quota && ` of ${formatBytes(storageInfo.quota)} available`}
                  </span>
                </div>
              )}
              <p className="mt-2 text-xs">
                <strong>Benefits:</strong> Files persist between sessions, no memory limitations, 
                better performance for large files.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="text-amber-600 mt-0.5" size={20} />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-amber-800 mb-2">
            Fallback: Memory Storage
          </h3>
          <div className="text-sm text-amber-700 space-y-2">
            <div className="flex items-center gap-2">
              <HardDrive size={16} />
              <span>OPFS not supported - using memory storage with limitations</span>
            </div>
            <div className="flex items-center gap-2">
              <Database size={16} />
              <span>Large files (&gt;100MB) may cause browser slowdown or crashes</span>
            </div>
            <p className="mt-2 text-xs">
              <strong>Recommendation:</strong> Use a modern browser that supports OPFS 
              (Chrome 86+, Edge 86+) for better performance and persistent storage.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};