/**
 * OPFS (Origin Private File System) utilities for WebTorrent
 * Provides persistent file storage in the browser
 */

export interface StoredTorrentMeta {
  infoHash: string;
  name: string;
  magnetURI: string;
  length: number;
  files: Array<{
    name: string;
    length: number;
    path: string;
  }>;
  createdAt: number;
  isSeeded?: boolean;
  isVerified?: boolean;
}

export interface OPFSFileInfo {
  name: string;
  size: number;
  type: 'file' | 'directory';
  path: string;
}

export class OPFSManager {
  private root: FileSystemDirectoryHandle | null = null;
  private torrentsDir: FileSystemDirectoryHandle | null = null;
  private metaDir: FileSystemDirectoryHandle | null = null;

  async initialize(): Promise<void> {
    if (!('storage' in navigator) || !('getDirectory' in navigator.storage)) {
      throw new Error('OPFS is not supported in this browser');
    }

    try {
      this.root = await navigator.storage.getDirectory();
      this.torrentsDir = await this.root.getDirectoryHandle('torrents', { create: true });
      this.metaDir = await this.root.getDirectoryHandle('torrent-meta', { create: true });
      console.log('🚀 OPFS initialized successfully');
    } catch (error) {
      throw new Error(`Failed to initialize OPFS: ${error}`);
    }
  }

  async createTorrentDirectory(infoHash: string): Promise<FileSystemDirectoryHandle> {
    if (!this.torrentsDir) {
      throw new Error('OPFS not initialized');
    }

    return await this.torrentsDir.getDirectoryHandle(infoHash, { create: true });
  }

  async storeTorrentMeta(meta: StoredTorrentMeta): Promise<void> {
    if (!this.metaDir) {
      throw new Error('OPFS not initialized');
    }

    try {
      const fileHandle = await this.metaDir.getFileHandle(`${meta.infoHash}.json`, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(meta, null, 2));
      await writable.close();
      console.log(`💾 Stored torrent meta for ${meta.name}`);
    } catch (error) {
      throw new Error(`Failed to store torrent meta: ${error}`);
    }
  }

