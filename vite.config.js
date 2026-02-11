import { defineConfig } from 'vite';

export default defineConfig({
  root: 'public',
  base: './',
  publicDir: false,
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    open: true,
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
