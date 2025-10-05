import express from 'express';
import https from 'https';
import fs from 'fs';
import path from 'path';
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
const PORT = process.env.PORT || 3001;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

// Session store
const MemoryStoreSession = MemoryStore(session);

// Environment variables
const KITE_API_KEY = process.env.KITE_API_KEY;
const KITE_API_SECRET = process.env.KITE_API_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET || 'local-dev-secret-change-in-production';

// SSL Certificate paths
const SSL_CERT_PATH = process.env.SSL_CERT_PATH || './ssl/mac.eloi.in.pem';
const SSL_KEY_PATH = process.env.SSL_KEY_PATH || './ssl/mac.eloi.in.key';

// Initialize KiteConnect
let kiteService = null;
if (KITE_API_KEY && KITE_API_SECRET) {
  kiteService = new KiteConnect({
    api_key: KITE_API_KEY,
  });
  console.log('✅ KiteConnect service initialized');
} else {
  console.log('⚠️ KiteConnect credentials not found. Add KITE_API_KEY and KITE_API_SECRET to .env file');
}

// Middleware setup
app.use(cors({
  origin: ['http://localhost:5174', 'http://localhost:5173', 'http://localhost:3000', 'http://el-mac.ddns.net', 'https://el-mac.ddns.net', 'https://mac.eloi.in', 'http://mac.eloi.in', 'https://mac.eloi.in:5174', 'http://mac.eloi.in:5174'],
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
    secure: true, // Always use secure cookies for HTTPS domains
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax' // Allow cross-site requests for OAuth redirects
  },
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    server: 'local-backend-https',
    kiteService: !!kiteService,
    environment: process.env.NODE_ENV || 'local-development',
    ssl: 'enabled'
  });
});

// Auth routes
app.get('/auth/login', async (req, res) => {
  try {
    if (!kiteService) {
      return res.status(503).json({
        success: false,
        message: 'KiteConnect service not available. Please check server configuration.'
      });
    }

    const loginURL = kiteService.getLoginURL();
    res.json({
      success: true,
      loginURL: loginURL,
      message: 'Login URL generated successfully'
    });
  } catch (error) {
    console.error('Login URL generation failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate login URL',
      error: error.message
    });
  }
});

app.post('/auth/session', async (req, res) => {
  try {
    if (!kiteService) {
      return res.status(503).json({
        success: false,
        message: 'KiteConnect service not available'
      });
    }

    const { request_token } = req.body;
    if (!request_token) {
      return res.status(400).json({
        success: false,
        message: 'Request token is required'
      });
    }

    const response = await kiteService.generateSession(request_token, KITE_API_SECRET);
    
    // Store session data
    req.session.kite_session = {
      access_token: response.access_token,
      user_id: response.user_id,
      user_name: response.user_name,
      user_shortname: response.user_shortname,
      avatar_url: response.avatar_url,
      broker: response.broker
    };

    res.json({
      success: true,
      message: 'Authentication successful',
      user: {
        user_id: response.user_id,
        user_name: response.user_name,
        user_shortname: response.user_shortname,
        avatar_url: response.avatar_url,
        broker: response.broker
      }
    });
  } catch (error) {
    console.error('Session generation failed:', error);
    res.status(401).json({
      success: false,
      message: 'Authentication failed',
      error: error.message
    });
  }
});

app.get('/auth/status', (req, res) => {
  const isAuthenticated = !!(req.session && req.session.kite_session);
  res.json({
    authenticated: isAuthenticated,
    user: isAuthenticated ? {
      user_id: req.session.kite_session.user_id,
      user_name: req.session.kite_session.user_name,
      user_shortname: req.session.kite_session.user_shortname,
      avatar_url: req.session.kite_session.avatar_url,
      broker: req.session.kite_session.broker
    } : null,
    session_id: req.sessionID
  });
});

app.post('/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({
        success: false,
        message: 'Logout failed'
      });
    }
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  });
});

// Middleware to check authentication
const requireAuth = (req, res, next) => {
  console.log(`🔐 [AUTH] ${req.method} ${req.originalUrl} - Session: ${!!req.session} - KiteSession: ${!!req.session?.kite_session}`);
  
  if (!req.session || !req.session.kite_session) {
    console.log(`❌ [AUTH] Authentication required for ${req.originalUrl}`);
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }
  
  console.log(`✅ [AUTH] User authenticated: ${req.session.kite_session.user_name}`);
  
  // Set access token for KiteConnect
  if (kiteService) {
    kiteService.setAccessToken(req.session.kite_session.access_token);
  }
  next();
};

