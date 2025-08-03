import React, { useState } from 'react';
import { Database, Trash2, FolderOpen, RefreshCw } from 'lucide-react';
import { formatBytes } from '../utils/formatters';
import { OPFSFileInfo } from '../utils/opfs';

interface DevToolsProps {
  onClearAllStorage: () => Promise<void>;
  onGetOPFSContents: () => Promise<OPFSFileInfo[]>;
  opfsSupported: boolean;
}

export const DevTools: React.FC<DevToolsProps> = ({
  onClearAllStorage,
  onGetOPFSContents,
  opfsSupported
}) => {
  const [showDevTools, setShowDevTools] = useState(false);
  const [opfsContents, setOpfsContents] = useState<OPFSFileInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleClearStorage = async () => {
    const confirmed = confirm(
      '⚠️ This will delete ALL torrents and stored files. This action cannot be undone. Continue?'
    );
    
    if (confirmed) {
      setIsLoading(true);
      try {
        await onClearAllStorage();
        setOpfsContents([]);
        alert('✅ All storage cleared successfully');
      } catch (error) {
        alert(`❌ Failed to clear storage: ${error}`);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleViewOPFS = async () => {
    setIsLoading(true);
    try {
      const contents = await onGetOPFSContents();
      setOpfsContents(contents);
      console.log('📂 OPFS Contents:', contents);
      
      // Create a nice tree structure for logging
      const tree = createFileTree(contents);
      console.log('🌳 OPFS File Tree:');
      logFileTree(tree);
    } catch (error) {
      console.error('Failed to get OPFS contents:', error);
      alert(`❌ Failed to get OPFS contents: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const createFileTree = (files: OPFSFileInfo[]) => {
    const tree: any = {};
    
    files.forEach(file => {
      const parts = file.path.split('/');
      let current = tree;
      
      parts.forEach((part, index) => {
        if (!current[part]) {
          current[part] = index === parts.length - 1 && file.type === 'file' 
            ? { _file: true, _size: file.size }
            : {};
        }
        current = current[part];
      });
    });
    
    return tree;
  };

  const logFileTree = (tree: any, indent = '') => {
    Object.keys(tree).forEach(key => {
      if (key.startsWith('_')) return;
      
      const item = tree[key];
      if (item._file) {
        console.log(`${indent}📄 ${key} (${formatBytes(item._size)})`);
      } else {
        console.log(`${indent}📁 ${key}/`);
        logFileTree(item, indent + '  ');
      }
    });
  };

  const getTotalSize = () => {
    return opfsContents
      .filter(f => f.type === 'file')
      .reduce((sum, f) => sum + f.size, 0);
  };

  const getFileCount = () => {
    return opfsContents.filter(f => f.type === 'file').length;
  };

  const getDirCount = () => {
    return opfsContents.filter(f => f.type === 'directory').length;
  };

  if (!opfsSupported) {
    return null;
  }

  return (
    <div className="mb-6">
      <button
        onClick={() => setShowDevTools(!showDevTools)}
        className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
      >
        <Database size={16} />
        Developer Tools
        {showDevTools ? '▼' : '▶'}
      </button>

      {showDevTools && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">OPFS Storage Management</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <button
              onClick={handleViewOPFS}
              disabled={isLoading}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <FolderOpen size={16} />
              )}
              View OPFS Contents
            </button>
            
            <button
              onClick={handleClearStorage}
              disabled={isLoading}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <Trash2 size={16} />
              )}
              Clear All Storage
            </button>
          </div>

          {opfsContents.length > 0 && (
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-900">Storage Summary</h4>
                <button
                  onClick={handleViewOPFS}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  Refresh
                </button>
              </div>
              
              <div className="grid grid-cols-3 gap-4 text-sm mb-4">
                <div className="text-center">
                  <div className="font-semibold text-gray-900">{getFileCount()}</div>
                  <div className="text-gray-600">Files</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-gray-900">{getDirCount()}</div>
                  <div className="text-gray-600">Directories</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-gray-900">{formatBytes(getTotalSize())}</div>
                  <div className="text-gray-600">Total Size</div>
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto">
                <div className="space-y-1 text-sm font-mono">
                  {opfsContents.map((item, index) => (
                    <div key={index} className="flex items-center justify-between py-1 px-2 hover:bg-gray-50 rounded">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">
                          {item.type === 'directory' ? '📁' : '📄'}
                        </span>
                        <span className="text-gray-900">{item.path}</span>
                      </div>
                      {item.type === 'file' && (
                        <span className="text-gray-500 text-xs">
                          {formatBytes(item.size)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 text-xs text-gray-600">
            <p><strong>View OPFS Contents:</strong> Lists all files and directories in OPFS storage with sizes</p>
            <p><strong>Clear All Storage:</strong> Removes all torrents and stored files (useful during development)</p>
            <p><strong>Note:</strong> File tree is also logged to browser console for detailed inspection</p>
          </div>
        </div>
      )}
    </div>
  );
};