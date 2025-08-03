/**
 * WebTorrent OPFS integration
 * Custom file system implementation for WebTorrent using OPFS
 */

import { opfsManager } from './opfs';

export class WebTorrentOPFSPieceStore {
  private infoHash: string;
  private fileIndex: number;
  private chunkLength: number;
  private fileName: string;
  private torrentDir: FileSystemDirectoryHandle | null = null;
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;
  private static instances = new Map<string, WebTorrentOPFSPieceStore>();

  constructor(chunkLength: number, storeOpts: any) {
    const key = `${storeOpts.torrent?.infoHash}_${storeOpts.file?.index ?? 0}`;
    
    // Return existing instance if available
    if (WebTorrentOPFSPieceStore.instances.has(key)) {
      console.log(`🔄 OPFS: Reusing existing store instance for ${key}`);
      return WebTorrentOPFSPieceStore.instances.get(key)!;
    }
    
    this.chunkLength = chunkLength;
    this.infoHash = storeOpts.torrent?.infoHash;
    this.fileIndex = storeOpts.file?.index ?? 0;
    this.fileName = storeOpts.file?.name || `file_${this.fileIndex}`;
    
    if (!this.infoHash) {
      console.error('No infoHash provided to OPFS store');
      throw new Error('infoHash is required for OPFS store');
    }
    
    console.log(`🆕 OPFS Store created for torrent ${this.infoHash}, file ${this.fileIndex} (${this.fileName})`);
    
    // Store this instance
    WebTorrentOPFSPieceStore.instances.set(key, this);
    
    // Initialize asynchronously but track the promise
    this.initPromise = this.initializeAsync();
  }

  private async initializeAsync(): Promise<void> {
    if (this.initialized) return;
    
    try {
      this.torrentDir = await opfsManager.createTorrentDirectory(this.infoHash);
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize OPFS store:', error);
      throw error;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) {
      await this.initPromise;
    } else {
      await this.initializeAsync();
    }
  }

  // Use WebTorrent's expected chunk naming convention
  private getChunkFileName(index: number): string {
    return `__tmp__webtorrent.chunk.${index}`;
  }

  put(index: number, buf: ArrayBuffer, cb?: (error?: Error) => void): void {
    this.putAsync(index, buf)
      .then(() => {
        if (cb) cb();
      })
      .catch((error) => {
        console.error(`Failed to store piece ${index}:`, error);
        if (cb) cb(error);
      });
  }

  private async putAsync(index: number, buf: ArrayBuffer): Promise<void> {
    await this.ensureInitialized();
    
    if (!this.torrentDir) {
      throw new Error('Torrent directory not available');
    }

    const chunkFileName = this.getChunkFileName(index);
    await opfsManager.writeFile(this.torrentDir, chunkFileName, buf);
  }

  get(index: number, opts: any, cb?: (error?: Error | null, buffer?: Buffer | null) => void): void {
    // Handle callback-only case (opts is actually callback)
    if (typeof opts === 'function' && !cb) {
      cb = opts;
      opts = {};
    }

    // Ensure we have a callback
    if (!cb) return;

    // If not initialized yet, return error
    if (!this.initialized) {
      cb(new Error('Store not initialized'));
      return;
    }
    
    this.getAsync(index, opts || {})
      .then((buffer) => {
        if (buffer) {
          // WebTorrent expects Buffer, not ArrayBuffer
          const nodeBuffer = Buffer.from(buffer);
          if (cb) cb(null, nodeBuffer);
        } else {
          if (cb) cb(null, null);
        }
      })
      .catch((error) => {
        if (cb) cb(error instanceof Error ? error : new Error(String(error)));
      });
  }

