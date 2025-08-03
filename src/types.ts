export interface TorrentFile {
  name: string;
  length: number;
  path: string;
}

export interface TorrentInfo {
  infoHash: string;
  name: string;
  length: number;
  files: TorrentFile[];
  magnetURI: string;
  progress: number;
  downloaded: number;
  uploaded: number;
  downloadSpeed: number;
  uploadSpeed: number;
  numPeers: number;
  ratio: number;
  timeRemaining: number;
  status: 'downloading' | 'seeding' | 'paused' | 'error' | 'completed' | 'stalled';
  paused: boolean;
}