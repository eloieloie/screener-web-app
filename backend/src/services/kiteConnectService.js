import { KiteConnect } from 'kiteconnect';
import dotenv from 'dotenv';

dotenv.config();

class KiteConnectService {
  constructor() {
    this.apiKey = process.env.KITE_API_KEY;
    this.apiSecret = process.env.KITE_API_SECRET;
    
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('KITE_API_KEY and KITE_API_SECRET must be set in environment variables');
    }
    
    this.kc = new KiteConnect({
      api_key: this.apiKey,
    });
    
    this.instruments = new Map(); // Cache for instruments
    this.instrumentsLoaded = false;
  }

  /**
   * Get login URL for OAuth authentication
   */
  getLoginURL() {
    return this.kc.getLoginURL();
  }

  /**
   * Generate session using request token
   */
  async generateSession(requestToken) {
    try {
      const response = await this.kc.generateSession(requestToken, this.apiSecret);
      
      // Set the access token for future requests
      this.kc.setAccessToken(response.access_token);
      
      return {
        access_token: response.access_token,
        public_token: response.public_token,
        user_type: response.user_type,
        user_id: response.user_id,
        user_name: response.user_name,
        user_shortname: response.user_shortname,
        avatar_url: response.avatar_url,
        broker: response.broker,
        exchanges: response.exchanges,
        products: response.products,
        order_types: response.order_types
      };
    } catch (error) {
      console.error('KiteConnect session generation failed:', error);
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  /**
   * Set access token (for subsequent requests in the same session)
   */
  setAccessToken(accessToken) {
    this.kc.setAccessToken(accessToken);
  }

  /**
   * Load and cache instruments data
   */
  async loadInstruments() {
    try {
      if (this.instrumentsLoaded) {
        return; // Already loaded
      }

      console.log('Loading NSE instruments...');
      const nseInstruments = await this.kc.getInstruments('NSE');
      
      // Create a map for quick lookups
      nseInstruments.forEach(instrument => {
        if (instrument.instrument_type === 'EQ') {
          this.instruments.set(instrument.tradingsymbol, {
            instrument_token: instrument.instrument_token,
            name: instrument.name,
            exchange: instrument.exchange,
            tick_size: instrument.tick_size,
            lot_size: instrument.lot_size
          });
        }
      });
      
      this.instrumentsLoaded = true;
      console.log(`Loaded ${this.instruments.size} NSE equity instruments`);
    } catch (error) {
      console.error('Failed to load instruments:', error);
      throw error;
    }
  }

  /**
   * Get instrument token by symbol
   */
  getInstrumentToken(symbol) {
    const instrument = this.instruments.get(symbol);
    return instrument ? instrument.instrument_token : null;
  }

  /**
   * Get quote for a single stock
   */
  async getQuote(symbol) {
    try {
      await this.loadInstruments(); // Ensure instruments are loaded
      
      const instrumentToken = this.getInstrumentToken(symbol);
      if (!instrumentToken) {
        throw new Error(`Instrument not found for symbol: ${symbol}`);
      }

      const quote = await this.kc.getQuote(`NSE:${symbol}`);
      const data = quote[`NSE:${symbol}`];
      
      if (!data) {
        throw new Error(`No quote data available for ${symbol}`);
      }

      // Calculate market cap (simplified - would need shares outstanding for accuracy)
      const marketCap = Math.floor(data.last_price * 1000000);

      return {
        id: instrumentToken.toString(),
        symbol: symbol,
        name: this.instruments.get(symbol)?.name || `${symbol} Limited`,
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
      };
    } catch (error) {
      console.error(`Error getting quote for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Get quotes for multiple stocks
   */
  async getMultipleQuotes(symbols) {
    try {
      await this.loadInstruments(); // Ensure instruments are loaded
      
      // Create array of NSE:SYMBOL strings
      const nseSymbols = symbols.map(symbol => `NSE:${symbol}`);
      
      const quotes = await this.kc.getQuote(nseSymbols);
      const results = [];
      
      for (const symbol of symbols) {
        const key = `NSE:${symbol}`;
        const data = quotes[key];
        
        if (data) {
          const instrumentToken = this.getInstrumentToken(symbol);
          const marketCap = Math.floor(data.last_price * 1000000);
          
          results.push({
            id: instrumentToken?.toString() || symbol,
            symbol: symbol,
            name: this.instruments.get(symbol)?.name || `${symbol} Limited`,
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
      
      return results;
    } catch (error) {
      console.error('Error getting multiple quotes:', error);
      throw error;
    }
  }

  /**
   * Get top traded stocks (Nifty 50 as example)
   */
  async getTopStocks(limit = 50) {
    try {
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
      return await this.getMultipleQuotes(topSymbols);
    } catch (error) {
      console.error('Error getting top stocks:', error);
      throw error;
    }
  }

  /**
   * Get historical data for charting
   */
  async getHistoricalData(symbol, from, to, interval = 'day') {
    try {
      await this.loadInstruments(); // Ensure instruments are loaded
      
      const instrumentToken = this.getInstrumentToken(symbol);
      if (!instrumentToken) {
        throw new Error(`Instrument not found for symbol: ${symbol}`);
      }

      const historical = await this.kc.getHistoricalData(
        instrumentToken,
        interval,
        from,
        to
      );

      return historical.map(point => ({
        date: point.date,
        open: point.open,
        high: point.high,
        low: point.low,
        close: point.close,
        volume: point.volume
      }));
    } catch (error) {
      console.error(`Error getting historical data for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Get user profile
   */
  async getProfile() {
    try {
      return await this.kc.getProfile();
    } catch (error) {
      console.error('Error getting user profile:', error);
      throw error;
    }
  }

  /**
   * Get market status
   */
  async getMarketStatus() {
    try {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      const timeNow = hour * 100 + minute;
      
      // NSE trading hours: 9:15 AM to 3:30 PM (IST)
      if (timeNow >= 915 && timeNow <= 1530) {
        return 'open';
      } else {
        return 'closed';
      }
    } catch (error) {
      console.error('Error getting market status:', error);
      return 'unknown';
    }
  }
}

export default KiteConnectService;