  private async getAsync(index: number, opts: any): Promise<ArrayBuffer | null> {
    await this.ensureInitialized();
    
    if (!this.torrentDir) {
      throw new Error('Torrent directory not available');
    }

    const chunkFileName = this.getChunkFileName(index);
    
    try {
      const file = await opfsManager.readFile(this.torrentDir, chunkFileName);
      
      if (file !== null) {
        let buffer: ArrayBuffer;
        try {
          buffer = await file.arrayBuffer();
        } catch (error) {
          console.warn(`⚠️ OPFS: Error reading buffer for piece ${index}:`, error);
          return null;
        }
        
        if (!buffer || !(buffer instanceof ArrayBuffer) || buffer.byteLength === 0) {
          console.warn(`⚠️ OPFS: Buffer is null for piece ${index} for ${this.fileName}`);
          return null;
        }
        
        const start = opts.offset || 0;
        const length = opts.length || buffer.byteLength - start;
        const end = start + length;
        
        // console.log(`📖 OPFS: Read piece ${index} for ${this.fileName}, full size: ${buffer.byteLength}, requested: ${start}-${end}`);
        return buffer.slice(start, end);
      }
      
      // File doesn't exist - this is normal for pieces we haven't downloaded yet
      return null;
    } catch (error) {
      console.warn(`⚠️ OPFS: Error reading piece ${index} for ${this.fileName}:`, error);
      return null;
    }
  }

  close(cb?: (error?: Error) => void): void {
    if (cb && typeof cb === 'function') {
      cb();
    }
  }

  destroy(cb?: (error?: Error) => void): void {
    const key = `${this.infoHash}_${this.fileIndex}`;
    WebTorrentOPFSPieceStore.instances.delete(key);
    
    this.destroyAsync()
      .then(() => {
        if (cb && typeof cb === 'function') {
          cb();
        }
      })
      .catch((error) => {
        console.error('Failed to destroy store:', error);
        if (cb && typeof cb === 'function') {
          cb(error instanceof Error ? error : new Error(String(error)));
        }
      });
  }

  private async destroyAsync(): Promise<void> {
    await this.ensureInitialized();
    
    if (this.torrentDir && this.infoHash) {
      try {
        // Clean up chunk files for this file
        const files = await opfsManager.listTorrentFiles(this.infoHash);
        const chunkFiles = files.filter(f => f.startsWith('__tmp__webtorrent.chunk.'));
        
        for (const chunkFile of chunkFiles) {
          await opfsManager.deleteFile(this.torrentDir, chunkFile);
        }
        console.log(`🧹 OPFS: Cleaned up ${chunkFiles.length} chunks for file ${this.fileIndex}`);
      } catch (error) {
        console.warn(`⚠️ OPFS: Error during cleanup for file ${this.fileIndex}:`, error);
      }
    }
  }
}

// Factory function that WebTorrent will use
export function createOPFSStore(chunkLength: number, storeOpts: any) {
  console.log('🏭 Creating OPFS store with options:', {
    infoHash: storeOpts.torrent?.infoHash,
    fileIndex: storeOpts.file?.index,
    fileName: storeOpts.file?.name,
    chunkLength
  });
  return new WebTorrentOPFSPieceStore(chunkLength, storeOpts);
}

export class WebTorrentOPFSStore {
  private torrentDirs = new Map<string, FileSystemDirectoryHandle>();

  async initializeTorrent(infoHash: string): Promise<void> {
    if (!infoHash) return;
    
    try {
      const torrentDir = await opfsManager.createTorrentDirectory(infoHash);
      this.torrentDirs.set(infoHash, torrentDir);
      console.log(`✅ Initialized OPFS storage for torrent: ${infoHash}`);
    } catch (error) {
      console.warn('⚠️ Failed to initialize torrent:', error);
    }
  }

  async deleteTorrent(infoHash: string): Promise<void> {
    if (!infoHash) return;
    
    try {
      await opfsManager.deleteTorrentDirectory(infoHash);
      this.torrentDirs.delete(infoHash);
      console.log(`🗑️ Deleted OPFS storage for torrent: ${infoHash}`);
    } catch (error) {
      console.warn('⚠️ Failed to delete torrent:', error);
    }
  }

  async getTorrentFiles(infoHash: string): Promise<string[]> {
    if (!infoHash) return [];
    return await opfsManager.listTorrentFiles(infoHash);
  }

  async cleanupTorrent(infoHash: string): Promise<void> {
    if (!infoHash) return;
    
    try {
      await opfsManager.deleteTorrentDirectory(infoHash);
      this.torrentDirs.delete(infoHash);
      console.log(`🧹 Cleaned up OPFS storage for torrent: ${infoHash}`);
    } catch (error) {
      console.warn('⚠️ Failed to cleanup torrent:', error);
    }
  }
}

export const webTorrentOPFSStore = new WebTorrentOPFSStore();