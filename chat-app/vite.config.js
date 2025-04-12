import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: [
      'uuid',
      'lodash.debounce',
      // Add other problematic dependencies here if needed
    ],
    exclude: [], // You can exclude packages that don't need optimization
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/], // Ensure proper handling of CommonJS modules
    }
  }
})