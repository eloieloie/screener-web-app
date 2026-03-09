import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import MemoryStore from 'memorystore';
import { KiteConnect } from 'kiteconnect';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
app.set('trust proxy', 1); // Trust Vite dev proxy — allows req.secure to be true and secure cookies to work
const PORT = process.env.PORT || 3001;

// Session store
const MemoryStoreSession = MemoryStore(session);

// Environment variables
const KITE_API_KEY = process.env.KITE_API_KEY;
const KITE_API_SECRET = process.env.KITE_API_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET || 'local-dev-secret-change-in-production';

// Initialize KiteConnect
let kiteService = null;
if (KITE_API_KEY && KITE_API_SECRET) {
  kiteService = new KiteConnect({
    api_key: KITE_API_KEY,
  });
  console.log('✅ KiteConnect service initialized');
} else {
  console.warn('⚠️ KiteConnect API credentials not found. Set KITE_API_KEY and KITE_API_SECRET in .env file');
}

// Middleware setup
app.use(cors({
  origin: ['http://localhost:5174', 'http://localhost:5173', 'http://localhost:3000', 'http://el-mac.ddns.net', 'https://el-mac.ddns.net', 'https://mac.eloi.in', 'http://mac.eloi.in', 'https://mac.eloi.in:5174', 'http://mac.eloi.in:5174', 'https://mac-scr.eloi.in', 'https://mac-scr.eloi.in:5174', 'https://mac-scr.eloi.in:8443'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // More generous for local development
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Session middleware
app.use(session({
  store: new MemoryStoreSession({
    checkPeriod: 86400000 // prune expired entries every 24h
  }),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true, // Required: cookies must be sent over HTTPS
    httpOnly: true,
    sameSite: 'lax' as const,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

// In-memory token store: access_token → user auth data
// This is the fallback when session cookies don't propagate through the Vite proxy
const tokenStore = new Map(); // access_token -> { user_id, user_name, access_token, authenticated, timestamp }

// Utility function to get instrument token
const instrumentsCache = new Map();
let instrumentsLoaded = false;

async function loadInstruments() {
  if (instrumentsLoaded || !kiteService) return;
  
  try {
    console.log('📡 Loading NSE and BSE instruments...');
    const nseInstruments = await kiteService.getInstruments('NSE');
    const bseInstruments = await kiteService.getInstruments('BSE');
    const allInstruments = [...nseInstruments, ...bseInstruments];
    
    allInstruments.forEach(instrument => {
      if (instrument.instrument_type === 'EQ') {
        instrumentsCache.set(instrument.tradingsymbol, {
          instrument_token: instrument.instrument_token,
          name: instrument.name,
          exchange: instrument.exchange,
        });
      }
    });
    instrumentsLoaded = true;
    console.log(`✅ Loaded ${instrumentsCache.size} instruments (NSE: ${nseInstruments.length}, BSE: ${bseInstruments.length})`);
  } catch (error) {
    console.error('❌ Failed to load instruments:', error);
  }
}

function getInstrumentToken(symbol) {
  const instrument = instrumentsCache.get(symbol);
  return instrument ? instrument.instrument_token : null;
}

// Authentication middleware — checks Bearer token first, then falls back to session cookie
function requireAuth(req, res, next) {
  // 1. Check Authorization: Bearer <access_token> header
  const authHeader = req.headers['authorization'];
  console.log(`[requireAuth] ${req.method} ${req.path} | auth-header=${authHeader ? authHeader.slice(0,20)+'...' : 'NONE'} | session-kite=${!!req.session.kiteAuth} | tokenStore-size=${tokenStore.size}`);
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const tokenData = tokenStore.get(token);
    if (tokenData && tokenData.authenticated) {
      // Fast path: found in tokenStore
      req.kiteAuth = tokenData;
      if (kiteService) kiteService.setAccessToken(tokenData.access_token);
      return next();
    }

    // Slow path: token not in tokenStore (server may have restarted).
    // Validate directly against KiteConnect API — if getProfile succeeds the token is live.
    if (kiteService) {
      kiteService.setAccessToken(token);
      kiteService.getProfile()
        .then((profile) => {
          const authData = {
            access_token: token,
            user_id: profile.user_id,
            user_name: profile.user_name,
            authenticated: true,
            timestamp: new Date().toISOString()
          };
          tokenStore.set(token, authData); // cache for future requests
          req.kiteAuth = authData;
          console.log(`[requireAuth] Token validated via KiteConnect for ${profile.user_name} — added to tokenStore`);
          next();
        })
        .catch(() => {
          // Token is invalid — fall through to session check below
          requireAuthSession(req, res, next);
        });
      return; // async path — don't fall through synchronously
    }
  }

  requireAuthSession(req, res, next);
}

function requireAuthSession(req, res, next) {
  // Fall back to session cookie
  if (!req.session.kiteAuth?.authenticated) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please login with Zerodha first'
    });
  }
  
  if (kiteService && req.session.kiteAuth.access_token) {
    kiteService.setAccessToken(req.session.kiteAuth.access_token);
    req.kiteAuth = req.session.kiteAuth;
  }
  
  next();
}

// Service availability check
function checkService(req, res, next) {
  if (!kiteService) {
    return res.status(500).json({
      error: 'KiteConnect service not available. Check API credentials in .env file.'
    });
  }
  next();
}

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Screener Backend API - Local Server',
    version: '1.0.0',
    status: 'running',
    kiteService: !!kiteService,
    environment: 'local-development',
    endpoints: {
      health: '/health',
      auth: {
        login: '/auth/login',
        session: '/auth/session',
        logout: '/auth/logout',
        status: '/auth/status'
      },
      stocks: {
        quote: '/api/stocks/quote/:symbol',
        multiple: '/api/stocks/multiple',
        top: '/api/stocks/top',
        historical: '/api/stocks/historical/:symbol'
      }
    }
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    server: 'local-backend',
    kiteService: !!kiteService,
    environment: 'local-development'
  });
});

