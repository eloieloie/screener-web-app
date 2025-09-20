import * as KiteConnectPackage from 'kiteconnect';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const KiteConnect = (KiteConnectPackage as any).KiteConnect;

import type { Stock } from '../types/Stock';

interface KiteQuote {
  instrument_token: number;
  exchange_timestamp: string;
  last_price: number;
  last_quantity: number;
  last_trade_time: string;
  change: number;
  ohlc: {
    open: number;
    high: number;
    low: number;
    close: number;
  };
  volume: number;
  buy_quantity: number;
  sell_quantity: number;
  depth: {
    buy: Array<{ price: number; quantity: number; orders: number }>;
    sell: Array<{ price: number; quantity: number; orders: number }>;
  };
}

interface KiteInstrument {
  instrument_token: number;
  exchange_token: number;
  tradingsymbol: string;
  name: string;
  last_price: number;
  expiry: string;
  strike: number;
  tick_size: number;
  lot_size: number;
  instrument_type: string;
  segment: string;
  exchange: string;
}

interface HistoricalDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

class KiteConnectAPI {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private kc: any; // Using any for KiteConnect instance due to incomplete types
  private instruments: KiteInstrument[] = [];
  private isAuthenticated = false;

  constructor() {
    // Initialize KiteConnect with your API key
    // Note: You'll need to get these from your Zerodha app
    const apiKey = process.env.REACT_APP_KITE_API_KEY || 'n4m3qtd7p6yin03v';
    this.kc = new KiteConnect({
      api_key: apiKey,
    });
  }

  /**
   * Set access token for authenticated requests
   * This should be called after completing the OAuth flow
   */
  setAccessToken(token: string): void {
    this.kc.setAccessToken(token);
    this.isAuthenticated = true;
  }

  /**
   * Generate login URL for OAuth authentication
   */
  getLoginURL(): string {
    return this.kc.getLoginURL();
  }

  /**
   * Complete authentication with request token
   */
  async generateSession(requestToken: string, apiSecret: string): Promise<void> {
    try {
      const response = await this.kc.generateSession(requestToken, apiSecret);
      this.setAccessToken(response.access_token);
      console.log('KiteConnect: Authentication successful');
    } catch (error) {
      console.error('KiteConnect: Authentication failed:', error);
      throw error;
    }
  }

  /**
   * Load instruments data for symbol mapping
   */
  async loadInstruments(): Promise<void> {
    try {
      if (!this.isAuthenticated) {
        console.warn('KiteConnect: Not authenticated, using demo data');
        return;
      }

      // Load NSE instruments
      const nseInstruments = await this.kc.getInstruments('NSE');
      this.instruments = nseInstruments;
      console.log(`KiteConnect: Loaded ${this.instruments.length} NSE instruments`);
    } catch (error) {
      console.error('KiteConnect: Failed to load instruments:', error);
      // Continue with empty instruments for demo mode
    }
  }

  /**
   * Find instrument token by symbol
   */
  private findInstrumentToken(symbol: string): number | null {
    const instrument = this.instruments.find(
      inst => inst.tradingsymbol === symbol && inst.instrument_type === 'EQ'
    );
    return instrument ? instrument.instrument_token : null;
  }

  /**
   * Get quote for a single stock
   */
  async getStockQuote(symbol: string): Promise<Stock | null> {
    try {
      if (!this.isAuthenticated) {
        return this.getDemoStockData(symbol);
      }

      const instrumentToken = this.findInstrumentToken(symbol);
      if (!instrumentToken) {
        console.warn(`KiteConnect: Instrument token not found for ${symbol}`);
        return this.getDemoStockData(symbol);
      }

      const quotes = await this.kc.getQuote([`NSE:${symbol}`]);
      const quote = quotes[`NSE:${symbol}`] as KiteQuote;

      if (!quote) {
        return this.getDemoStockData(symbol);
      }

      return this.convertKiteQuoteToStock(symbol, quote);
    } catch (error) {
      console.error(`KiteConnect: Error getting quote for ${symbol}:`, error);
      return this.getDemoStockData(symbol);
    }
  }

