export const formatBytes = (bytes: number): string => {
  if (typeof bytes !== 'number' || isNaN(bytes)) return '0 B';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export const formatSpeed = (bytesPerSecond: number): string => {
  if (typeof bytesPerSecond !== 'number' || isNaN(bytesPerSecond)) return '0 B/s';
  return `${formatBytes(bytesPerSecond)}/s`;
};

export const formatTime = (seconds: number): string => {
  if (typeof seconds !== 'number' || isNaN(seconds)) return '∞';
  if (seconds === Infinity || seconds <= 0) return '∞';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
};