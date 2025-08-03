/**
 * OPFS (Origin Private File System) utilities for WebTorrent
 * Provides persistent file storage in the browser
 */

export class OPFSManager {
  private root: FileSystemDirectoryHandle | null = null;
  private torrentsDir: FileSystemDirectoryHandle | null = null;

  async initialize(): Promise<void> {
    if (!('storage' in navigator) || !('getDirectory' in navigator.storage)) {
      throw new Error('OPFS is not supported in this browser');
    }

    try {
      this.root = await navigator.storage.getDirectory();
      this.torrentsDir = await this.root.getDirectoryHandle('torrents', { create: true });
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
      
      for await (const [name, handle] of torrentDir.entries()) {
        if (handle.kind === 'file') {
          files.push(name);
        }
      }
      
      console.log(`OPFS: Found ${files.length} files in torrent ${infoHash}:`, files);
      return files;
    } catch (error) {
      console.log(`OPFS: No files found for torrent ${infoHash}:`, error);
      return [];
    }
  }

  isSupported(): boolean {
    return 'storage' in navigator && 'getDirectory' in navigator.storage;
  }
}

export const opfsManager = new OPFSManager();