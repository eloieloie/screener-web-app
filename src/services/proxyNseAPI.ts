// ProxyNSEAPI.ts - Frontend client for our backend proxy

interface NSEQuoteResponse {
  symbol: string;
  companyName?: string;
  lastPrice?: number;
  change?: number;
  pChange?: number;
  totalTradedVolume?: number;
  [key: string]: unknown;
}

interface NSESymbolsResponse {
  symbols: string[];
}

interface MarketState {
  market: string;
  marketStatus: string;
  tradeDate?: string;
  index?: string;
}

interface NSEMarketStatusResponse {
  marketState: MarketState[];
}

interface NSEStock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: string;
}

interface NSETopStocksResponse {
  stocks: NSEStock[];
}

interface HealthResponse {
  status: string;
  timestamp?: string;
  cookiesLastUpdated?: string;
  cookiesValid?: boolean;
  error?: string;
}

class ProxyNSEAPI {
  private baseURL: string;

  constructor() {
    // Use relative path so Vite proxy handles the routing
    this.baseURL = '/api/nse';
  }

  private async makeRequest<T>(endpoint: string): Promise<T> {
    try {
      console.log(`🔄 ProxyNSEAPI: Fetching ${endpoint}`);
      
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log(`✅ ProxyNSEAPI: Success for ${endpoint}`);
      return data as T;
    } catch (error) {
      console.error(`❌ ProxyNSEAPI: Error for ${endpoint}:`, error);
      throw error;
    }
  }

  async getStockQuote(symbol: string): Promise<NSEQuoteResponse> {
    const cleanSymbol = symbol.toUpperCase().trim();
    return this.makeRequest<NSEQuoteResponse>(`${this.baseURL}/quote?symbol=${encodeURIComponent(cleanSymbol)}`);
  }

  async getAllSymbols(): Promise<string[]> {
    try {
      const response = await this.makeRequest<NSESymbolsResponse>(`${this.baseURL}/symbols`);
      return response.symbols || [];
    } catch (error) {
      console.error('Failed to fetch symbols:', error);
      // Return fallback symbols
      return [
        "RELIANCE", "TCS", "HDFCBANK", "INFY", "HINDUNILVR", "ICICIBANK", "KOTAKBANK", 
        "BHARTIARTL", "ITC", "SBIN", "LT", "ASIANPAINT", "AXISBANK", "MARUTI", "BAJFINANCE",
        "HCLTECH", "DMART", "SUNPHARMA", "TITAN", "ULTRACEMCO", "NESTLEIND", "WIPRO",
        "ADANIENT", "JSWSTEEL", "POWERGRID", "TATAMOTORS", "NTPC", "COALINDIA", "ONGC"
      ];
    }
  }

  async getMarketStatus(): Promise<{ isOpen: boolean; status: string; nextOpen?: string }> {
    try {
      const response = await this.makeRequest<NSEMarketStatusResponse>(`${this.baseURL}/market-status`);
      
      if (response.marketState && response.marketState.length > 0) {
        const capitalMarket = response.marketState.find(
          (market: MarketState) => market.market === "Capital Market"
        ) || response.marketState[0];
        
        return {
          isOpen: capitalMarket.marketStatus === "Open",
          status: capitalMarket.marketStatus,
          nextOpen: capitalMarket.marketStatus === "Closed" ? "Next trading day 9:15 AM IST" : undefined
        };
      }
      
      throw new Error('Invalid market status response');
    } catch (error) {
      console.error('Failed to fetch market status:', error);
      // Return fallback status
      const now = new Date();
      const istTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
      const hour = istTime.getHours();
      const day = istTime.getDay();
      
      const isMarketHours = day >= 1 && day <= 5 && hour >= 9 && hour < 16;
      
      return {
        isOpen: isMarketHours,
        status: isMarketHours ? "Open" : "Closed",
        nextOpen: !isMarketHours ? "Next trading day 9:15 AM IST" : undefined
      };
    }
  }

  async getTopStocks(limit: number = 20): Promise<NSEStock[]> {
    try {
      const response = await this.makeRequest<NSETopStocksResponse>(`${this.baseURL}/top-stocks`);
      return (response.stocks || []).slice(0, limit);
    } catch (error) {
      console.error('Failed to fetch top stocks:', error);
      return [];
    }
  }

  async checkHealth(): Promise<HealthResponse> {
    try {
      return this.makeRequest<HealthResponse>('/api/health');
    } catch (error) {
      console.error('Health check failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { status: 'error', error: errorMessage };
    }
  }
}

export default ProxyNSEAPI;