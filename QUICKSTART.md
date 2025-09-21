# 🚀 Quick Start Guide - Backend Server

## Prerequisites
- Node.js 18+ installed
- Zerodha Developer account with KiteConnect app

## Setup (5 minutes)

### 1. Get Zerodha API Credentials
1. Visit [Kite Connect Developer Console](https://developers.kite.trade/)
2. Create new app:
   - Name: "Screener Web App"  
   - Type: "Connect"
   - Redirect URL: `http://localhost:5173/`
3. Note your `api_key` and `api_secret`

### 2. Backend Setup
```bash
# Navigate to backend
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

### 3. Configure Environment
Edit `.env` file:
```env
KITE_API_KEY=your_api_key_here
KITE_API_SECRET=your_api_secret_here
SESSION_SECRET=change_this_secure_random_string
```

### 4. Start Backend
```bash
# Using the startup script (recommended)
./start.sh

# OR manually
npm run dev
```

Backend runs on: `http://localhost:3001`

### 5. Update Frontend
Create `.env` in root directory:
```env
VITE_BACKEND_URL=http://localhost:3001
```

### 6. Start Frontend
```bash
# In root directory
npm run dev
```

Frontend runs on: `http://localhost:5173`

## ✅ Test Everything

1. **Health Check**: Visit `http://localhost:3001/health`
2. **Frontend**: Visit `http://localhost:5173`
3. **Authentication**: Click "Login to Zerodha Kite" button
4. **Live Data**: After login, stock data should load from real API

## 🎯 What's Fixed

- ✅ **No more CORS errors**
- ✅ **Real Zerodha API integration**
- ✅ **No demo data** - all live market data
- ✅ **Secure authentication flow**
- ✅ **Production-ready architecture**

## 🛠 Troubleshooting

**Backend won't start?**
- Check if API credentials are set in `.env`
- Ensure port 3001 is available

**Frontend can't connect?**
- Verify `VITE_BACKEND_URL=http://localhost:3001` in frontend `.env`
- Check if backend is running

**Authentication fails?**
- Verify API credentials in Zerodha console
- Check redirect URL matches exactly

## 📚 Full Documentation

- Backend: `backend/README.md`
- Deployment: See backend README for production setup
- API Reference: Visit `http://localhost:3001/` when running