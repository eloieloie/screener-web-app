import express from 'express';
import KiteConnectService from '../services/kiteConnectService.js';
import { requireAuth } from './auth.js';

const router = express.Router();
let kiteService;

// Initialize KiteConnect service
try {
  kiteService = new KiteConnectService();
} catch (error) {
  console.error('Failed to initialize KiteConnect service for stocks:', error.message);
}

/**
 * Middleware to check service availability
 */
const checkService = (req, res, next) => {
  if (!kiteService) {
    return res.status(500).json({
      error: 'KiteConnect service not available. Check API credentials.'
    });
  }
  next();
};

/**
 * GET /api/stocks/quote/:symbol - Get quote for a single stock
 */
router.get('/quote/:symbol', requireAuth, checkService, async (req, res) => {
  try {
    const { symbol } = req.params;
    
    if (!symbol) {
      return res.status(400).json({
        error: 'Symbol parameter is required'
      });
    }

    const quote = await kiteService.getQuote(symbol.toUpperCase());
    
    res.json({
      success: true,
      data: quote,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Error getting quote for ${req.params.symbol}:`, error);
    res.status(500).json({
      error: 'Failed to get stock quote',
      details: error.message,
      symbol: req.params.symbol
    });
  }
});

/**
 * POST /api/stocks/multiple - Get quotes for multiple stocks
 */
router.post('/multiple', requireAuth, checkService, async (req, res) => {
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

    const upperSymbols = symbols.map(s => s.toUpperCase());
    const quotes = await kiteService.getMultipleQuotes(upperSymbols);
    
    res.json({
      success: true,
      data: quotes,
      count: quotes.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting multiple quotes:', error);
    res.status(500).json({
      error: 'Failed to get multiple quotes',
      details: error.message
    });
  }
});

/**
 * GET /api/stocks/top - Get top traded stocks
 */
router.get('/top', requireAuth, checkService, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    
    if (limit < 1 || limit > 100) {
      return res.status(400).json({
        error: 'Limit must be between 1 and 100'
      });
    }

    const topStocks = await kiteService.getTopStocks(limit);
    
    res.json({
      success: true,
      data: topStocks,
      count: topStocks.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting top stocks:', error);
    res.status(500).json({
      error: 'Failed to get top stocks',
      details: error.message
    });
  }
});

/**
 * GET /api/stocks/historical/:symbol - Get historical data for charting
 */
router.get('/historical/:symbol', requireAuth, checkService, async (req, res) => {
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

    // Validate date format
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

    // Check if date range is not too large (max 1 year)
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

    const historicalData = await kiteService.getHistoricalData(
      symbol.toUpperCase(),
      from,
      to,
      interval
    );
    
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
    console.error(`Error getting historical data for ${req.params.symbol}:`, error);
    res.status(500).json({
      error: 'Failed to get historical data',
      details: error.message,
      symbol: req.params.symbol
    });
  }
});

/**
 * GET /api/stocks/market-status - Get market status
 */
router.get('/market-status', requireAuth, checkService, async (req, res) => {
  try {
    const status = await kiteService.getMarketStatus();
    
    res.json({
      success: true,
      status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting market status:', error);
    res.status(500).json({
      error: 'Failed to get market status',
      details: error.message
    });
  }
});

/**
 * GET /api/stocks/profile - Get user profile
 */
router.get('/profile', requireAuth, checkService, async (req, res) => {
  try {
    const profile = await kiteService.getProfile();
    
    res.json({
      success: true,
      data: profile,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).json({
      error: 'Failed to get user profile',
      details: error.message
    });
  }
});

export default router;