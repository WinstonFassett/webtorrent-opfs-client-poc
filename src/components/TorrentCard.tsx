import React from 'react';
import { Play, Pause, Trash2, Download, Upload, Users, Clock, HardDrive, Link, QrCode, FileDown, Folder, ChevronDown, ChevronRight } from 'lucide-react';
import { TorrentInfo } from '../types';
import { formatBytes, formatSpeed, formatTime } from '../utils/formatters';
import { opfsManager } from '../utils/opfs';
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
      console.log(`🔍 DOWNLOAD CHECK for ${torrent.name}:`, {
        status: torrent.status,
        progress: torrent.progress,
        downloaded: torrent.downloaded,
        length: torrent.length,
        ratio: torrent.ratio
      });

      console.log(`🔽 Starting download for file ${fileIndex} from torrent ${torrent.name}`);
      
      // Check if torrent is complete - use status instead of progress for better reliability
      const isComplete = torrent.status === 'completed' || torrent.status === 'seeding' || torrent.progress >= 0.999;
      
      if (!isComplete) {
        console.log(`❌ Torrent not ready: status=${torrent.status}, progress=${torrent.progress}`);
        alert(`Please wait for the torrent to finish downloading. Status: ${torrent.status}, Progress: ${(torrent.progress * 100).toFixed(1)}%`);
        return;
      }

      const client = (window as any).webTorrentClient;
      if (!client) {
        console.error('❌ WebTorrent client not available');
        alert('WebTorrent client not available');
        return;
      }

      const torrentInstance = await client.get(torrent.infoHash);
      if (!torrentInstance) {
        console.error('❌ Torrent not found');
        alert('Torrent not found');
        return;
      }

      if (!torrent.files || torrent.files.length === 0) {
        console.error('❌ No file information available');
        alert('No file information available');
        return;
      }
      
      if (fileIndex >= torrent.files.length) {
        console.error('❌ File index out of range');
        alert('File index out of range');
        return;
      }

      const targetFile = torrent.files[fileIndex];
      console.log(`📁 Target file: ${targetFile.name}, size: ${formatBytes(targetFile.length)}`);

      const wtFile = torrentInstance.files && torrentInstance.files[fileIndex];
      if (!wtFile) {
        console.error('❌ WebTorrent file not available');
        alert('File is not ready for download. Please wait for the torrent to load completely.');
        return;
      }


      console.log(`🔄 Creating download for file: ${wtFile.name}...`);
      
      const createDownload = new Promise<void>((resolve, reject) => {
        // Create a readable stream from the file
        const stream = wtFile.createReadStream();
        const chunks: Uint8Array[] = [];

        stream.on('data', (chunk: Uint8Array) => {
          chunks.push(chunk);
        });

        stream.on('end', () => {
          try {
            // Concatenate all chunks into a single Uint8Array
            const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
            const fileData = new Uint8Array(totalLength);
            let position = 0;
            for (const chunk of chunks) {
              fileData.set(chunk, position);
              position += chunk.length;
            }

            // Create blob and URL
            const blob = new Blob([fileData]);
            const url = URL.createObjectURL(blob);

            // Create and trigger download
            const a = document.createElement('a');
            a.href = url;
            a.download = wtFile.name;
            a.style.display = 'none';
            document.body.appendChild(a);
            
            console.log(`🚀 Triggering download for ${wtFile.name}`);
            a.click();
            
            document.body.removeChild(a);
            
            setTimeout(() => {
              URL.revokeObjectURL(url);
              console.log(`🧹 Cleaned up blob URL for ${wtFile.name}`);
            }, 5000);
            
            resolve();
          } catch (downloadError) {
            console.error('❌ Error triggering download:', downloadError);
            reject(downloadError);
          }
        });

        stream.on('error', (err: Error) => {
          console.error('❌ Error reading file stream:', err);
          reject(new Error(`Failed to read file: ${err.message}`));
        });
      });

      await createDownload;
      console.log(`✅ Download initiated successfully for ${wtFile.name}`);
      
    } catch (error) {
      console.error('💥 Download error:', error);
      alert(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
    }
  };

  const downloadAllFiles = async () => {
    if (torrent.status !== 'completed' && torrent.status !== 'seeding' && torrent.progress < 0.99) {
      console.log(`❌ Torrent not ready for batch download: status=${torrent.status}, progress=${torrent.progress}`);
      alert(`Please wait for the torrent to finish downloading. Status: ${torrent.status}, Progress: ${(torrent.progress * 100).toFixed(1)}%`);
      return;
    }

    console.log(`📦 Starting batch download of ${torrent.files.length} files`);

    for (let i = 0; i < torrent.files.length; i++) {
      try {
        console.log(`📥 Downloading file ${i + 1}/${torrent.files.length}: ${torrent.files[i].name}`);
        await downloadFile(i);
        
        if (i < torrent.files.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(`❌ Failed to download file ${i}:`, error);
        const continueDownload = confirm(`Failed to download ${torrent.files[i].name}. Continue with remaining files?`);
        if (!continueDownload) break;
      }
    }
    
    console.log(`✅ Batch download completed`);
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
              disabled={torrent.status !== 'completed' && torrent.status !== 'seeding' && torrent.progress < 0.999}
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
                  disabled={torrent.status !== 'completed' && torrent.status !== 'seeding' && torrent.progress < 0.999}
                  className={`ml-2 p-1 rounded transition-colors ${
                    (torrent.status !== 'completed' && torrent.status !== 'seeding' && torrent.progress < 0.999)
                      ? 'text-gray-400 cursor-not-allowed' 
                      : 'text-green-600 hover:bg-green-50'
                  }`}
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