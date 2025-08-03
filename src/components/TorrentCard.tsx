import React from 'react';
import { Play, Pause, Trash2, Download, Upload, Users, Clock, HardDrive, Link, QrCode, FileDown, Folder, ChevronDown, ChevronRight } from 'lucide-react';
import { TorrentInfo } from '../types';
import { formatBytes, formatSpeed, formatTime } from '../utils/formatters';
import QRCode from 'qrcode';

interface TorrentCardProps {
  torrent: TorrentInfo;
  onPause: (infoHash: string) => void;
  onResume: (infoHash: string) => void;
  onRemove: (infoHash: string) => void;
}

export const TorrentCard: React.FC<TorrentCardProps> = ({
  torrent,
  onPause,
  onResume,
  onRemove,
}) => {
  const [showFiles, setShowFiles] = React.useState(false);

  const copyMagnetLink = async () => {
    try {
      await navigator.clipboard.writeText(torrent.magnetURI);
      // You could add a toast notification here
    } catch (err) {
      console.error('Failed to copy magnet link:', err);
    }
  };

  const showQRCode = async () => {
    try {
      const qrDataURL = await QRCode.toDataURL(torrent.magnetURI, {
        width: 300,
        margin: 2,
      });
      
      // Create a modal to show the QR code
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50';
      modal.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-gray-900">QR Code</h3>
            <button class="text-gray-400 hover:text-gray-600" onclick="this.closest('.fixed').remove()">
              <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
              </svg>
            </button>
          </div>
          <div class="text-center">
            <img src="${qrDataURL}" alt="QR Code" class="mx-auto mb-4 rounded-lg" />
            <p class="text-sm text-gray-600">Scan to get magnet link</p>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      // Remove modal when clicking outside
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
        }
      });
    } catch (err) {
      console.error('Failed to generate QR code:', err);
    }
  };

  const downloadFile = async (fileIndex: number) => {
    try {
      const client = (window as any).webTorrentClient;
      if (!client) {
        console.error('WebTorrent client not available');
        return;
      }

      const torrentInstance = client.get(torrent.infoHash);
      if (!torrentInstance) {
        console.error('Torrent not found');
        return;
      }

      const file = torrentInstance.files[fileIndex];
      if (!file) {
        console.error('File not found');
        return;
      }

      // Check if OPFS is being used
      const opfsSupported = 'storage' in navigator && 'getDirectory' in navigator.storage;
      
      if (opfsSupported) {
        // For OPFS, we can handle large files efficiently
        file.getBlobURL((err: any, url: string) => {
          if (err) {
            console.error('Error creating download:', err);
            alert('Failed to create download.');
            return;
          }

          // Create and trigger download
          const a = document.createElement('a');
          a.href = url;
          a.download = file.name;
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          
          // Clean up blob URL after a delay
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        });
      } else {
        // For memory storage, warn about large files
        if (file.length > 100 * 1024 * 1024) { // 100MB
          const proceed = confirm(
            `This file is ${formatBytes(file.length)}. Large files may cause browser slowdown or crashes due to memory limitations. Continue?`
          );
          if (!proceed) return;
        }

        // Create download using blob URL
        file.getBlobURL((err: any, url: string) => {
          if (err) {
            console.error('Error creating download:', err);
            alert('Failed to create download. File may be too large for browser memory.');
            return;
          }

          // Create and trigger download
          const a = document.createElement('a');
          a.href = url;
          a.download = file.name;
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          
          // Clean up blob URL after a delay
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        });
      }
    } catch (error) {
      console.error('Download error:', error);
      alert('Download failed. Please try again.');
    }
  };

  const downloadAllFiles = async () => {
    const totalSize = torrent.files.reduce((sum, file) => sum + file.length, 0);
    const opfsSupported = 'storage' in navigator && 'getDirectory' in navigator.storage;
    
    // Only warn about size if using memory storage
    if (!opfsSupported && totalSize > 500 * 1024 * 1024) { // 500MB
      const proceed = confirm(
        `Total download size is ${formatBytes(totalSize)}. This may cause browser issues. Continue?`
      );
      if (!proceed) return;
    }

    // Download files sequentially to avoid overwhelming the browser
    for (let i = 0; i < torrent.files.length; i++) {
      await new Promise(resolve => {
        setTimeout(() => {
          downloadFile(i);
          resolve(void 0);
        }, i * (opfsSupported ? 500 : 1000)); // Shorter delay for OPFS
      });
    }
  };

  const debugStorage = async () => {
    try {
      const client = (window as any).webTorrentClient;
      if (!client) return;

      const torrentInstance = client.get(torrent.infoHash);
      if (!torrentInstance) return;

      console.log('=== STORAGE DEBUG ===');
      console.log('Torrent:', torrent.name);
      console.log('InfoHash:', torrent.infoHash);
      console.log('Progress:', torrent.progress);
      console.log('Pieces total:', torrentInstance.pieces ? torrentInstance.pieces.length : 'unknown');
      
      if (torrentInstance.pieces) {
        const completedPieces = torrentInstance.pieces.filter((p: any) => p).length;
        console.log('Pieces completed:', completedPieces);
      }

      // Check OPFS storage
      const opfsSupported = 'storage' in navigator && 'getDirectory' in navigator.storage;
      if (opfsSupported) {
        const { webTorrentOPFSStore } = await import('../utils/webTorrentOPFS');
        const storedFiles = await webTorrentOPFSStore.getTorrentFiles(torrent.infoHash);
        console.log('OPFS stored files:', storedFiles);
      }
      
      console.log('=== END DEBUG ===');
    } catch (error) {
      console.error('Debug error:', error);
    }
  };

  const cleanupStorage = async () => {
    try {
      const opfsSupported = 'storage' in navigator && 'getDirectory' in navigator.storage;
      if (!opfsSupported) {
        alert('OPFS not supported');
        return;
      }

      const { webTorrentOPFSStore } = await import('../utils/webTorrentOPFS');
      await webTorrentOPFSStore.cleanupTorrent(torrent.infoHash);
      alert('Storage cleaned up');
    } catch (error) {
      console.error('Cleanup error:', error);
      alert('Cleanup failed');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'downloading':
        return 'text-blue-600 bg-blue-50';
      case 'seeding':
      case 'completed':
        return 'text-green-600 bg-green-50';
      case 'paused':
        return 'text-gray-600 bg-gray-50';
      case 'error':
        return 'text-red-600 bg-red-50';
      case 'stalled':
        return 'text-yellow-600 bg-yellow-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getProgressColor = (status: string) => {
    switch (status) {
      case 'downloading':
        return 'bg-blue-500';
      case 'seeding':
      case 'completed':
        return 'bg-green-500';
      case 'stalled':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-400';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden border border-gray-100">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 truncate mb-1">
              {torrent.name}
            </h3>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(torrent.status)}`}>
                {torrent.status}
              </span>
              <span className="text-sm text-gray-500">
                {formatBytes(torrent.length)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={copyMagnetLink}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Copy Magnet Link"
            >
              <Link size={18} />
            </button>
            <button
              onClick={showQRCode}
              className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
              title="Show QR Code"
            >
              <QrCode size={18} />
            </button>
            <button
              onClick={debugStorage}
              className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
              title="Debug Storage"
            >
              🐛
            </button>
            <button
              onClick={cleanupStorage}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Cleanup Storage"
            >
              🧹
            </button>
            {torrent.files.length > 1 && (
              <button
                onClick={() => setShowFiles(!showFiles)}
                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                title="Show Files"
              >
                <Folder size={18} />
              </button>
            )}
            <button
              onClick={torrent.files.length === 1 ? () => downloadFile(0) : downloadAllFiles}
              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              title={torrent.files.length === 1 ? "Download File" : "Download All Files"}
            >
              <FileDown size={18} />
            </button>
            {torrent.paused ? (
              <button
                onClick={() => onResume(torrent.infoHash)}
                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                title="Resume"
              >
                <Play size={18} />
              </button>
            ) : (
              <button
                onClick={() => onPause(torrent.infoHash)}
                className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                title="Pause"
              >
                <Pause size={18} />
              </button>
            )}
            <button
              onClick={() => onRemove(torrent.infoHash)}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Remove"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">
              Progress: {(torrent.progress * 100).toFixed(1)}%
            </span>
            {torrent.status === 'downloading' && torrent.timeRemaining > 0 && (
              <span className="text-sm text-gray-500 flex items-center gap-1">
                <Clock size={14} />
                {formatTime(torrent.timeRemaining)}
              </span>
            )}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full ${getProgressColor(torrent.status)} transition-all duration-300 ease-out`}
              style={{ width: `${torrent.progress * 100}%` }}
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            <Download size={16} className="text-blue-500" />
            <div>
              <div className="font-medium">{formatSpeed(torrent.downloadSpeed)}</div>
              <div className="text-xs text-gray-500">Down</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <Upload size={16} className="text-green-500" />
            <div>
              <div className="font-medium">{formatSpeed(torrent.uploadSpeed)}</div>
              <div className="text-xs text-gray-500">Up</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <Users size={16} className="text-purple-500" />
            <div>
              <div className="font-medium">{torrent.numPeers}</div>
              <div className="text-xs text-gray-500">Peers</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <HardDrive size={16} className="text-orange-500" />
            <div>
              <div className="font-medium">{torrent.ratio.toFixed(2)}</div>
              <div className="text-xs text-gray-500">Ratio</div>
            </div>
          </div>
        </div>

        {/* File Count */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">
              {torrent.files.length} file{torrent.files.length !== 1 ? 's' : ''}
            </span>
            {torrent.files.length > 1 && (
              <button
                onClick={() => setShowFiles(!showFiles)}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 transition-colors"
              >
                {showFiles ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                {showFiles ? 'Hide' : 'Show'} Files
              </button>
            )}
          </div>
        </div>

        {/* File List */}
        {showFiles && torrent.files.length > 1 && (
          <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
            {torrent.files.map((file, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {file.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatBytes(file.length)}
                  </div>
                </div>
                <button
                  onClick={() => downloadFile(index)}
                  className="ml-2 p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                  title="Download File"
                >
                  <FileDown size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};