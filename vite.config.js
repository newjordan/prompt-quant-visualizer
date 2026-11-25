import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

const projectRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: 'public',
  base: './',
  publicDir: false,
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2022',
    cssCodeSplit: false,
    chunkSizeWarningLimit: 800,
  },
  plugins: [
    {
      name: 'copy-demo-session',
      closeBundle() {
        const distDir = resolve(projectRoot, 'dist');
        mkdirSync(distDir, { recursive: true });
        copyFileSync(resolve(projectRoot, 'public/demo-session.jsonl'), resolve(distDir, 'demo-session.jsonl'));
      },
    },
  ],
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
