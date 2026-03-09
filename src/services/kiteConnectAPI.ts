import type { Stock } from '../types/Stock';

interface HistoricalDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface AuthResponse {
  success: boolean;
  message: string;
  access_token?: string;   // returned by backend so frontend can use Bearer auth
  sessionToken?: string;
  user?: {
    user_id: string;
    user_name: string;
    user_shortname: string;
    avatar_url: string;
    broker: string;
  };
}

interface StockResponse {
  success: boolean;
  data: Stock | Stock[];
  timestamp: string;
}

interface HistoricalResponse {
  success: boolean;
  data: HistoricalDataPoint[];
  count: number;
  symbol: string;
  from: string;
  to: string;
  interval: string;
  timestamp: string;
}

interface UserInfo {
  user_id: string;
  user_name: string;
  user_shortname?: string;
  avatar_url?: string;
  broker?: string;
}

class KiteConnectAPI {
  private static instance: KiteConnectAPI;
  private readonly backendUrl: string;
  private isAuthenticated = false;
  private userInfo: UserInfo | null = null;
  private sessionToken: string | null = null;

  constructor() {
    // Use Vite proxy (relative URLs) so requests stay same-origin — no CORS needed.
    // The proxy forwards /auth and /api to localhost:3001 on the server side.
    this.backendUrl = '';
    // Restore token from sessionStorage if it was saved in a previous page load
    const saved = sessionStorage.getItem('kite_access_token');
    if (saved) {
      this.sessionToken = saved;
      console.log('🔑 Restored access token from sessionStorage');
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(): KiteConnectAPI {
    if (!KiteConnectAPI.instance) {
      KiteConnectAPI.instance = new KiteConnectAPI();
    }
    return KiteConnectAPI.instance;
  }

  /**
   * Make authenticated request to backend
   */
  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.backendUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.sessionToken) {
      headers['Authorization'] = `Bearer ${this.sessionToken}`;
    }
    // Merge any caller-provided headers
    if (options.headers) {
      Object.assign(headers, options.headers);
    }

    console.log(`[makeRequest] ${options.method || 'GET'} ${endpoint} | token=${this.sessionToken ? this.sessionToken.slice(0,8)+'...' : 'NONE'} | auth-header=${!!headers['Authorization']}`);

    const fetchOptions: RequestInit = {
      credentials: 'include',
      ...options,
      headers,
    };

    const response = await fetch(url, fetchOptions);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get login URL for OAuth authentication
   */
  async getLoginURL(): Promise<string> {
    try {
      const response = await this.makeRequest<{ loginURL: string }>('/auth/login');
      return response.loginURL;
    } catch (error) {
      console.error('Failed to get login URL:', error);
      throw new Error('Unable to get login URL. Backend server may be unavailable.');
    }
  }

  /**
   * Complete authentication with request token
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async generateSession(requestToken: string, _apiSecret: string): Promise<void> {
    try {
      const response = await this.makeRequest<AuthResponse>('/auth/session', {
        method: 'POST',
        body: JSON.stringify({ request_token: requestToken }),
      });

      if (response.success) {
        // Store the access_token for Bearer auth on all subsequent requests.
        // This bypasses the session-cookie-through-Vite-proxy issue entirely.
        const token = response.access_token || response.sessionToken || null;
        if (token) {
          this.sessionToken = token;
          sessionStorage.setItem('kite_access_token', token);
          console.log('🔑 Access token saved — will use Bearer auth for API calls');
        }
        
        // Set authentication state
        this.isAuthenticated = true;
        this.userInfo = response.user || null;
        console.log('✅ Zerodha authentication successful:', response.user?.user_name);
        // No need to verify with checkAuthStatus — the Bearer token is immediately valid
      } else {
        throw new Error(response.message || 'Authentication failed');
      }
    } catch (error) {
      console.error('KiteConnect authentication failed:', error);
      // Ensure frontend state reflects the failure
      this.isAuthenticated = false;
      this.userInfo = null;
      this.sessionToken = null;
      sessionStorage.removeItem('kite_access_token');
      throw error;
    }
  }

  /**
   * Check authentication status
   */
  async checkAuthStatus(): Promise<void> {
    try {
      const response = await this.makeRequest<{
        authenticated: boolean;
        user: UserInfo | null;
      }>('/auth/status');
      
      this.isAuthenticated = response.authenticated;
      this.userInfo = response.user;
    } catch (error) {
      console.error('Failed to check auth status:', error);
      this.isAuthenticated = false;
      this.userInfo = null;
    }
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      await this.makeRequest('/auth/logout', { method: 'POST' });
      this.isAuthenticated = false;
      this.userInfo = null;
      this.sessionToken = null;
      sessionStorage.removeItem('kite_access_token');
      console.log('✅ KiteConnect: Logged out successfully');
    } catch (error) {
      console.error('Logout failed:', error);
      // Force clear local state even if backend call fails
      this.isAuthenticated = false;
      this.userInfo = null;
      this.sessionToken = null;
      sessionStorage.removeItem('kite_access_token');
      throw error;
    }
  }

