import { useState, useEffect, useCallback } from 'react';
import WebTorrent from 'webtorrent';
import { TorrentInfo } from '../types';
import { opfsManager } from '../utils/opfs';
import { webTorrentOPFSStore, createOPFSStore } from '../utils/webTorrentOPFS';

export const useWebTorrent = () => {
  const [client, setClient] = useState<WebTorrent.Instance | null>(null);
  const [torrents, setTorrents] = useState<TorrentInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [opfsSupported, setOpfsSupported] = useState(false);
  const [storageInfo, setStorageInfo] = useState<StorageEstimate | null>(null);

  // Convert WebTorrent instance to TorrentInfo
  const convertTorrent = useCallback((torrent: any): TorrentInfo => {
    // Use progress override for seeding visualization if set
    const progress = torrent._progressOverride !== undefined ? torrent._progressOverride : torrent.progress;
    
    // Calculate status based on torrent state
    let status = 'downloading';
    if (progress >= 1) {
      status = 'completed';
    } else if (torrent.paused) {
      status = 'paused';
    } else if (torrent.downloadSpeed === 0 && torrent.numPeers === 0 && progress < 1) {
      status = 'stalled';
    }

    // Calculate time remaining (convert from ms to seconds)
    const timeRemaining = torrent.timeRemaining ? Math.floor(torrent.timeRemaining / 1000) : null;

    // Calculate ratio
    const ratio = torrent.downloaded > 0 ? torrent.uploaded / torrent.downloaded : 0;

    return {
      infoHash: torrent.infoHash,
      name: torrent.name || 'Unknown',
      length: torrent.length || 0,
      downloaded: torrent.downloaded || 0,
      uploaded: torrent.uploaded || 0,
      downloadSpeed: torrent.downloadSpeed || 0,
      uploadSpeed: torrent.uploadSpeed || 0,
      progress: progress || 0,
      numPeers: torrent.numPeers || 0,
      paused: torrent.paused || false,
      files: torrent.files || [],
      magnetURI: torrent.magnetURI || '',
      timeRemaining,
      status,
      ratio
    };
  }, []);

  // Update storage info periodically
  const updateStorageInfo = useCallback(async () => {
    if (!opfsSupported) return;
    
    try {
      const estimate = await opfsManager.getStorageEstimate();
      setStorageInfo(estimate);
    } catch (err) {
      console.warn('Failed to get storage estimate:', err);
    }
  }, [opfsSupported]);

  // Initialize WebTorrent client
  useEffect(() => {
    const initializeClient = async () => {
      try {
        // Check OPFS support
        const supported = opfsManager.isSupported();
        setOpfsSupported(supported);
        
        if (supported) {
          await opfsManager.initialize();
          console.log('OPFS initialized successfully');
          
          // Get storage info
          const estimate = await opfsManager.getStorageEstimate();
          setStorageInfo(estimate);
        } else {
          console.warn('OPFS not supported, falling back to memory storage');
        }

        const webTorrentClient = new WebTorrent();
        
        // Store client globally for file downloads
        (window as any).webTorrentClient = webTorrentClient;
        
        webTorrentClient.on('error', (err: Error) => {
          console.error('WebTorrent client error:', err);
          setError(`WebTorrent error: ${err.message}`);
        });

        setClient(webTorrentClient);
        setIsLoading(false);

      } catch (err) {
        console.error('Failed to initialize:', err);
        setError(`Initialization failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setIsLoading(false);
      }
    };

    initializeClient();

    return () => {
      if (client) {
        client.destroy();
        delete (window as any).webTorrentClient;
      }
    };
  }, []);

  // Update storage info periodically
  useEffect(() => {
    if (!opfsSupported) return;

    const interval = setInterval(updateStorageInfo, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [opfsSupported, updateStorageInfo]);

  // Update torrents list
  const updateTorrents = useCallback(() => {
    if (!client) return;
    
    const updatedTorrents = client.torrents.map(convertTorrent);
    setTorrents(updatedTorrents);
  }, [client, convertTorrent]);

  // Set up periodic updates
  useEffect(() => {
    if (!client) return;

    const interval = setInterval(updateTorrents, 1000);
    return () => clearInterval(interval);
  }, [client, updateTorrents]);

  // Add torrent
  const addTorrent = useCallback((torrentId: string | File | FileList) => {
    if (!client) {
      setError('WebTorrent client not initialized');
      return;
    }

    try {
      const torrentOptions: any = {};
      
      // Use OPFS if supported
      if (opfsSupported) {
        torrentOptions.store = createOPFSStore;
        console.log('Using OPFS store for torrent');
      } else {
        console.log('Using default memory store for torrent');
      }

      if (torrentId instanceof FileList) {
        // Seed multiple files
        const files = Array.from(torrentId);
        console.log('Seeding files:', files.map(f => f.name));
        
        // Don't set progress to 100% immediately when seeding
        // Let WebTorrent handle the verification process
        client.seed(files, torrentOptions, async (torrent: any) => {
          console.log('Started seeding:', torrent.name);
          console.log('Initial seeding progress:', torrent.progress);
          
          // Force progress to 0 initially for seeding to show verification process
          if (torrent.progress === 1) {
            console.log('Forcing initial progress to 0 for seeding visualization');
            torrent._progressOverride = 0;
          }
          
          // Set up torrent event handlers
          torrent.on('ready', async () => {
            console.log('Torrent ready:', torrent.name);
            console.log('Progress when ready:', torrent.progress);
            console.log('Torrent files:', torrent.files.map((f: any) => ({ name: f.name, length: f.length })));
            console.log('Torrent pieces:', torrent.pieces ? torrent.pieces.length : 'unknown');
            if (opfsSupported && torrent.infoHash) {
              await webTorrentOPFSStore.initializeTorrent(torrent.infoHash);
              // List what files are actually stored
              const storedFiles = await webTorrentOPFSStore.getTorrentFiles(torrent.infoHash);
              console.log('Files stored in OPFS:', storedFiles);
            }
            updateTorrents();
          });
          
          torrent.on('verify', () => {
            console.log('Piece verified, progress:', torrent.progress);
            // Update progress override during verification
            if (torrent._progressOverride !== undefined && torrent._progressOverride < 1) {
              torrent._progressOverride = Math.min(torrent._progressOverride + (1 / torrent.pieces.length), 1);
            }
            updateTorrents();
          });
          
          torrent.on('download', () => {
            console.log(`📥 Download: ${(torrent.progress * 100).toFixed(1)}% (${torrent.downloaded}/${torrent.length} bytes)`);
            updateTorrents();
          });
          
          torrent.on('upload', () => {
            console.log(`📤 Upload: ${torrent.uploaded} bytes uploaded to peers`);
            updateTorrents();
          });
          
          torrent.on('error', (err: Error) => {
            console.error('Torrent error:', err);
            setError(`Torrent error: ${err.message}`);
          });
          
          updateTorrents();
        });
      } else {
        // Add torrent (magnet link or .torrent file)
        console.log('Adding torrent:', typeof torrentId === 'string' ? 'magnet link' : 'torrent file');
        client.add(torrentId, torrentOptions, async (torrent: any) => {
          console.log('Added torrent:', torrent.name);
          console.log('Initial download progress:', torrent.progress);
          
          // Set up torrent event handlers
          torrent.on('ready', async () => {
            console.log('Torrent ready:', torrent.name);
            console.log('Progress when ready:', torrent.progress);
            console.log('Torrent files:', torrent.files.map((f: any) => ({ name: f.name, length: f.length })));
            console.log('Torrent pieces:', torrent.pieces ? torrent.pieces.length : 'unknown');
            if (opfsSupported && torrent.infoHash) {
              await webTorrentOPFSStore.initializeTorrent(torrent.infoHash);
              // List what files are actually stored
              const storedFiles = await webTorrentOPFSStore.getTorrentFiles(torrent.infoHash);
              console.log('Files stored in OPFS:', storedFiles);
            }
            updateTorrents();
          });
          
          torrent.on('verify', () => {
            console.log('Piece verified, progress:', torrent.progress);
            updateTorrents();
          });
          
          torrent.on('download', () => {
            console.log(`📥 Download: ${(torrent.progress * 100).toFixed(1)}% (${torrent.downloaded}/${torrent.length} bytes)`);
            updateTorrents();
          });
          
          torrent.on('upload', () => {
            console.log(`📤 Upload: ${torrent.uploaded} bytes uploaded to peers`);
            updateTorrents();
          });
          
          torrent.on('error', (err: Error) => {
            console.error('Torrent error:', err);
            setError(`Torrent error: ${err.message}`);
          });
          
          updateTorrents();
        });
      }
      setError(null);
    } catch (err) {
      console.error('Failed to add torrent:', err);
      setError(`Failed to add torrent: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [client, updateTorrents, opfsSupported]);

  // Pause torrent
  const pauseTorrent = useCallback((infoHash: string) => {
    if (!client) return;
    
    const torrentInstance = client.get(infoHash);
    if (torrentInstance) {
      torrentInstance.pause();
      updateTorrents();
    }
  }, [client, updateTorrents]);

  // Resume torrent
  const resumeTorrent = useCallback((infoHash: string) => {
    if (!client) return;
    
    const torrentInstance = client.get(infoHash);
    if (torrentInstance) {
      torrentInstance.resume();
      updateTorrents();
    }
  }, [client, updateTorrents]);

  // Remove torrent
  const removeTorrent = useCallback((infoHash: string) => {
    if (!client) return;
    
    client.remove(infoHash, async (err: Error | null) => {
      if (err) {
        console.error('Failed to remove torrent:', err);
        setError(`Failed to remove torrent: ${err.message}`);
      } else {
        console.log('Torrent removed successfully');
        // Clean up OPFS storage
        if (opfsSupported && infoHash) {
          try {
            await webTorrentOPFSStore.deleteTorrent(infoHash);
          } catch (error) {
            console.warn('Failed to clean up OPFS storage:', error);
          }
        }
        updateTorrents();
      }
    });
  }, [client, updateTorrents, opfsSupported]);

  // Calculate stats
  const stats = {
    totalDownloadSpeed: torrents.reduce((sum, t) => sum + t.downloadSpeed, 0),
    totalUploadSpeed: torrents.reduce((sum, t) => sum + t.uploadSpeed, 0),
    totalPeers: torrents.reduce((sum, t) => sum + t.numPeers, 0),
    totalSize: torrents.reduce((sum, t) => sum + t.length, 0),
    activeTorrents: torrents.filter(t => !t.paused).length
  };

  return {
    torrents,
    isLoading,
    error,
    addTorrent,
    pauseTorrent,
    resumeTorrent,
    removeTorrent,
    stats,
    opfsSupported,
    storageInfo
  };
};