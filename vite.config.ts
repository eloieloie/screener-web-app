import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Check if SSL certificates exist in ssl directory
const certPath = path.resolve('./ssl/mac.eloi.in.pem')
const keyPath = path.resolve('./ssl/mac.eloi.in.key')

const httpsConfig = fs.existsSync(certPath) && fs.existsSync(keyPath) ? {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath)
} : undefined

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Allow external connections
    port: 5174, // Ensure consistent port
    strictPort: true, // Fail if port is occupied
    https: httpsConfig, // Enable HTTPS if certificates are available
    allowedHosts: ['mac.eloi.in', 'el-mac.ddns.net', 'localhost', '127.0.0.1'], // Allow external domain access
    hmr: {
      port: 5174, // Keep HMR on the same port for port forwarding
      clientPort: 443 // Tell client to connect via port 443 (HTTPS port)
    },
    proxy: {
      // Proxy API requests to our backend server
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        timeout: 30000,
        headers: {
          'Accept': 'application/json'
        }
      }
    }
  }
})
