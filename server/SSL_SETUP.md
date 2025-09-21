# SSL Certificate Setup Instructions

## Cloudflare Origin Certificate Setup

### Step 1: Download Certificate Files from Cloudflare
1. Go to your Cloudflare dashboard
2. Navigate to SSL/TLS → Origin Server → Origin Certificates
3. Download the certificate for `*.eloi.in, eloi.in`
4. You'll get two files:
   - Certificate file (contains the certificate)
   - Private key file (contains the private key)

### Step 2: Save Certificate Files
Save the downloaded files in the `server/ssl/` directory with these names:
- `mac.eloi.in.pem` - The certificate file
- `mac.eloi.in.key` - The private key file

### Step 3: File Structure
Your ssl directory should look like this:
```
server/
  ssl/
    mac.eloi.in.pem  ← Certificate file from Cloudflare
    mac.eloi.in.key  ← Private key file from Cloudflare
```

### Step 4: Start HTTPS Server
```bash
cd server
node https-server.js
```

### Port Forwarding Configuration
Configure your router with:
- Port 443 → Port 3443 (HTTPS backend)
- Port 3001 → Port 3001 (HTTP backend - fallback)
- Port 80 → Port 5174 (Frontend)

### Access URLs
- Frontend: http://mac.eloi.in/ or https://mac.eloi.in/
- Backend HTTP: http://mac.eloi.in:3001/health
- Backend HTTPS: https://mac.eloi.in:3443/health (after SSL setup)

### Environment Variables
Add to server/.env:
```
SSL_CERT_PATH=./ssl/mac.eloi.in.pem
SSL_KEY_PATH=./ssl/mac.eloi.in.key
HTTPS_PORT=3443
```

### Notes
- Cloudflare Origin Certificates are only valid when traffic goes through Cloudflare
- Make sure your domain is properly configured with Cloudflare's proxy (orange cloud)
- The certificate will automatically work with your `mac.eloi.in` domain