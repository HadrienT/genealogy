import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/genealogy/',
  server: {
    // Bind IPv4 explicitly: by default Vite may listen on [::1] only, which
    // VS Code remote port forwarding (127.0.0.1) cannot reach.
    host: '127.0.0.1',
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
