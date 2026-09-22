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
    port: 5275, // Ensure consistent port
    strictPort: true, // Fail if port is occupied
    https: httpsConfig, // Enable HTTPS if certificates are available
    allowedHosts: ['mac-scr.eloi.in', 'mac.eloi.in', 'el-mac.ddns.net', 'localhost', '127.0.0.1'], // Allow external domain access
    hmr: {
      port: 5275,
      clientPort: 8443 // HMR WebSocket uses port 8443 externally (router forwards 8443 → 5275)
    },
    proxy: {
      // Order placement/cancel must go through the local server — Kite requires
      // a whitelistable static IP for these endpoints, and Cloud Functions'
      // egress IP is unstable. Must come before '/api' so it matches first.
      '/api/orders': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        timeout: 30000,
        headers: {
          'Accept': 'application/json'
        }
      },
      // Proxy remaining API requests to the live production backend (Firebase Function)
      '/api': {
        target: 'https://api-gx4qle7k5q-uc.a.run.app',
        changeOrigin: true,
        timeout: 30000,
        headers: {
          'Accept': 'application/json'
        }
      },
      // Proxy auth requests to the live production backend (Firebase Function)
      '/auth': {
        target: 'https://api-gx4qle7k5q-uc.a.run.app',
        changeOrigin: true,
        timeout: 30000,
        headers: {
          'Accept': 'application/json'
        }
      }
    }
  }
})