// Auth routes
app.get('/auth/login', checkService, (req, res) => {
  try {
    const loginURL = kiteService.getLoginURL();
    console.log('🔐 Generated login URL for user');
    res.json({
      loginURL,
      message: 'Redirect user to this URL for Zerodha authentication'
    });
  } catch (error) {
    console.error('❌ Error generating login URL:', error);
    res.status(500).json({
      error: 'Failed to generate login URL',
      details: error.message
    });
  }
});

app.post('/auth/session', checkService, async (req, res) => {
  try {
    const { request_token } = req.body;
    
    if (!request_token) {
      return res.status(400).json({
        error: 'request_token is required'
      });
    }

    console.log('🔐 Processing authentication with request token...');
    const sessionData = await kiteService.generateSession(request_token, KITE_API_SECRET);
    
    const authData = {
      access_token: sessionData.access_token,
      public_token: sessionData.public_token,
      user_id: sessionData.user_id,
      user_name: sessionData.user_name,
      authenticated: true,
      timestamp: new Date().toISOString()
    };

    // Store in token map (works even when session cookie doesn't propagate through Vite proxy)
    tokenStore.set(sessionData.access_token, authData);
    console.log(`🔑 Token stored in tokenStore for ${sessionData.user_name}`);

    // Also store in session (belt-and-suspenders)
    req.session.kiteAuth = authData;
    kiteService.setAccessToken(sessionData.access_token);
    
    console.log(`✅ Authentication successful for user: ${sessionData.user_name}`);

    // Explicitly save session before responding
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) { console.warn('⚠️ Session save error:', err); resolve(null); }
        else resolve(null);
      });
    });
    
    res.json({
      success: true,
      message: 'Authentication successful',
      access_token: sessionData.access_token,
      user: {
        user_id: sessionData.user_id,
        user_name: sessionData.user_name,
        user_shortname: sessionData.user_shortname,
        avatar_url: sessionData.avatar_url,
        broker: sessionData.broker
      }
    });
  } catch (error) {
    console.error('❌ Authentication failed:', error);
    res.status(401).json({
      error: 'Authentication failed',
      details: error.message
    });
  }
});

app.get('/auth/status', async (req, res) => {
  // Check Bearer token first
  let userData = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    userData = tokenStore.get(token) || null;

    // Not in tokenStore — validate lazily via KiteConnect (handles server restarts)
    if (!userData && kiteService) {
      try {
        kiteService.setAccessToken(token);
        const profile = await kiteService.getProfile();
        userData = {
          access_token: token,
          user_id: profile.user_id,
          user_name: profile.user_name,
          authenticated: true,
          timestamp: new Date().toISOString()
        };
        tokenStore.set(token, userData);
        console.log(`[auth/status] Token re-validated for ${profile.user_name}`);
      } catch {
        userData = null;
      }
    }
  }
  // Fall back to session
  if (!userData) userData = req.session.kiteAuth || null;
  const isAuthenticated = userData?.authenticated || false;
  
  res.json({
    authenticated: isAuthenticated,
    user: isAuthenticated ? {
      user_id: userData.user_id,
      user_name: userData.user_name,
      timestamp: userData.timestamp
    } : null,
    session_id: req.sessionID
  });
});