  /**
   * Get quotes for multiple stocks
   */
  async getMultipleQuotes(symbols: string[]): Promise<Stock[]> {
    try {
      if (!this.isAuthenticated) {
        return Promise.all(symbols.map(symbol => this.getDemoStockData(symbol))).then(stocks => 
          stocks.filter(stock => stock !== null) as Stock[]
        );
      }

      const nseSymbols = symbols.map(symbol => `NSE:${symbol}`);
      const quotes = await this.kc.getQuote(nseSymbols);
      
      const stocks: Stock[] = [];
      
      for (const symbol of symbols) {
        const quote = quotes[`NSE:${symbol}`] as KiteQuote;
        if (quote) {
          const stock = this.convertKiteQuoteToStock(symbol, quote);
          if (stock) stocks.push(stock);
        } else {
          const demoStock = this.getDemoStockData(symbol);
          if (demoStock) stocks.push(demoStock);
        }
      }

      return stocks;
    } catch (error) {
      console.error('KiteConnect: Error getting multiple quotes:', error);
      // Return demo data for all symbols
      return Promise.all(symbols.map(symbol => this.getDemoStockData(symbol))).then(stocks => 
        stocks.filter(stock => stock !== null) as Stock[]
      );
    }
  }

  /**
   * Get top traded stocks
   */
  async getTopStocks(limit: number = 50): Promise<Stock[]> {
    try {
      if (!this.isAuthenticated) {
        return this.getDemoTopStocks(limit);
      }

      // Get top stocks from Nifty 50 or use a predefined list
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
      console.error('KiteConnect: Error getting top stocks:', error);
      return this.getDemoTopStocks(limit);
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
        return this.getDemoHistoricalData(symbol, from, to);
      }

      const instrumentToken = this.findInstrumentToken(symbol);
      if (!instrumentToken) {
        return this.getDemoHistoricalData(symbol, from, to);
      }

      const historical = await this.kc.getHistoricalData(
        instrumentToken,
        interval,
        from.toISOString().split('T')[0],
        to.toISOString().split('T')[0]
      );

      return historical;
    } catch (error) {
      console.error(`KiteConnect: Error getting historical data for ${symbol}:`, error);
      return this.getDemoHistoricalData(symbol, from, to);
    }
  }

  /**
   * Convert Kite quote to Stock interface
   */
  private convertKiteQuoteToStock(symbol: string, quote: KiteQuote): Stock | null {
    try {
      const changePercent = quote.ohlc.close > 0 ? (quote.change / quote.ohlc.close) * 100 : 0;
      
      // Find instrument details for name
      const instrument = this.instruments.find(
        inst => inst.tradingsymbol === symbol && inst.instrument_type === 'EQ'
      );

      return {
        id: Math.floor(Math.random() * 10000).toString(),
        symbol: symbol,
        name: instrument?.name || symbol,
        price: quote.last_price,
        change: quote.change,
        changePercent: Number(changePercent.toFixed(2)),
        volume: quote.volume,
        marketCap: this.calculateMarketCap(quote.last_price),
        exchange: 'NSE' as const,
        currency: 'INR',
        previousClose: quote.ohlc.close,
        dayHigh: quote.ohlc.high,
        dayLow: quote.ohlc.low
      };
    } catch (error) {
      console.error(`Error converting Kite quote for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Calculate market cap (simplified)
   */
  private calculateMarketCap(price: number): string {
    const randomShares = Math.floor(Math.random() * 1000000000) + 100000000;
    const marketCap = price * randomShares;
    
    if (marketCap >= 1e12) {
      return `₹${(marketCap / 1e12).toFixed(2)}T`;
    } else if (marketCap >= 1e9) {
      return `₹${(marketCap / 1e9).toFixed(2)}B`;
    } else if (marketCap >= 1e7) {
      return `₹${(marketCap / 1e7).toFixed(2)}Cr`;
    } else {
      return `₹${(marketCap / 1e5).toFixed(2)}L`;
    }
  }

  /**
   * Demo stock data for development/fallback
   */
  private getDemoStockData(symbol: string): Stock {
    const basePrice = Math.random() * 2000 + 500;
    const changePercent = (Math.random() - 0.5) * 10;
    const change = basePrice * (changePercent / 100);
    const price = basePrice + change;

    const companyNames: { [key: string]: string } = {
      'RELIANCE': 'Reliance Industries Limited',
      'TCS': 'Tata Consultancy Services Limited',
      'HDFCBANK': 'HDFC Bank Limited',
      'INFY': 'Infosys Limited',
      'HINDUNILVR': 'Hindustan Unilever Limited',
      'ICICIBANK': 'ICICI Bank Limited',
      'KOTAKBANK': 'Kotak Mahindra Bank Limited',
      'SBIN': 'State Bank of India',
      'BHARTIARTL': 'Bharti Airtel Limited',
      'ITC': 'ITC Limited'
    };

    return {
      id: Math.floor(Math.random() * 10000).toString(),
      symbol: symbol,
      name: companyNames[symbol] || `${symbol} Limited`,
      price: Number(price.toFixed(2)),
      change: Number(change.toFixed(2)),
      changePercent: Number(changePercent.toFixed(2)),
      volume: Math.floor(Math.random() * 10000000) + 100000,
      marketCap: this.calculateMarketCap(price),
      exchange: 'NSE' as const,
      currency: 'INR',
      previousClose: Number(basePrice.toFixed(2)),
      dayHigh: Number((price + Math.random() * 50).toFixed(2)),
      dayLow: Number((price - Math.random() * 50).toFixed(2))
    };
  }

  /**
   * Demo top stocks data
   */
  private getDemoTopStocks(limit: number): Stock[] {
    const topSymbols = [
      'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'HINDUNILVR',
      'ICICIBANK', 'KOTAKBANK', 'SBIN', 'BHARTIARTL', 'ITC',
      'ASIANPAINT', 'LT', 'AXISBANK', 'MARUTI', 'SUNPHARMA',
      'TITAN', 'ULTRACEMCO', 'NESTLEIND', 'WIPRO', 'M&M'
    ];

    return topSymbols.slice(0, limit).map(symbol => this.getDemoStockData(symbol));
  }

  /**
   * Demo historical data for charts
   */
  private getDemoHistoricalData(_symbol: string, from: Date, to: Date): HistoricalDataPoint[] {
    const data = [];
    const daysDiff = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    let basePrice = Math.random() * 1000 + 500;

    for (let i = 0; i < daysDiff; i++) {
      const date = new Date(from.getTime() + i * 24 * 60 * 60 * 1000);
      const change = (Math.random() - 0.5) * 20;
      const open = basePrice;
      const close = basePrice + change;
      const high = Math.max(open, close) + Math.random() * 10;
      const low = Math.min(open, close) - Math.random() * 10;
      const volume = Math.floor(Math.random() * 1000000) + 100000;

      data.push({
        date: date.toISOString().split('T')[0],
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
        volume: volume
      });

      basePrice = close;
    }

    return data;
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
      return 'Connected to Zerodha Kite';
    } else {
      return 'Demo mode - Connect to Zerodha Kite for live data';
    }
  }

  /**
   * Get available stock symbols from instruments
   */
  async getInstruments(): Promise<string[]> {
    try {
      if (!this.isAuthenticated) {
        console.warn('KiteConnect not authenticated, using demo symbols');
        return [
          'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'HINDUNILVR',
          'ICICIBANK', 'KOTAKBANK', 'SBIN', 'BHARTIARTL', 'ITC',
          'ASIANPAINT', 'LT', 'AXISBANK', 'MARUTI', 'SUNPHARMA',
          'TITAN', 'ULTRACEMCO', 'NESTLEIND', 'WIPRO', 'M&M'
        ];
      }

      if (this.instruments.length === 0) {
        await this.loadInstruments();
      }
      
      return this.instruments
        .filter(instrument => instrument.instrument_type === 'EQ' && instrument.exchange === 'NSE')
        .map(instrument => instrument.tradingsymbol)
        .slice(0, 100); // Limit to first 100 for performance
    } catch (error) {
      console.error('Error getting instruments:', error);
      return [];
    }
  }

  /**
   * Get market status
   */
  async getMarketStatus(): Promise<{ isOpen: boolean; status: string; nextOpen?: string }> {
    try {
      if (!this.isAuthenticated) {
        console.warn('KiteConnect not authenticated, using demo market status');
        const now = new Date();
        const currentHour = now.getHours();
        const isWeekday = now.getDay() >= 1 && now.getDay() <= 5;
        const isMarketHours = currentHour >= 9 && currentHour <= 15;
        
        return {
          isOpen: isWeekday && isMarketHours,
          status: isWeekday && isMarketHours ? 'Open' : 'Closed',
          nextOpen: isWeekday && !isMarketHours ? 'Next trading day 9:15 AM' : 'Monday 9:15 AM'
        };
      }

      // Note: KiteConnect doesn't have a direct market status API
      // This is a simplified implementation
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const isWeekday = now.getDay() >= 1 && now.getDay() <= 5;
      
      // Market hours: 9:15 AM to 3:30 PM on weekdays
      const isMarketHours = isWeekday && 
        ((currentHour > 9) || (currentHour === 9 && currentMinute >= 15)) &&
        ((currentHour < 15) || (currentHour === 15 && currentMinute <= 30));
      
      return {
        isOpen: isMarketHours,
        status: isMarketHours ? 'Open' : 'Closed',
        nextOpen: isMarketHours ? undefined : 'Next trading day 9:15 AM'
      };
    } catch (error) {
      console.error('Error getting market status:', error);
      return {
        isOpen: false,
        status: 'Unknown',
        nextOpen: 'Check back later'
      };
    }
  }
}

export default KiteConnectAPI;