  async getTorrentMeta(infoHash: string): Promise<StoredTorrentMeta | null> {
    if (!this.metaDir) return null;

    try {
      const fileHandle = await this.metaDir.getFileHandle(`${infoHash}.json`);
      const file = await fileHandle.getFile();
      const text = await file.text();
      return JSON.parse(text);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') {
        return null;
      }
      console.warn(`Failed to get torrent meta for ${infoHash}:`, error);
      return null;
    }
  }

  async getAllTorrentMetas(): Promise<StoredTorrentMeta[]> {
    if (!this.metaDir) return [];

    const metas: StoredTorrentMeta[] = [];
    try {
      for await (const handle of this.metaDir.values()) {
        if (handle.kind === 'file' && handle.name.endsWith('.json')) {
          try {
            const file = await handle.getFile();
            const text = await file.text();
            const meta = JSON.parse(text);
            metas.push(meta);
          } catch (error) {
            console.warn(`Failed to parse meta file ${handle.name}:`, error);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to list torrent metas:', error);
    }

    return metas.sort((a, b) => b.createdAt - a.createdAt);
  }

  async deleteTorrentMeta(infoHash: string): Promise<void> {
    if (!this.metaDir) return;

    try {
      await this.metaDir.removeEntry(`${infoHash}.json`);
      console.log(`🗑️ Deleted torrent meta for ${infoHash}`);
    } catch (error) {
      console.warn(`Failed to delete torrent meta ${infoHash}:`, error);
    }
  }

  async writeFile(
    torrentDir: FileSystemDirectoryHandle,
    fileName: string,
    data: ArrayBuffer | Uint8Array
  ): Promise<void> {
    try {
      const fileHandle = await torrentDir.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(data);
      await writable.close();
    } catch (error) {
      throw new Error(`Failed to write file ${fileName}: ${error}`);
    }
  }

  async readFile(
    torrentDir: FileSystemDirectoryHandle,
    fileName: string
  ): Promise<File | null> {
    try {
      const fileHandle = await torrentDir.getFileHandle(fileName);
      return await fileHandle.getFile();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') {
        return null;
      }
      throw new Error(`Failed to read file ${fileName}: ${error}`);
    }
  }

  async deleteFile(
    torrentDir: FileSystemDirectoryHandle,
    fileName: string
  ): Promise<void> {
    try {
      await torrentDir.removeEntry(fileName);
    } catch (error) {
      console.warn(`Failed to delete file ${fileName}:`, error);
    }
  }

  async deleteTorrentDirectory(infoHash: string): Promise<void> {
    if (!this.torrentsDir) return;

    try {
      await this.torrentsDir.removeEntry(infoHash, { recursive: true });
      console.log(`🗑️ Deleted torrent directory ${infoHash}`);
    } catch (error) {
      console.warn(`Failed to delete torrent directory ${infoHash}:`, error);
    }
  }

  async getStorageEstimate(): Promise<StorageEstimate | null> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      return await navigator.storage.estimate();
    }
    return null;
  }

  async listTorrentFiles(infoHash: string): Promise<string[]> {
    if (!this.torrentsDir) return [];

    try {
      const torrentDir = await this.torrentsDir.getDirectoryHandle(infoHash);
      const files: string[] = [];
      
      for await (const handle of torrentDir.values()) {
        if (handle.kind === 'file') {
          files.push(handle.name);
        }
      }
      
      return files;
    } catch (error) {
      return [];
    }
  }

  async getOPFSContents(): Promise<OPFSFileInfo[]> {
    if (!this.root) return [];

    const contents: OPFSFileInfo[] = [];

    const scanDirectory = async (
      dir: FileSystemDirectoryHandle,
      basePath: string = ''
    ): Promise<void> => {
      try {
        for await (const handle of dir.values()) {
          const path = basePath ? `${basePath}/${handle.name}` : handle.name;
          
          if (handle.kind === 'directory') {
            contents.push({
              name: handle.name,
              size: 0,
              type: 'directory',
              path
            });
            await scanDirectory(handle, path);
          } else {
            try {
              const file = await handle.getFile();
              contents.push({
                name: handle.name,
                size: file.size,
                type: 'file',
                path
              });
            } catch (error) {
              console.warn(`Failed to get file info for ${path}:`, error);
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to scan directory ${basePath}:`, error);
      }
    };

    await scanDirectory(this.root);
    return contents;
  }

  async clearAllOPFS(): Promise<void> {
    if (!this.root) return;

    try {
      // Remove all entries in root
      for await (const handle of this.root.values()) {
        try {
          await this.root.removeEntry(handle.name, { recursive: true });
          console.log(`🗑️ Removed ${handle.name} from OPFS`);
        } catch (error) {
          console.warn(`Failed to remove ${handle.name}:`, error);
        }
      }

      // Reinitialize directories
      this.torrentsDir = await this.root.getDirectoryHandle('torrents', { create: true });
      this.metaDir = await this.root.getDirectoryHandle('torrent-meta', { create: true });
      
      console.log('🧹 OPFS cleared and reinitialized');
    } catch (error) {
      console.error('Failed to clear OPFS:', error);
      throw error;
    }
  }

  async getTorrentFileBlob(infoHash: string, fileName: string): Promise<Blob | null> {
    if (!this.torrentsDir) return null;

    try {
      const torrentDir = await this.torrentsDir.getDirectoryHandle(infoHash);
      const file = await this.readFile(torrentDir, fileName);
      return file;
    } catch (error) {
      console.warn(`Failed to get file blob for ${fileName}:`, error);
      return null;
    }
  }

  isSupported(): boolean {
    return 'storage' in navigator && 'getDirectory' in navigator.storage;
  }
}

export const opfsManager = new OPFSManager();