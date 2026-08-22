import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    // Deliberately outside the crowded 3000/4000/5000/8000 dev-server ranges so
    // FitHub does not fight other projects for a port. strictPort stays off, so
    // if 7351 is somehow busy Vite steps to the next free one and prints it
    // rather than refusing to boot. Override with `PORT=xxxx npm run dev`.
    port: Number(process.env.PORT) || 7351,
    strictPort: false,
    host: true,
  },
  preview: {
    port: Number(process.env.PORT) || 7352,
    strictPort: false,
    host: true,
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          icons: ['lucide-react'],
        },
      },
    },
  },
});
