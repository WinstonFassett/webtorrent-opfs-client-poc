import { useState, useEffect, useCallback } from 'react';
import WebTorrent from 'webtorrent';
import { TorrentInfo } from '../types';
import { opfsManager, StoredTorrentMeta } from '../utils/opfs';
import { webTorrentOPFSStore, createOPFSStore } from '../utils/webTorrentOPFS';

export const useWebTorrent = () => {
  const [client, setClient] = useState<WebTorrent.Instance | null>(null);
  const [torrents, setTorrents] = useState<TorrentInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [opfsSupported, setOpfsSupported] = useState(false);
  const [storageInfo, setStorageInfo] = useState<StorageEstimate | null>(null);
  const [clientReady, setClientReady] = useState(false);
  const initializationPromise = useRef<Promise<void>>();

  // Convert WebTorrent instance to TorrentInfo
  const convertTorrent = useCallback((torrent: any, storedMeta?: StoredTorrentMeta): TorrentInfo => {
    // Use overridden progress if available (important for seeded torrents)
    const progress = torrent._progressOverride !== undefined ? torrent._progressOverride : torrent.progress;
    
    let status: TorrentInfo['status'] = 'downloading';
    
    // Handle status
    if (torrent.verifying) {
      status = 'verifying';
    } else if (torrent.paused) {
      status = 'paused';
    } else if (progress >= 0.999) {
      status = torrent.uploaded > 0 ? 'seeding' : 'completed';
    } else if ((torrent.downloadSpeed || 0) === 0 && (torrent.numPeers || 0) === 0 && progress < 1) {
      status = 'stalled';
    }

    const timeRemaining = torrent.timeRemaining && torrent.timeRemaining !== Infinity 
      ? Math.floor(torrent.timeRemaining / 1000) 
      : 0;

    const downloaded = torrent.downloaded || 0;
    const uploaded = torrent.uploaded || 0;
    const ratio = downloaded > 0 ? uploaded / downloaded : 0;

    // Use stored metadata for critical fields when available
    return {
      infoHash: torrent.infoHash || '',
      name: storedMeta?.name || torrent.name || 'Unknown',
      length: storedMeta?.length || torrent.length || 0,
      downloaded,
      uploaded,
      downloadSpeed: torrent.downloadSpeed || 0,
      uploadSpeed: torrent.uploadSpeed || 0,
      progress: progress || 0,
      numPeers: torrent.numPeers || 0,
      paused: torrent.paused || false,
      files: storedMeta?.files || torrent.files || [],
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

  // Load existing torrents from OPFS
  const loadExistingTorrents = useCallback(async (webTorrentClient: WebTorrent.Instance) => {
    try {
      const metas = await opfsManager.getAllTorrentMetas();
      console.log(`📂 Found ${metas.length} stored torrents in OPFS`);

      // Add all torrents immediately and get their objects
      const addedTorrents = metas.map(meta => {
        console.log('Adding torrent to WebTorrent:', meta.name, {
          isSeeded: meta.isSeeded,
          isVerified: meta.isVerified
        });
        
        const torrent = webTorrentClient.add(meta.magnetURI, {
          store: createOPFSStore,
          skipVerify: !meta.isSeeded // Only verify seeded torrents
        });
        
        // If this is a seeded torrent that hasn't been verified yet
        if (meta.isSeeded && !meta.isVerified) {
          console.log(`🔍 Requiring verification for seeded torrent: ${meta.name}`);
          torrent._progressOverride = 0;
        }
        
        // Set up background initialization
        torrent.on('ready', async () => {
          if (torrent.infoHash) {
            await webTorrentOPFSStore.initializeTorrent(torrent.infoHash);
          }
        });

        torrent.on('verifying', () => {
          console.log(`🔄 Verifying torrent: ${torrent.name}`);
          if (meta.isSeeded) {
            torrent._progressOverride = 0;
          }
          updateTorrents();
        });

        torrent.on('verify', async () => {
          console.log(`✅ Torrent verified: ${torrent.name}`);
          if (meta.isSeeded) {
            // Update metadata to mark as verified
            await storeTorrentMeta({
              ...torrent,
              isSeeded: true,
              isVerified: true
            });
            torrent._progressOverride = 1;
          }
          updateTorrents();
        });
        
        torrent.on('error', (err: Error) => {
          console.error(`Torrent error: ${err.message}`);
          setError(`Torrent error: ${err.message}`);
        });

        return torrent;
      });

      // Update UI with all torrents at once, using stored metadata
      setTorrents(addedTorrents.map((torrent, index) => convertTorrent(torrent, metas[index])));
    } catch (error) {
      console.warn('⚠️ Failed to load existing torrents:', error);
      setIsLoading(false);
    }
  }, []); // Remove dependency on opfsSupported since we check it in the parent effect

  // Initialize WebTorrent client and OPFS
  useEffect(() => {
    let mounted = true;
    const initializeClient = async () => {
      try {
        // Check OPFS support first
        const supported = opfsManager.isSupported();
        if (!mounted) return;
        setOpfsSupported(supported);
        
        // Initialize OPFS if supported
        if (supported) {
          await opfsManager.initialize();
          if (!mounted) return;
          
          const estimate = await opfsManager.getStorageEstimate();
          if (!mounted) return;
          setStorageInfo(estimate);
        } else {
          console.warn('⚠️ OPFS not supported, falling back to memory storage');
        }

        // Initialize WebTorrent
        const webTorrentClient = new WebTorrent();
        if (!mounted) {
          webTorrentClient.destroy();
          return;
        }

        (window as any).webTorrentClient = webTorrentClient;
        
        webTorrentClient.on('error', (err: Error) => {
          console.error('WebTorrent client error:', err);
          setError(`WebTorrent error: ${err.message}`);
        });

        setClient(webTorrentClient);

        // Wait for client to be ready
        await new Promise<void>((resolve) => {
          if (webTorrentClient.ready) {
            resolve();
          } else {
            webTorrentClient.once('ready', () => resolve());
          }
        });

        // Load existing torrents after client is ready
        if (supported) {
          await loadExistingTorrents(webTorrentClient);
        }
        if (!mounted) {
          webTorrentClient.destroy();
          return;
        }

        setClientReady(true);
        setIsLoading(false);

      } catch (err) {
        console.error('Failed to initialize:', err);
        if (mounted) {
          setError(`Initialization failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
          setIsLoading(false);
        }
      }
    };

    initializeClient();

    return () => {
      mounted = false;
      if (client) {
        client.destroy();
        delete (window as any).webTorrentClient;
      }
    };
  }, []); // Remove loadExistingTorrents dependency since it no longer depends on state

  // Update storage info periodically
  useEffect(() => {
    if (!opfsSupported) return;

    const interval = setInterval(updateStorageInfo, 30000);
    return () => clearInterval(interval);
  }, [opfsSupported, updateStorageInfo]);

  // Update torrents list
  const updateTorrents = useCallback(async () => {
    if (!client) return;
    
    // Get stored metadata for each torrent
    const metas = opfsSupported ? await opfsManager.getAllTorrentMetas() : [];
    const metaMap = new Map(metas.map(meta => [meta.infoHash, meta]));
    
    const updatedTorrents = client.torrents.map((torrent: any) => 
      convertTorrent(torrent, metaMap.get(torrent.infoHash))
    );
    setTorrents(updatedTorrents);
  }, [client, convertTorrent, opfsSupported]);

  // Set up periodic updates
  useEffect(() => {
    if (!client) return;

    const interval = setInterval(updateTorrents, 1000);
    return () => clearInterval(interval);
  }, [client, updateTorrents]);

  // Store torrent metadata when adding
  const storeTorrentMeta = useCallback(async (torrent: any) => {
    if (!opfsSupported || !torrent.infoHash) return;

    const meta: StoredTorrentMeta = {
      infoHash: torrent.infoHash,
      name: torrent.name,
      magnetURI: torrent.magnetURI,
      length: torrent.length,
      files: torrent.files.map((f: any) => ({
        name: f.name,
        length: f.length,
        path: f.path
      })),
      createdAt: Date.now()
    };

    try {
      await opfsManager.storeTorrentMeta(meta);
    } catch (error) {
      console.warn('Failed to store torrent meta:', error);
    }
  }, [opfsSupported]);

  // Add torrent
  const addTorrent = useCallback((torrentId: string | File | FileList) => {
    if (!client) {
      setError('WebTorrent client not initialized');
      return;
    }

    try {
      const torrentOptions: any = {};
      
      if (opfsSupported) {
        torrentOptions.store = createOPFSStore;
      }

      if (torrentId instanceof FileList) {
        const files = Array.from(torrentId);
        client.seed(files, torrentOptions, async (torrent: any) => {
          // Override progress to 0 initially for seeded torrents
          torrent._progressOverride = 0;
          
          torrent.on('ready', async () => {
            console.log(`🌱 Seeded torrent ready: ${torrent.name}`);
            if (opfsSupported && torrent.infoHash) {
              await webTorrentOPFSStore.initializeTorrent(torrent.infoHash);
              // Store initial metadata
              await storeTorrentMeta({
                ...torrent,
                isSeeded: true, // Mark as seeded
                _progressOverride: 0 // Force progress to 0 until verified
              });
            }
            updateTorrents();
          });

          // Wait for the metadata to be fully generated
          torrent.on('metadata', async () => {
            console.log(`📦 Seeded torrent metadata generated: ${torrent.name}`);
            if (opfsSupported && torrent.infoHash) {
              // Update metadata with complete info
              await storeTorrentMeta({
                ...torrent,
                isSeeded: true,
                _progressOverride: 0
              });
            }
          });
          
          // Only mark as complete after verification
          torrent.on('verifying', () => {
            console.log(`🔍 Verifying seeded torrent: ${torrent.name}`);
            torrent._progressOverride = 0;
            updateTorrents();
          });

          torrent.on('verify', () => {
            console.log(`✅ Verified seeded torrent: ${torrent.name}`);
            torrent._progressOverride = 1; // Now we can mark it as complete
            updateTorrents();
          });
          
          torrent.on('upload', () => updateTorrents());
          torrent.on('download', () => updateTorrents());
          
          torrent.on('error', (err: Error) => {
            console.error('Torrent error:', err.message);
            setError(`Torrent error: ${err.message}`);
          });
          
          updateTorrents();
        });
      } else {
        client.add(torrentId, torrentOptions, async (torrent: any) => {
          if (opfsSupported && torrent.infoHash) {
            await webTorrentOPFSStore.initializeTorrent(torrent.infoHash);
            // Store metadata as soon as we have an infoHash
            await storeTorrentMeta(torrent);
          }
          
          torrent.on('ready', async () => {
            // Update metadata again after ready in case more info is available
            await storeTorrentMeta(torrent);
            updateTorrents();
          });
          
          torrent.on('verify', () => updateTorrents());
          torrent.on('download', () => updateTorrents());
          torrent.on('upload', () => updateTorrents());
          torrent.on('verifying', () => updateTorrents());
          
          torrent.on('error', (err: Error) => {
            console.error('Torrent error:', err.message);
            setError(`Torrent error: ${err.message}`);
          });
          
          updateTorrents();
        });
      }
      setError(null);
    } catch (err) {
      console.error('💥 Failed to add torrent:', err);
      setError(`Failed to add torrent: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [client, updateTorrents, opfsSupported, storeTorrentMeta]);

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
        console.log('✅ Torrent removed successfully');
        
        // Clean up OPFS storage and metadata
        if (opfsSupported && infoHash) {
          try {
            await webTorrentOPFSStore.deleteTorrent(infoHash);
            await opfsManager.deleteTorrentMeta(infoHash);
            await opfsManager.deleteTorrentDirectory(infoHash);
            console.log('🧹 Cleaned up OPFS storage for torrent');
          } catch (error) {
            console.warn('Failed to clean up OPFS storage:', error);
          }
        }
        updateTorrents();
      }
    });
  }, [client, updateTorrents, opfsSupported]);

  // Clear all storage (dev utility)
  const clearAllStorage = useCallback(async () => {
    if (!opfsSupported) return;

    try {
      // Remove all torrents from WebTorrent client
      if (client) {
        const torrentHashes = client.torrents.map((t: WebTorrent.Torrent) => t.infoHash);
        for (const hash of torrentHashes) {
          client.remove(hash);
        }
      }

      // Clear all OPFS storage
      await opfsManager.clearAllOPFS();
      
      // Update UI
      setTorrents([]);
      await updateStorageInfo();
      
      console.log('🧹 All storage cleared');
    } catch (error) {
      console.error('Failed to clear all storage:', error);
      setError(`Failed to clear storage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [client, opfsSupported, updateStorageInfo]);

  // Get OPFS contents (dev utility)
  const getOPFSContents = useCallback(async () => {
    if (!opfsSupported) return [];
    
    try {
      return await opfsManager.getOPFSContents();
    } catch (error) {
      console.error('Failed to get OPFS contents:', error);
      return [];
    }
  }, [opfsSupported]);

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
    clearAllStorage,
    getOPFSContents,
    stats,
    opfsSupported,
    storageInfo
  };
};