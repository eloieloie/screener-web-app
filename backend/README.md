# Backend Server Setup Guide

This guide explains how to set up and deploy the backend server for the Screener Web App, which handles Zerodha KiteConnect API calls and resolves CORS restrictions.

## 📋 Prerequisites

Before setting up the backend, ensure you have:

1. **Node.js** (v18 or higher) installed
2. **Zerodha Developer Account** with KiteConnect app credentials
3. **npm** or **yarn** package manager
4. **Git** for version control

## 🔑 Getting Zerodha API Credentials

1. **Create Zerodha Account**: Sign up at [Zerodha](https://zerodha.com)
2. **Developer Console**: Visit [Kite Connect Developer Console](https://developers.kite.trade/)
3. **Create App**: Click "Create new app" and fill in details:
   - App name: "Screener Web App"
   - App type: "Connect"
   - Redirect URL: `http://localhost:5173/` (for development)
4. **Get Credentials**: Note down your `api_key` and `api_secret`

## 🛠 Backend Installation

### Step 1: Navigate to Backend Directory

```bash
cd backend
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` file with your credentials:

```env
# Zerodha KiteConnect API Credentials
KITE_API_KEY=your_api_key_from_zerodha_console
KITE_API_SECRET=your_api_secret_from_zerodha_console

# Server Configuration
PORT=3001
NODE_ENV=development

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173

# Session Configuration  
SESSION_SECRET=your_very_secure_session_secret_here_change_this_in_production

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Step 4: Start Development Server

```bash
npm run dev
```

The backend server will start on `http://localhost:3001`

## 🌐 Frontend Configuration

Update your frontend to use the backend server by creating/updating `.env` in the root directory:

```env
# Backend URL for API calls
VITE_BACKEND_URL=http://localhost:3001
```

## 🚀 API Endpoints

### Authentication Endpoints

- `GET /auth/login` - Get Zerodha login URL
- `POST /auth/session` - Complete authentication with request token
- `GET /auth/status` - Check authentication status
- `POST /auth/logout` - Logout user

### Stock Data Endpoints

- `GET /api/stocks/quote/:symbol` - Get quote for single stock
- `POST /api/stocks/multiple` - Get quotes for multiple stocks
- `GET /api/stocks/top` - Get top traded stocks
- `GET /api/stocks/historical/:symbol` - Get historical data
- `GET /api/stocks/market-status` - Get market status
- `GET /api/stocks/profile` - Get user profile

### Utility Endpoints

- `GET /health` - Health check
- `GET /` - API documentation

## 🔐 Authentication Flow

1. **Frontend requests login URL** from `/auth/login`
2. **User redirects to Zerodha** for authentication
3. **Zerodha redirects back** with `request_token`
4. **Frontend sends token** to `/auth/session`
5. **Backend completes authentication** and stores session
6. **Subsequent API calls** use session cookies

## 📊 Production Deployment

### Option 1: Traditional VPS/Server

1. **Server Setup**:
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2
```

2. **Deploy Application**:
```bash
# Clone repository
git clone <your-repo-url>
cd screener-web-app/backend

# Install dependencies
npm install --production

# Set up environment
cp .env.example .env
# Edit .env with production values

# Start with PM2
pm2 start src/server.js --name "screener-backend"
pm2 startup
pm2 save
```

3. **Nginx Configuration**:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Option 2: Docker Deployment

1. **Create Dockerfile** in backend directory:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY src/ ./src/

EXPOSE 3001

CMD ["node", "src/server.js"]
```

2. **Build and Run**:
```bash
# Build image
docker build -t screener-backend .

# Run container
docker run -d \
  --name screener-backend \
  -p 3001:3001 \
  --env-file .env \
  screener-backend
```

### Option 3: Cloud Platforms

#### Heroku
```bash
# Install Heroku CLI
# Login to Heroku
heroku login

# Create app
heroku create screener-backend

# Set environment variables
heroku config:set KITE_API_KEY=your_key
heroku config:set KITE_API_SECRET=your_secret
heroku config:set SESSION_SECRET=your_session_secret
heroku config:set NODE_ENV=production

# Deploy
git push heroku main
```

#### Railway
1. Connect GitHub repository to Railway
2. Set environment variables in Railway dashboard
3. Deploy automatically on git push

#### DigitalOcean App Platform
1. Create new app from GitHub repository
2. Select backend folder as source
3. Configure environment variables
4. Deploy

## 🔧 Configuration Options

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `KITE_API_KEY` | Yes | - | Zerodha API key |
| `KITE_API_SECRET` | Yes | - | Zerodha API secret |
| `PORT` | No | 3001 | Server port |
| `NODE_ENV` | No | development | Environment |
| `FRONTEND_URL` | No | http://localhost:5173 | Frontend URL for CORS |
| `SESSION_SECRET` | Yes | - | Session encryption secret |
| `RATE_LIMIT_WINDOW_MS` | No | 900000 | Rate limit window (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | No | 100 | Max requests per window |

### Security Considerations

1. **Environment Variables**: Never commit `.env` files
2. **Session Secret**: Use strong, unique session secrets
3. **HTTPS**: Use SSL/TLS in production
4. **Rate Limiting**: Configured to prevent abuse
5. **CORS**: Properly configured for your domain
6. **Headers**: Security headers enabled via Helmet

## 🐛 Troubleshooting

### Common Issues

1. **"KiteConnect service not available"**
   - Check API credentials in `.env`
   - Ensure KITE_API_KEY and KITE_API_SECRET are set

2. **CORS Errors**
   - Verify FRONTEND_URL in backend `.env`
   - Check if backend server is running

3. **Authentication Fails**
   - Verify API credentials are correct
   - Check Zerodha console for app status
   - Ensure redirect URL matches

4. **Rate Limiting**
   - Adjust RATE_LIMIT_MAX_REQUESTS if needed
   - Check logs for rate limit errors

### Logging

Enable detailed logging:
```bash
DEBUG=* npm run dev
```

### Health Check

Check if backend is running:
```bash
curl http://localhost:3001/health
```

## 📝 Development

### Project Structure
```
backend/
├── src/
│   ├── server.js          # Main server file
│   ├── routes/
│   │   ├── auth.js        # Authentication routes
│   │   └── stocks.js      # Stock data routes
│   └── services/
│       └── kiteConnectService.js  # KiteConnect wrapper
├── package.json
├── .env.example
└── README.md
```

### Adding New Endpoints

1. Create route handler in appropriate file
2. Add authentication middleware if needed
3. Update this documentation
4. Test thoroughly

### Database Integration (Optional)

For storing user data:
```bash
npm install mongoose  # for MongoDB
# or
npm install pg        # for PostgreSQL
```

## 🔄 Updates and Maintenance

1. **Regular Updates**:
   ```bash
   npm update
   npm audit fix
   ```

2. **Monitoring**: Use PM2 or similar for process monitoring
3. **Logs**: Set up log rotation and monitoring
4. **Backups**: Regular backups if using database
5. **Security**: Regular security updates

## 📞 Support

For issues and questions:
1. Check this documentation first
2. Review backend logs: `pm2 logs screener-backend`
3. Check frontend console for errors
4. Verify Zerodha API status

## 🎯 Next Steps

After successful setup:
1. Test authentication flow
2. Verify stock data retrieval
3. Set up monitoring and alerts
4. Configure SSL certificate
5. Set up automated backups
6. Plan scaling strategy