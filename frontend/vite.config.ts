import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: true
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/jspdf') || id.includes('node_modules/jspdf-autotable')) {
            return 'pdf-lib';
          }
          if (id.includes('node_modules/jszip')) {
            return 'zip-lib';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'icons-lib';
          }
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) {
            return 'react-core';
          }
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
})
