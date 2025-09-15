# CORS Solutions for Stock Data APIs

## Understanding the CORS Issue

**CORS (Cross-Origin Resource Sharing)** is a browser security feature that blocks requests from one domain to another unless explicitly allowed by the target server.

### What Causes CORS Errors?

1. **Browser Security**: Browsers block requests from `http://localhost:5174` to `https://www.nseindia.com`
2. **Missing Headers**: NSE API doesn't include `Access-Control-Allow-Origin` headers
3. **Different Ports**: AllOrigins proxy was configured for port 5173, but app runs on 5174

## Solutions Implemented

### 1. Development Proxy (Primary Solution)

**File**: `vite.config.ts`

```typescript
server: {
  proxy: {
    // Proxy for Yahoo Finance API
    '/api/yahoo': {
      target: 'https://query1.finance.yahoo.com',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api\/yahoo/, ''),
    },
    // Proxy for NSE API
    '/api/nse': {
      target: 'https://www.nseindia.com',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api\/nse/, ''),
    }
  }
}
```

**How it works**:
- Requests to `/api/yahoo/*` get proxied to Yahoo Finance
- Requests to `/api/nse/*` get proxied to NSE
- Vite server acts as intermediary, avoiding CORS

### 2. Improved CORS Proxies (Fallback)

**Updated proxy list**:
```typescript
const CORS_PROXIES = [
  'https://api.allorigins.win/get?url=',      // Better AllOrigins format
  'https://thingproxy.freeboard.io/fetch/',   // Heroku proxy
  'https://jsonp.afeld.me/?url=',             // JSONProxy
  'https://cors-proxy.htmldriven.com/?url='   // Alternative proxy
];
```

### 3. Better Error Handling

**Enhanced logging**:
- 🔍 Searching for data
- 📡 Trying NSE API
- 🔄 Falling back to Yahoo
- 🚀 Using development proxy
- ✅ Success messages
- ❌ Error details
- 🎭 Using mock data

## How the Fallback System Works

```
1. NSE Official API (when exchange = 'NSE')
   ↓ (if fails due to CORS)
2. Development Proxy (in development mode)
   ↓ (if fails or not available)
3. CORS Proxy Services (multiple attempts)
   ↓ (if all fail)
4. Mock Data (ensures app never breaks)
```

## Testing the Solutions

### Check Development Server
```bash
npm run dev
# Should show: Local: http://localhost:5174/
```

### Test Stock Symbols
1. Try adding "TCS" (NSE)
2. Try adding "RELIANCE" (NSE)
3. Check browser console for detailed logs

### Expected Console Output
```
🔍 Fetching data for TCS (NSE)
📡 Trying NSE API for TCS
🚀 Trying Yahoo Finance with development proxy: /api/yahoo
✅ Successfully fetched data for TCS.NS using development proxy
```

## Production Considerations

### For Production Deployment:
1. **Backend Proxy**: Implement API proxy on your backend server
2. **Serverless Functions**: Use Vercel/Netlify functions as proxy
3. **Third-party APIs**: Consider paid APIs with proper CORS support

### Environment Detection:
```typescript
const isDevelopment = import.meta.env.DEV;
// Uses development proxy only in dev mode
// Falls back to CORS proxies in production
```

## Troubleshooting

### If NSE API Still Fails:
- ✅ Development proxy should work
- ✅ Yahoo Finance fallback available
- ✅ Mock data as last resort

### If Yahoo Finance Fails:
- Check proxy services are online
- Multiple proxies tried automatically
- Mock data ensures app functionality

### Common Issues:
1. **Port Changes**: Vite may use different ports (5173, 5174, etc.)
2. **Proxy Configuration**: Restart dev server after config changes
3. **Network Issues**: Check internet connection for external APIs

## API Data Sources

### NSE Official API
- **URL**: `https://www.nseindia.com/api/quote-equity`
- **Pros**: Official, real-time data
- **Cons**: CORS restrictions, requires cookies

### Yahoo Finance API
- **URL**: `https://query1.finance.yahoo.com/v7/finance/quote`
- **Pros**: Reliable, comprehensive data
- **Cons**: CORS restrictions

### Mock Data
- **Purpose**: Fallback when all APIs fail
- **Includes**: RELIANCE, TCS, INFY, HDFCBANK, ICICIBANK
- **Updates**: Static data for demonstration

## Success Indicators

✅ **Development server starts without errors**
✅ **Stocks load with real data (not mock)**
✅ **Console shows successful API calls**
✅ **No CORS errors in browser console**

If you see mock data, it means all APIs failed but the app is still functional.