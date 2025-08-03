import React from 'react';
import { AlertTriangle, HardDrive, Database, CheckCircle, Info, RefreshCw } from 'lucide-react';
import { formatBytes } from '../utils/formatters';

interface StorageWarningProps {
  opfsSupported: boolean;
  storageInfo: StorageEstimate | null;
}

export const StorageWarning: React.FC<StorageWarningProps> = ({
  opfsSupported,
  storageInfo,
}) => {
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const refreshStorage = async () => {
    if (!opfsSupported) return;
    
    setIsRefreshing(true);
    try {
      // Force a storage estimate refresh
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        console.log('📊 Storage estimate refreshed:', estimate);
      }
    } catch (error) {
      console.error('Failed to refresh storage:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStorageUsagePercentage = () => {
    if (!storageInfo?.usage || !storageInfo?.quota) return 0;
    return (storageInfo.usage / storageInfo.quota) * 100;
  };

  if (opfsSupported) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <CheckCircle className="text-green-600 mt-0.5" size={20} />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-green-800">
                OPFS Storage Active
              </h3>
              <button
                onClick={refreshStorage}
                disabled={isRefreshing}
                className="flex items-center gap-1 px-2 py-1 text-xs text-green-700 hover:text-green-800 hover:bg-green-100 rounded transition-colors disabled:opacity-50"
              >
                <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
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
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Info size={16} />
                    <span>
                      Storage: {storageInfo.usage ? formatBytes(storageInfo.usage) : '0 B'} used
                      {storageInfo.quota && ` of ${formatBytes(storageInfo.quota)} available`}
                      {storageInfo.usage && storageInfo.quota && 
                        ` (${getStorageUsagePercentage().toFixed(1)}%)`
                      }
                    </span>
                  </div>
                  {storageInfo.usage && storageInfo.quota && (
                    <div className="w-full bg-green-200 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(getStorageUsagePercentage(), 100)}%` }}
                      />
                    </div>
                  )}
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