app.post('/auth/logout', (req, res) => {
  try {
    // Remove from token store if Bearer token present
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      tokenStore.delete(authHeader.slice(7));
    }
    // Also remove session token
    if (req.session.kiteAuth?.access_token) {
      tokenStore.delete(req.session.kiteAuth.access_token);
    }
    req.session.destroy((err) => {
      if (err) {
        console.error('❌ Error destroying session:', err);
        return res.status(500).json({
          error: 'Failed to logout'
        });
      }
      
      console.log('✅ User logged out successfully');
      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    });
  } catch (error) {
    console.error('❌ Logout error:', error);
    res.status(500).json({
      error: 'Failed to logout'
    });
  }
});

// Stock data routes (same as cloud function)
app.get('/api/stocks/quote/:symbol', requireAuth, checkService, async (req, res) => {
  try {
    const { symbol } = req.params;
    const { exchange } = req.query;
    
    if (!symbol) {
      return res.status(400).json({
        error: 'Symbol parameter is required'
      });
    }

    await loadInstruments();
    
    // Use exchange parameter if provided, otherwise default to NSE
    const exchangePrefix = (exchange && (exchange === 'NSE' || exchange === 'BSE')) ? exchange : 'NSE';
    const cleanSymbol = symbol.replace(/\.(NS|BO|BSE)\.?$/i, '').replace(/^(NSE|BSE):/i, '').toUpperCase();
    const kiteSymbol = `${exchangePrefix}:${cleanSymbol}`;
    
    console.log(`Getting quote for ${symbol} -> ${kiteSymbol}`);
    const quote = await kiteService.getQuote(kiteSymbol);
    const data = quote[kiteSymbol];
    
    if (!data) {
      throw new Error(`No quote data available for ${symbol}`);
    }

    const instrumentToken = getInstrumentToken(symbol.toUpperCase());
    const instrument = instrumentsCache.get(symbol.toUpperCase());
    const marketCap = Math.floor(data.last_price * 1000000);

    const result = {
      id: instrumentToken?.toString() || symbol,
      symbol: cleanSymbol,
      name: instrument?.name || `${cleanSymbol} Limited`,
      price: data.last_price,
      change: data.net_change,
      changePercent: ((data.net_change / data.last_price) * 100),
      volume: data.volume,
      marketCap: `₹${marketCap.toLocaleString()}`,
      exchange: exchangePrefix,
      currency: 'INR',
      previousClose: data.last_price - data.net_change,
      dayHigh: data.ohlc.high,
      dayLow: data.ohlc.low,
      timestamp: new Date().toISOString()
    };
    
    console.log(`📈 Retrieved quote for ${symbol}: ₹${data.last_price}`);
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`❌ Error getting quote for ${req.params.symbol}:`, error);
    res.status(500).json({
      error: 'Failed to get stock quote',
      details: error.message,
      symbol: req.params.symbol
    });
  }
});

