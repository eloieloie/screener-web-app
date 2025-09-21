import express from 'express';
import KiteConnectService from '../services/kiteConnectService.js';

const router = express.Router();
let kiteService;

// Initialize KiteConnect service
try {
  kiteService = new KiteConnectService();
} catch (error) {
  console.error('Failed to initialize KiteConnect service:', error.message);
}

/**
 * GET /auth/login - Get Zerodha login URL
 */
router.get('/login', (req, res) => {
  try {
    if (!kiteService) {
      return res.status(500).json({
        error: 'KiteConnect service not available. Check API credentials.'
      });
    }

    const loginURL = kiteService.getLoginURL();
    
    res.json({
      loginURL,
      message: 'Redirect user to this URL for Zerodha authentication'
    });
  } catch (error) {
    console.error('Error generating login URL:', error);
    res.status(500).json({
      error: 'Failed to generate login URL',
      details: error.message
    });
  }
});

/**
 * POST /auth/session - Complete authentication with request token
 */
router.post('/session', async (req, res) => {
  try {
    if (!kiteService) {
      return res.status(500).json({
        error: 'KiteConnect service not available. Check API credentials.'
      });
    }

    const { request_token } = req.body;
    
    if (!request_token) {
      return res.status(400).json({
        error: 'request_token is required'
      });
    }

    // Generate session with Zerodha
    const sessionData = await kiteService.generateSession(request_token);
    
    // Store session data in server session
    req.session.kiteAuth = {
      access_token: sessionData.access_token,
      public_token: sessionData.public_token,
      user_id: sessionData.user_id,
      user_name: sessionData.user_name,
      authenticated: true,
      timestamp: new Date().toISOString()
    };

    // Set access token for this service instance
    kiteService.setAccessToken(sessionData.access_token);
    
    res.json({
      success: true,
      message: 'Authentication successful',
      user: {
        user_id: sessionData.user_id,
        user_name: sessionData.user_name,
        user_shortname: sessionData.user_shortname,
        avatar_url: sessionData.avatar_url,
        broker: sessionData.broker
      }
    });
  } catch (error) {
    console.error('Authentication failed:', error);
    res.status(401).json({
      error: 'Authentication failed',
      details: error.message
    });
  }
});

/**
 * GET /auth/status - Check authentication status
 */
router.get('/status', (req, res) => {
  try {
    const isAuthenticated = req.session.kiteAuth?.authenticated || false;
    const userData = req.session.kiteAuth || null;
    
    res.json({
      authenticated: isAuthenticated,
      user: isAuthenticated ? {
        user_id: userData.user_id,
        user_name: userData.user_name,
        timestamp: userData.timestamp
      } : null,
      session_id: req.sessionID
    });
  } catch (error) {
    console.error('Error checking auth status:', error);
    res.status(500).json({
      error: 'Failed to check authentication status'
    });
  }
});

/**
 * POST /auth/logout - Logout user
 */
router.post('/logout', (req, res) => {
  try {
    // Clear server session
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session:', err);
        return res.status(500).json({
          error: 'Failed to logout'
        });
      }
      
      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Failed to logout'
    });
  }
});

/**
 * Middleware to check authentication for protected routes
 */
export const requireAuth = (req, res, next) => {
  const isAuthenticated = req.session.kiteAuth?.authenticated || false;
  
  if (!isAuthenticated) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please login with Zerodha first'
    });
  }
  
  // Set access token for the current request
  if (kiteService && req.session.kiteAuth.access_token) {
    kiteService.setAccessToken(req.session.kiteAuth.access_token);
  }
  
  next();
};

export default router;