// Helper function to convert symbol format
const convertSymbolFormat = (symbol, exchange = null) => {
  // If exchange is explicitly provided, use it
  if (exchange && (exchange === 'NSE' || exchange === 'BSE')) {
    // Clean the symbol first
    const cleanSymbol = symbol.replace(/\.(NS|BO|BSE)\.?$/i, '').replace(/^(NSE|BSE):/i, '');
    return `${exchange}:${cleanSymbol}`;
  }
  
  // Convert from Yahoo Finance format (TCS.NS) to KiteConnect format (NSE:TCS)
  if (symbol.endsWith('.NS')) {
    return `NSE:${symbol.replace('.NS', '')}`;
  } else if (symbol.endsWith('.BO')) {
    return `BSE:${symbol.replace('.BO', '')}`;
  }
  // If no suffix, assume NSE
  return `NSE:${symbol}`;
};

// Stock API routes
app.get('/api/stocks/quote/:symbol', requireAuth, async (req, res) => {
  try {
    const { symbol } = req.params;
    const { exchange } = req.query; // Get exchange from query parameter
    const kiteSymbol = convertSymbolFormat(symbol, exchange);
    console.log(`Converting symbol: ${symbol} (${exchange || 'auto'}) -> ${kiteSymbol}`);
    const quote = await kiteService.getQuote([kiteSymbol]);
    console.log(`Quote response for ${kiteSymbol}:`, quote ? Object.keys(quote) : 'null/undefined');
    
    if (quote && quote[kiteSymbol]) {
      const stockData = quote[kiteSymbol];
      res.json({
        success: true,
        data: {
          symbol: symbol, // Return original symbol format
          name: stockData.instrument_token ? `Stock ${symbol}` : symbol,
          price: stockData.last_price,
          change: stockData.net_change || 0,
          changePercent: stockData.net_change && stockData.last_price 
            ? parseFloat(((stockData.net_change / (stockData.last_price - stockData.net_change)) * 100).toFixed(2))
            : 0,
          volume: stockData.volume || 0,
          high: stockData.ohlc?.high || stockData.last_price,
          low: stockData.ohlc?.low || stockData.last_price,
          open: stockData.ohlc?.open || stockData.last_price,
          previousClose: stockData.ohlc?.close || stockData.last_price
        },
        timestamp: new Date().toISOString()
      });
    } else {
      console.log(`No quote data found for ${kiteSymbol}`);
      res.status(404).json({
        success: false,
        message: `Quote not found for symbol: ${symbol} on ${exchange || 'NSE'}`,
        details: {
          requestedSymbol: symbol,
          exchange: exchange || 'NSE',
          kiteSymbol: kiteSymbol,
          note: exchange === 'BSE' ? 'BSE stocks may have limited availability in KiteConnect API' : 'Verify the symbol exists on the specified exchange'
        }
      });
    }
  } catch (error) {
    console.error(`Error getting quote for ${req.params.symbol}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to get stock quote',
      error: error.message
    });
  }
});

// Search BSE stocks endpoint
app.get('/api/search/bse', requireAuth, async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;
    
    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Query parameter "q" is required'
      });
    }
    
    // Load instruments if not cached
    if (!instrumentsCache || !instrumentsCacheTime || Date.now() - instrumentsCacheTime > CACHE_DURATION) {
      console.log('🔍 [BSE_SEARCH] Loading instruments...');
      try {
        const nseInstruments = await kiteService.getInstruments(['NSE']);
        const bseInstruments = await kiteService.getInstruments(['BSE']);
        instrumentsCache = [...nseInstruments, ...bseInstruments];
        instrumentsCacheTime = Date.now();
        console.log(`✅ [BSE_SEARCH] Loaded ${instrumentsCache.length} instruments`);
      } catch (error) {
        console.error(`❌ [BSE_SEARCH] Failed to load instruments:`, error.message);
        return res.status(500).json({
          success: false,
          message: 'Failed to load instrument data',
          error: error.message
        });
      }
    }

    const bseInstruments = instrumentsCache.filter(inst => inst.exchange === 'BSE');
    const searchTerm = q.toLowerCase();
    
    const matches = bseInstruments
      .filter(inst => 
        inst.tradingsymbol.toLowerCase().includes(searchTerm) ||
        inst.name.toLowerCase().includes(searchTerm) ||
        inst.instrument_token.toString().includes(searchTerm)
      )
      .slice(0, parseInt(limit))
      .map(inst => ({
        symbol: inst.tradingsymbol,
        name: inst.name,
        token: inst.instrument_token,
        exchange: inst.exchange,
        segment: inst.segment,
        instrument_type: inst.instrument_type
      }));
    
    res.json({
      success: true,
      query: q,
      total_bse_instruments: bseInstruments.length,
      matches: matches.length,
      results: matches
    });
    
  } catch (error) {
    console.error('Error searching BSE stocks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search BSE stocks',
      error: error.message
    });
  }
});

// Cache for instruments list
let instrumentsCache = null;
let instrumentsCacheTime = null;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Helper function to get instrument token from symbol
const getInstrumentToken = async (symbol) => {
  console.log(`🔍 [INSTRUMENT] Looking up token for: ${symbol}`);
  try {
    // Check if cache is valid
    if (!instrumentsCache || !instrumentsCacheTime || Date.now() - instrumentsCacheTime > CACHE_DURATION) {
      console.log('🔍 [INSTRUMENT] Fetching fresh instruments list...');
      console.log('🔍 [INSTRUMENT] KiteService status:', !!kiteService);
      console.log('🔍 [INSTRUMENT] KiteService session active:', kiteService?.kite?.session_expiry_hook || 'No session info');
      
      try {
        // Try different approaches for getting instruments
        console.log('🔍 [INSTRUMENT] Attempting getInstruments() call...');
        const nseInstruments = await kiteService.getInstruments(['NSE']);
        const bseInstruments = await kiteService.getInstruments(['BSE']);
        instrumentsCache = [...nseInstruments, ...bseInstruments];
        instrumentsCacheTime = Date.now();
        console.log(`✅ [INSTRUMENT] Successfully cached ${instrumentsCache.length} instruments (NSE: ${nseInstruments.length}, BSE: ${bseInstruments.length})`);
      } catch (instrumentError) {
        console.error(`❌ [INSTRUMENT] getInstruments() failed:`, instrumentError.message);
        console.error(`❌ [INSTRUMENT] Error details:`, instrumentError);
        
        // Fallback: try hardcoded instrument tokens for common stocks
        console.log('🔍 [INSTRUMENT] Using fallback hardcoded tokens...');
        const fallbackTokens = {
          'INFY': '408065',
          'TCS': '2953217', 
          'RELIANCE': '738561',
          'HDFCBANK': '341249',
          'ICICIBANK': '1270529',
          'SBIN': '779521',
          'ITC': '424961',
          'HINDUNILVR': '356865',
          'LT': '2939649',
          'ASIANPAINT': '60417'
        };
        
        const searchSymbol = symbol.replace('.NS', '').replace('.BO', '');
        const token = fallbackTokens[searchSymbol];
        if (token) {
          console.log(`✅ [INSTRUMENT] Using fallback token: ${token} for ${searchSymbol}`);
          return token;
        }
        
        return null;
      }
    }

    // Convert symbol format for searching
    const searchSymbol = symbol.replace('.NS', '').replace('.BO', '');
    console.log(`🔍 [INSTRUMENT] Searching for: ${searchSymbol}`);
    
    // Find instrument by trading symbol
    const instrument = instrumentsCache.find(inst => 
      inst.tradingsymbol === searchSymbol && 
      (inst.exchange === 'NSE' || inst.exchange === 'BSE')
    );

    if (instrument) {
      console.log(`✅ [INSTRUMENT] Found token: ${instrument.instrument_token} for ${searchSymbol}`);
      return instrument.instrument_token;
    }
    
    console.log(`❌ [INSTRUMENT] No token found for: ${symbol}`);
    return null;
  } catch (error) {
    console.error(`❌ [INSTRUMENT] Unexpected error:`, error.message);
    console.error(`❌ [INSTRUMENT] Error stack:`, error.stack);
    return null;
  }
};

// Historical data endpoint
app.get('/api/stocks/historical/:symbol', requireAuth, async (req, res) => {
  console.log(`\n📊 [HISTORICAL] ===== REQUEST START =====`);
  console.log(`📊 [HISTORICAL] Symbol: ${req.params.symbol}`);
  console.log(`📊 [HISTORICAL] Query:`, req.query);
  console.log(`📊 [HISTORICAL] User:`, req.session.user?.user_name);
  
  try {
    const { symbol } = req.params;
    const { from, to, interval = 'day' } = req.query;

    if (!from || !to) {
      console.log(`❌ [HISTORICAL] Missing required parameters`);
      return res.status(400).json({
        success: false,
        message: 'from and to date parameters are required (YYYY-MM-DD format)'
      });
    }

    console.log(`📊 [HISTORICAL] Getting instrument token...`);
    const instrumentToken = await getInstrumentToken(symbol);
    
    if (!instrumentToken) {
      console.log(`❌ [HISTORICAL] No instrument token found - returning error`);
      return res.status(404).json({
        success: false,
        message: `Instrument token not found for symbol: ${symbol}. This may be due to KiteConnect API permissions or the symbol not being available.`
      });
    }

    console.log(`📊 [HISTORICAL] Using instrument token: ${instrumentToken}`);
    console.log(`📊 [HISTORICAL] Calling KiteConnect getHistoricalData...`);
    console.log(`📊 [HISTORICAL] Parameters: token=${instrumentToken}, interval=${interval}, from=${from}, to=${to}`);
    
    const historicalData = await kiteService.getHistoricalData(
      instrumentToken,
      interval,
      from,
      to
    );

    console.log(`📊 [HISTORICAL] Raw response type:`, typeof historicalData);
    console.log(`📊 [HISTORICAL] Raw response:`, historicalData);
    console.log(`📊 [HISTORICAL] Response: ${historicalData?.length || 0} records`);

    if (historicalData && historicalData.length > 0) {
      console.log(`✅ [HISTORICAL] Success - returning ${historicalData.length} records`);
      console.log(`📊 [HISTORICAL] ===== REQUEST END =====\n`);
      
      res.json({
        success: true,
        data: historicalData.map(candle => ({
          date: candle.date,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume
        })),
        metadata: {
          symbol: symbol,
          interval: interval,
          from: from,
          to: to,
          count: historicalData.length
        },
        timestamp: new Date().toISOString()
      });
    } else {
      console.log(`⚠️ [HISTORICAL] No data returned`);
      console.log(`📊 [HISTORICAL] ===== REQUEST END =====\n`);
      
      res.status(404).json({
        success: false,
        message: `No historical data found for symbol: ${symbol}`,
        metadata: {
          symbol: symbol,
          interval: interval,
          from: from,
          to: to
        }
      });
    }
  } catch (error) {
    console.error(`❌ [HISTORICAL] Error:`, error.message);
    console.log(`📊 [HISTORICAL] ===== REQUEST END WITH ERROR =====\n`);
    
    res.status(500).json({
      success: false,
      message: 'Failed to get historical data',
      error: error.message,
      details: {
        symbol: req.params.symbol,
        from: req.query.from,
        to: req.query.to,
        interval: req.query.interval
      }
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Function to start HTTP server
function startHTTPServer() {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 HTTP Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🌐 External access: http://mac.eloi.in:${PORT}/health`);
  });
}

