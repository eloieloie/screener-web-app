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
  origin: ['http://localhost:5174', 'http://localhost:5173', 'http://localhost:3000', 'http://el-mac.ddns.net', 'https://el-mac.ddns.net', 'https://mac.eloi.in', 'http://mac.eloi.in'],
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
  if (!req.session || !req.session.kite_session) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }
  
  // Set access token for KiteConnect
  if (kiteService) {
    kiteService.setAccessToken(req.session.kite_session.access_token);
  }
  next();
};

// Helper function to convert symbol format
const convertSymbolFormat = (symbol) => {
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
    const kiteSymbol = convertSymbolFormat(symbol);
    console.log(`Converting symbol: ${symbol} -> ${kiteSymbol}`);
    const quote = await kiteService.getQuote([kiteSymbol]);
    
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
      res.status(404).json({
        success: false,
        message: `Quote not found for symbol: ${symbol}`
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