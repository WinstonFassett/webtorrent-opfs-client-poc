import { EventEmitter } from 'events';

// Empty implementation for browser
export class Client extends EventEmitter {
  constructor(opts?: any) {
    super();
  }

  listen(port?: number, onlistening?: () => void): void {
    if (onlistening) onlistening();
  }

  addNode(addr: string | { host: string; port: number }): void {}

  announce(infoHash: string | Buffer, port: number, callback?: (err: Error | null, response?: any) => void): void {
    if (callback) callback(null);
  }

  lookup(infoHash: string | Buffer, callback?: (err: Error | null, response?: any) => void): void {
    if (callback) callback(null);
  }

  destroy(callback?: () => void): void {
    if (callback) callback();
  }
}

export default Client;