// Function to start HTTPS server
function startHTTPSServer() {
  try {
    // Check if SSL certificates exist
    if (!fs.existsSync(SSL_CERT_PATH) || !fs.existsSync(SSL_KEY_PATH)) {
      console.log('⚠️ SSL certificates not found. Please place them in:');
      console.log(`   Certificate: ${path.resolve(SSL_CERT_PATH)}`);
      console.log(`   Private Key: ${path.resolve(SSL_KEY_PATH)}`);
      console.log('📡 Starting HTTP server only...');
      startHTTPServer();
      return;
    }

    const options = {
      key: fs.readFileSync(SSL_KEY_PATH),
      cert: fs.readFileSync(SSL_CERT_PATH)
    };

    // Start HTTPS server
    https.createServer(options, app).listen(HTTPS_PORT, '0.0.0.0', () => {
      console.log(`🔒 HTTPS Server running on port ${HTTPS_PORT}`);
      console.log(`📊 Health check: https://localhost:${HTTPS_PORT}/health`);
      console.log(`🌐 External access: https://mac.eloi.in:${HTTPS_PORT}/health`);
    });

    // Also start HTTP server for backward compatibility
    startHTTPServer();

  } catch (error) {
    console.error('❌ Failed to start HTTPS server:', error.message);
    console.log('📡 Starting HTTP server only...');
    startHTTPServer();
  }
}

// Start the server
startHTTPSServer();