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
    open: '/token-demo.html',
    fs: {
      // Allow serving WASM from pkg/ and source from src/
      allow: ['..'],
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  // Ensure .wasm files are served correctly
  assetsInclude: ['**/*.wasm'],
});
