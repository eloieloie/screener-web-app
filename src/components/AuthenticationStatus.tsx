import React, { useState, useEffect } from 'react';
import KiteConnectAPI from '../services/KiteConnectAPI';

interface AuthenticationStatusProps {
  onAuthChange?: (isAuthenticated: boolean) => void;
}

const AuthenticationStatus: React.FC<AuthenticationStatusProps> = ({ onAuthChange }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authStatus, setAuthStatus] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [requestToken, setRequestToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const kiteAPI = KiteConnectAPI.getInstance();

  const updateAuthStatus = React.useCallback(async () => {
    const authenticated = kiteAPI.isReady();
    const status = kiteAPI.getAuthStatus();
    
    setIsAuthenticated(authenticated);
    setAuthStatus(status);
    
    if (onAuthChange) {
      onAuthChange(authenticated);
    }

    if (!authenticated) {
      // Login URL will be fetched fresh when needed
    }
  }, [kiteAPI, onAuthChange]);

  useEffect(() => {
    // Check if we have URL parameters indicating a redirect from Zerodha
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('request_token');
    const status = urlParams.get('status');

    if (token && status === 'success') {
      setRequestToken(token);
      setShowAuthModal(true);
    }

    // Check authentication status on component mount
    const checkAuth = async () => {
      await kiteAPI.checkAuthStatus();
      updateAuthStatus();
    };
    
    checkAuth();
  }, [updateAuthStatus, kiteAPI]);

  const handleLogin = async () => {
    try {
      const freshLoginURL = await kiteAPI.getLoginURL();
      if (freshLoginURL) {
        // Redirect to Zerodha login
        window.location.href = freshLoginURL;
      } else {
        alert('No login URL received from backend');
      }
    } catch (error) {
      console.error('Failed to get login URL:', error);
      alert('Failed to get login URL. Please check if the backend server is running.');
    }
  };

    const handleCompleteAuthentication = async () => {
    if (!requestToken) {
      alert('Request token is missing');
      return;
    }

    setIsLoading(true);
    try {
      // Call the updated method that handles API secret on backend
      await kiteAPI.generateSession(requestToken, ''); // API secret handled on backend
      setShowAuthModal(false);
      setRequestToken('');
      await updateAuthStatus();
      
      // Clear URL parameters
      const url = new URL(window.location.href);
      url.searchParams.delete('request_token');
      url.searchParams.delete('status');
      window.history.replaceState({}, document.title, url.pathname);
      
    } catch (error) {
      console.error('Authentication failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('session') && errorMessage.includes('cookie')) {
        alert(`Authentication issue: ${errorMessage}\n\nThis may be a browser cookie issue. Try:\n1. Refresh the page\n2. Clear browser cookies for this site\n3. Disable ad blockers temporarily`);
      } else {
        alert(`Authentication failed: ${errorMessage}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await kiteAPI.logout();
      // Refresh authentication status
      updateAuthStatus();
    } catch (error) {
      console.error('Logout failed:', error);
      // Force refresh as fallback
      window.location.reload();
    }
  };

  return (
    <div className="authentication-status">
      <div className="card mb-3">
        <div className="card-body">
          <h6 className="card-title d-flex align-items-center">
            <span className={`badge me-2 ${isAuthenticated ? 'bg-success' : 'bg-warning'}`}>
              {isAuthenticated ? '🟢' : '🟡'}
            </span>
            Zerodha Kite API Status
          </h6>
          <p className="card-text small text-muted">{authStatus}</p>
          
          {!isAuthenticated && (
            <div className="d-grid gap-2">
              <button 
                className="btn btn-primary btn-sm"
                onClick={handleLogin}
              >
                Login to Zerodha Kite
              </button>
              
              {/* Troubleshooting Section */}
              <div className="mt-2 p-2 bg-light rounded">
                <small className="text-muted">
                  <strong>🔧 Troubleshooting Login Issues:</strong>
                </small>
                <ul className="small text-muted mt-1 mb-1" style={{ fontSize: '0.75rem' }}>
                  <li>If button doesn't respond, check browser console for errors</li>
                  <li>Ensure pop-ups are enabled for this site</li>
                  <li>CORS errors? Make sure dev server runs on port 5174 (not 5175)</li>
                  <li>Try refreshing the page if login URL fails to load</li>
                  <li>Clear browser cache/cookies if authentication persists to fail</li>
                  <li>Make sure you have an active Zerodha account</li>
                  <li>Check if backend server is accessible (should show session_id)</li>
                  <li><strong>Not redirecting back?</strong> Check if redirect URI is configured in Zerodha app settings</li>
                  <li><strong>Stuck loading?</strong> The redirect URI must match exactly: <code>http://localhost:5174</code></li>
                </ul>
              </div>
              
              <small className="text-muted">
                You need to authenticate with Zerodha to access live stock data
              </small>
            </div>
          )}

          {isAuthenticated && (
            <div className="d-grid gap-2">
              <button 
                className="btn btn-outline-secondary btn-sm"
                onClick={handleLogout}
              >
                Logout
              </button>
              <small className="text-success">
                ✅ Connected to Zerodha - Authentication successful
              </small>
              <div className="alert alert-warning py-2 px-3 mt-2 mb-0" style={{ fontSize: '0.8rem' }}>
                <strong>ℹ️ Known Issue:</strong> Due to cross-origin session limitations, live stock data may not work consistently. 
                The app will fallback to sample data when needed. This will be resolved in production deployment.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Authentication Modal */}
      {showAuthModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Complete Zerodha Authentication</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setShowAuthModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <p className="text-success">
                  ✅ Successfully received request token from Zerodha!
                </p>
                <p className="small text-muted mb-3">
                  Click "Complete Authentication" to finish the login process.
                </p>
                
                <div className="mb-3">
                  <label className="form-label">Request Token (from URL)</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={requestToken}
                    readOnly
                    style={{ backgroundColor: '#f8f9fa' }}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowAuthModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={handleCompleteAuthentication}
                  disabled={isLoading}
                >
                  {isLoading ? 'Authenticating...' : 'Complete Authentication'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuthenticationStatus;