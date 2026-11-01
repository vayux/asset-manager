import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Components use JSX in .js files, so esbuild is told to parse src/**/*.js as JSX
export default defineConfig({
  plugins: [react({ include: /\.(js|jsx)$/ })],
  esbuild: { loader: 'jsx', include: /src\/.*\.jsx?$/, exclude: [] },
  optimizeDeps: { esbuildOptions: { loader: { '.js': 'jsx' } } },
  server: {
    port: 3000,
    allowedHosts: true,
    proxy: { '/api': 'http://localhost:5001' },
  },
  build: { outDir: 'build' },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js',
    css: false,
  },
});
