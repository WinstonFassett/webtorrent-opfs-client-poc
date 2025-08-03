import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: [
        'buffer',
        'process',
        'stream',
        'path',
        'events',
        'string_decoder',
        'crypto',
        'assert',
        'util',
        'os',
      ],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      protocolImports: true,
    }),
  ],
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      'bittorrent-dht': path.resolve(__dirname, 'src/stubs/bittorrent-dht.ts'),
    },
  },
});