  /**
   * Get quote for a single stock
   */
  async getStockQuote(symbol: string, exchange?: string): Promise<Stock | null> {
    try {
      if (!this.isAuthenticated) {
        throw new Error('KiteConnect API not authenticated. Please login to access live stock data.');
      }

      // Build URL with exchange parameter if provided
      const url = exchange 
        ? `/api/stocks/quote/${symbol}?exchange=${exchange}`
        : `/api/stocks/quote/${symbol}`;
      
      const response = await this.makeRequest<StockResponse>(url);
      
      if (response.success && !Array.isArray(response.data)) {
        return response.data as Stock;
      }
      
      throw new Error('Invalid response format');
    } catch (error) {
      if (error instanceof Error && error.message.includes('not authenticated')) {
        console.info(`Authentication required for ${symbol} quote data`);
      } else {
        console.error(`KiteConnect: Error getting quote for ${symbol}:`, error);
      }
      throw error;
    }
  }

  /**
   * Get quotes for multiple stocks
   */
  async getMultipleQuotes(symbols: string[]): Promise<Stock[]> {
    try {
      if (!this.isAuthenticated) {
        throw new Error('KiteConnect API not authenticated. Please login to access live stock data.');
      }

      const response = await this.makeRequest<StockResponse>('/api/stocks/multiple', {
        method: 'POST',
        body: JSON.stringify({ symbols }),
      });
      
      if (response.success && Array.isArray(response.data)) {
        return response.data as Stock[];
      }
      
      throw new Error('Invalid response format');
    } catch (error) {
      console.error('KiteConnect: Error getting multiple quotes:', error);
      throw error;
    }
  }

  /**
   * Get top traded stocks
   */
  async getTopStocks(limit: number = 50): Promise<Stock[]> {
    try {
      if (!this.isAuthenticated) {
        throw new Error('KiteConnect API not authenticated. Please login to access top stocks data.');
      }

      const response = await this.makeRequest<StockResponse>(`/api/stocks/top?limit=${limit}`);
      
      if (response.success && Array.isArray(response.data)) {
        return response.data as Stock[];
      }
      
      throw new Error('Invalid response format');
    } catch (error) {
      console.error('KiteConnect: Error getting top stocks:', error);
      throw error;
    }
  }

  /**
   * Get historical data for charting
   */
  async getHistoricalData(
    symbol: string, 
    from: Date, 
    to: Date, 
    interval: string = 'day'
  ): Promise<HistoricalDataPoint[]> {
    try {
      if (!this.isAuthenticated) {
        throw new Error('KiteConnect API not authenticated. Please login to access historical data.');
      }

      const fromStr = from.toISOString().split('T')[0];
      const toStr = to.toISOString().split('T')[0];
      
      const response = await this.makeRequest<HistoricalResponse>(
        `/api/stocks/historical/${symbol}?from=${fromStr}&to=${toStr}&interval=${interval}`
      );
      
      if (response.success) {
        return response.data;
      }
      
      throw new Error('Invalid response format');
    } catch (error) {
      if (error instanceof Error && error.message.includes('not authenticated')) {
        console.info(`Authentication required for ${symbol} historical data`);
      } else {
        console.error(`KiteConnect: Error getting historical data for ${symbol}:`, error);
      }
      throw error;
    }
  }

  /**
   * Get market status
   */
  async getMarketStatus(): Promise<string> {
    try {
      if (!this.isAuthenticated) {
        throw new Error('KiteConnect API not authenticated. Please login to access market status.');
      }

      const response = await this.makeRequest<{
        success: boolean;
        status: string;
      }>('/api/stocks/market-status');
      
      if (response.success) {
        return response.status === 'open' ? 'Market is open' : 'Market is closed';
      }
      
      throw new Error('Failed to get market status');
    } catch (error) {
      console.error('KiteConnect: Error getting market status:', error);
      throw error;
    }
  }

  /**
   * Check if API is authenticated and ready
   */
  isReady(): boolean {
    return this.isAuthenticated;
  }

  /**
   * Get authentication status message
   */
  getAuthStatus(): string {
    if (this.isAuthenticated) {
      return `Connected to Zerodha Kite (${this.userInfo?.user_name || 'User'}) - Note: Live data may not work due to session limitations`;
    } else {
      return 'Not authenticated - Please login to Zerodha Kite for live data';
    }
  }
}

export default KiteConnectAPI;