app.post('/api/stocks/multiple', requireAuth, checkService, async (req, res) => {
  try {
    const { symbols } = req.body;
    
    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({
        error: 'symbols array is required and cannot be empty'
      });
    }

    if (symbols.length > 100) {
      return res.status(400).json({
        error: 'Maximum 100 symbols allowed per request'
      });
    }

    await loadInstruments();
    
    const nseSymbols = symbols.map(symbol => `NSE:${symbol.toUpperCase()}`);
    const quotes = await kiteService.getQuote(nseSymbols);
    const results = [];
    
    for (const symbol of symbols) {
      const key = `NSE:${symbol.toUpperCase()}`;
      const data = quotes[key];
      
      if (data) {
        const instrumentToken = getInstrumentToken(symbol.toUpperCase());
        const instrument = instrumentsCache.get(symbol.toUpperCase());
        const marketCap = Math.floor(data.last_price * 1000000);
        
        results.push({
          id: instrumentToken?.toString() || symbol,
          symbol: symbol.toUpperCase(),
          name: instrument?.name || `${symbol.toUpperCase()} Limited`,
          price: data.last_price,
          change: data.net_change,
          changePercent: ((data.net_change / data.last_price) * 100),
          volume: data.volume,
          marketCap: `₹${marketCap.toLocaleString()}`,
          exchange: 'NSE',
          currency: 'INR',
          previousClose: data.last_price - data.net_change,
          dayHigh: data.ohlc.high,
          dayLow: data.ohlc.low,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    console.log(`📈 Retrieved quotes for ${results.length}/${symbols.length} symbols`);
    
    res.json({
      success: true,
      data: results,
      count: results.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error getting multiple quotes:', error);
    res.status(500).json({
      error: 'Failed to get multiple quotes',
      details: error.message
    });
  }
});

app.get('/api/stocks/top', requireAuth, checkService, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    
    if (limit < 1 || limit > 100) {
      return res.status(400).json({
        error: 'Limit must be between 1 and 100'
      });
    }

    // Nifty 50 symbols as top stocks
    const nifty50Symbols = [
      'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'HINDUNILVR',
      'ICICIBANK', 'KOTAKBANK', 'SBIN', 'BHARTIARTL', 'ITC',
      'ASIANPAINT', 'LT', 'AXISBANK', 'MARUTI', 'SUNPHARMA',
      'TITAN', 'ULTRACEMCO', 'NESTLEIND', 'WIPRO', 'M&M',
      'NTPC', 'HCLTECH', 'TECHM', 'POWERGRID', 'TATAMOTORS',
      'BAJFINANCE', 'COALINDIA', 'ONGC', 'GRASIM', 'BAJAJFINSV',
      'ADANIPORTS', 'TATASTEEL', 'CIPLA', 'DRREDDY', 'EICHERMOT',
      'IOC', 'HINDALCO', 'BRITANNIA', 'DIVISLAB', 'INDUSINDBK',
      'JSWSTEEL', 'SHREECEM', 'APOLLOHOSP', 'HEROMOTOCO', 'UPL',
      'BAJAJ-AUTO', 'SBILIFE', 'HDFCLIFE', 'BPCL', 'TATACONSUM'
    ];
    
    const topSymbols = nifty50Symbols.slice(0, limit);
    
    // Reuse the multiple quotes logic
    req.body = { symbols: topSymbols };
    return this.handleMultipleQuotes(req, res);
  } catch (error) {
    console.error('❌ Error getting top stocks:', error);
    res.status(500).json({
      error: 'Failed to get top stocks',
      details: error.message
    });
  }
});

app.get('/api/stocks/historical/:symbol', requireAuth, checkService, async (req, res) => {
  try {
    const { symbol } = req.params;
    const { from, to, interval = 'day' } = req.query;
    
    if (!symbol) {
      return res.status(400).json({
        error: 'Symbol parameter is required'
      });
    }

    if (!from || !to) {
      return res.status(400).json({
        error: 'from and to date parameters are required (YYYY-MM-DD format)'
      });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);
    
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.status(400).json({
        error: 'Invalid date format. Use YYYY-MM-DD format'
      });
    }

    if (fromDate >= toDate) {
      return res.status(400).json({
        error: 'from date must be before to date'
      });
    }

    const daysDiff = (toDate - fromDate) / (1000 * 60 * 60 * 24);
    if (daysDiff > 365) {
      return res.status(400).json({
        error: 'Date range cannot exceed 365 days'
      });
    }

    const validIntervals = ['minute', '3minute', '5minute', '10minute', '15minute', '30minute', 'hour', 'day'];
    if (!validIntervals.includes(interval)) {
      return res.status(400).json({
        error: `Invalid interval. Allowed values: ${validIntervals.join(', ')}`
      });
    }

    await loadInstruments();
    
    const instrumentToken = getInstrumentToken(symbol.toUpperCase());
    if (!instrumentToken) {
      throw new Error(`Instrument not found for symbol: ${symbol}`);
    }

    const historical = await kiteService.getHistoricalData(
      instrumentToken,
      interval,
      from,
      to
    );

    const historicalData = historical.map(point => ({
      date: point.date,
      open: point.open,
      high: point.high,
      low: point.low,
      close: point.close,
      volume: point.volume
    }));
    
    console.log(`📊 Retrieved ${historicalData.length} historical data points for ${symbol}`);
    
    res.json({
      success: true,
      data: historicalData,
      count: historicalData.length,
      symbol: symbol.toUpperCase(),
      from,
      to,
      interval,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`❌ Error getting historical data for ${req.params.symbol}:`, error);
    res.status(500).json({
      error: 'Failed to get historical data',
      details: error.message,
      symbol: req.params.symbol
    });
  }
});

app.get('/api/stocks/market-status', requireAuth, checkService, async (req, res) => {
  try {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const timeNow = hour * 100 + minute;
    
    // NSE trading hours: 9:15 AM to 3:30 PM (IST)
    const status = (timeNow >= 915 && timeNow <= 1530) ? 'open' : 'closed';
    
    res.json({
      success: true,
      status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error getting market status:', error);
    res.status(500).json({
      error: 'Failed to get market status',
      details: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err);
  
  res.status(err.status || 500).json({
    error: 'Internal server error',
    details: err.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 Screener Backend Server started');
  console.log(`📍 Server URL: http://localhost:${PORT}`);
  console.log(`🌐 Network URL: http://0.0.0.0:${PORT}`);
  console.log(`🔐 KiteConnect: ${kiteService ? 'Configured' : 'Not configured'}`);
  console.log('');
  console.log('Available endpoints:');
  console.log('  GET  /              - Server info');
  console.log('  GET  /health        - Health check');
  console.log('  GET  /auth/login    - Get login URL');
  console.log('  POST /auth/session  - Create session');
  console.log('  GET  /auth/status   - Check auth status');
  console.log('  POST /auth/logout   - Logout');
  console.log('');
});

export default app;