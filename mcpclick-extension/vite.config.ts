import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json' with { type: 'json' };

export default defineConfig({
  plugins: [crx({ manifest })],
  server: {
    port: 5174,
    strictPort: true,
    hmr: {
      host: 'localhost',
      port: 5174,
    },
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        chunkFileNames: 'assets/[name].js',
        entryFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
});
