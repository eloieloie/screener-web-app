// Base NSE URL and common headers
const NSE_BASE_URL = 'https://www.nseindia.com';

interface StockBasic {
  symbol: string;
  name?: string;
  price?: number;
  change?: number;
  changePercent?: number;
}

interface EquityDetails {
  info: {
    symbol: string;
    companyName: string;
    industry: string;
    activeSeries: string[];
  };
  priceInfo: {
    lastPrice: number;
    change: number;
    pChange: number;
    previousClose: number;
    open: number;
    close: number;
    vwap: number;
    lowerCP: string;
    upperCP: string;
    pPriceBand: string;
    basePrice: number;
    intraDayHighLow: {
      min: number;
      max: number;
      value: number;
    };
    weekHighLow: {
      min: number;
      minDate: string;
      max: number;
      maxDate: string;
      value: number;
    };
    iNavValue: null;
    checkINAV: boolean;
  };
  industryInfo: {
    macro: string;
    sector: string;
    industry: string;
    basicIndustry: string;
  };
  preOpenMarket: {
    preopen: Record<string, unknown>[];
    ato: {
      buy: number;
      sell: number;
    };
    IEP: number;
    totalTradedVolume: number;
    finalPrice: number;
    finalQuantity: number;
    lastUpdateTime: string;
    totalBuyQuantity: number;
    totalSellQuantity: number;
    atoBuyQty: number;
    atoSellQty: number;
    Change: number;
    perChange: number;
    prevClose: number;
  };
}

class DirectNSEAPI {
  private baseHeaders = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'max-age=0',
    'Connection': 'keep-alive',
    'DNT': '1',
    'Pragma': 'no-cache',
    'sec-ch-ua': '"Google Chrome";v="105", "Not)A;Brand";v="8", "Chromium";v="105"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'none',
    'sec-fetch-user': '?1',
    'Upgrade-Insecure-Requests': '1',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36'
  };

  private cookies: string = '';
  private userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36';
  private baseUrl = NSE_BASE_URL;
  private noOfConnections = 0;

  constructor() {
    console.log('DirectNSEAPI: Initialized direct NSE API client');
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get NSE session cookies by visiting the main page
   */
  private async getNseCookies(): Promise<string> {
    if (this.cookies) {
      return this.cookies;
    }

    try {
      console.log('DirectNSEAPI: Acquiring NSE session cookies...');
      const response = await fetch(this.baseUrl, {
        method: 'GET',
        headers: this.baseHeaders,
        credentials: 'include'
      });

      const setCookieHeaders = response.headers.get('set-cookie');
      if (setCookieHeaders) {
        this.cookies = setCookieHeaders
          .split(',')
          .map((cookie: string) => cookie.split(';')[0])
          .join('; ');
        console.log('DirectNSEAPI: Successfully acquired session cookies');
      }

      return this.cookies;
    } catch (error) {
      console.warn('DirectNSEAPI: Could not acquire session cookies:', error);
      return '';
    }
  }

  /**
   * Generic method to fetch data from NSE API endpoints
   */
  private async getData(url: string): Promise<Record<string, unknown>> {
    let retries = 0;
    let hasError = false;

    do {
      // Rate limiting - max 5 concurrent connections
      while (this.noOfConnections >= 5) {
        await this.sleep(500);
      }

      this.noOfConnections++;

      try {
        console.log(`DirectNSEAPI: Fetching data from ${url}`);
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            ...this.baseHeaders,
            'Cookie': await this.getNseCookies(),
            'User-Agent': this.userAgent,
            'Referer': 'https://www.nseindia.com/',
            'X-Requested-With': 'XMLHttpRequest'
          }
        });

        this.noOfConnections--;

        if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
          const data = await response.json();
          console.log('DirectNSEAPI: Successfully fetched data');
          return data as Record<string, unknown>;
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        hasError = true;
        retries++;
        this.noOfConnections--;

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.warn(`DirectNSEAPI: Attempt ${retries} failed:`, errorMessage);

        if (retries >= 3) {
          console.error('DirectNSEAPI: Max retries reached, giving up');
          throw new Error(`Failed to fetch data after ${retries} attempts: ${errorMessage}`);
        }

        // Clear cookies on auth errors to force re-acquisition
        if (errorMessage.includes('401') || errorMessage.includes('403')) {
          this.cookies = '';
        }

        // Exponential backoff
        await this.sleep(Math.pow(2, retries) * 1000);
      }
    } while (hasError && retries < 3);

    throw new Error('Unexpected error in getData loop');
  }

  /**
   * Fetch data from a specific NSE API endpoint
   */
  private async getDataByEndpoint(apiEndpoint: string): Promise<Record<string, unknown>> {
    return this.getData(`${this.baseUrl}${apiEndpoint}`);
  }

  /**
   * Get all NSE stock symbols from pre-open market data
   */
  async getAllStockSymbols(): Promise<string[]> {
    try {
      const data = await this.getDataByEndpoint('/api/market-data-pre-open?key=ALL');
      
      if (data && data.data && Array.isArray(data.data)) {
        const symbols = data.data
          .map((item: Record<string, unknown>) => {
            const metadata = item.metadata as Record<string, unknown>;
            return metadata?.symbol as string;
          })
          .filter((symbol: string) => symbol)
          .sort();
        
        console.log(`DirectNSEAPI: Retrieved ${symbols.length} stock symbols`);
        return symbols;
      }
      
      throw new Error('Invalid response format from NSE API');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('DirectNSEAPI: Failed to get stock symbols:', errorMessage);
      throw error;
    }
  }

  /**
   * Get detailed information for a specific equity symbol
   */
  async getEquityDetails(symbol: string): Promise<EquityDetails> {
    try {
      const upperSymbol = symbol.toUpperCase();
      const data = await this.getDataByEndpoint(`/api/quote-equity?symbol=${encodeURIComponent(upperSymbol)}`);
      
      console.log(`DirectNSEAPI: Retrieved equity details for ${upperSymbol}`);
      return data as unknown as EquityDetails;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`DirectNSEAPI: Failed to get equity details for ${symbol}:`, errorMessage);
      throw error;
    }
  }

  /**
   * Get equity trade information
   */
  async getEquityTradeInfo(symbol: string): Promise<Record<string, unknown>> {
    try {
      const upperSymbol = symbol.toUpperCase();
      const data = await this.getDataByEndpoint(`/api/quote-equity?symbol=${encodeURIComponent(upperSymbol)}&section=trade_info`);
      
      console.log(`DirectNSEAPI: Retrieved trade info for ${upperSymbol}`);
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`DirectNSEAPI: Failed to get trade info for ${symbol}:`, errorMessage);
      throw error;
    }
  }

  /**
   * Get market status
   */
  async getMarketStatus(): Promise<Record<string, unknown>> {
    try {
      const data = await this.getDataByEndpoint('/api/marketStatus');
      console.log('DirectNSEAPI: Retrieved market status');
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('DirectNSEAPI: Failed to get market status:', errorMessage);
      throw error;
    }
  }

  /**
   * Convert NSE equity details to our StockBasic format
   */
  convertToStockBasic(equityDetails: EquityDetails): StockBasic {
    return {
      symbol: equityDetails.info.symbol,
      name: equityDetails.info.companyName,
      price: equityDetails.priceInfo.lastPrice,
      change: equityDetails.priceInfo.change,
      changePercent: equityDetails.priceInfo.pChange
    };
  }

  /**
   * Get top stocks for the screener (using pre-open market data as a starting point)
   */
  async getTopStocks(limit: number = 50): Promise<StockBasic[]> {
    try {
      console.log(`DirectNSEAPI: Fetching top ${limit} stocks`);
      
      // Get symbols from pre-open data which includes some price info
      const preOpenData = await this.getDataByEndpoint('/api/market-data-pre-open?key=ALL');
      
      if (!preOpenData?.data || !Array.isArray(preOpenData.data)) {
        throw new Error('Invalid pre-open data format');
      }

      // Convert to our format and take the top stocks
      const stocks: StockBasic[] = preOpenData.data
        .slice(0, limit)
        .map((item: Record<string, unknown>) => {
          const metadata = item.metadata as Record<string, unknown>;
          const detail = item.detail as Record<string, unknown>;
          const preOpenMarket = detail?.preOpenMarket as Record<string, unknown>;
          
          return {
            symbol: (metadata?.symbol as string) || 'N/A',
            name: (metadata?.symbol as string) || 'N/A', // We'll enhance this later
            price: (preOpenMarket?.IEP as number) || 0,
            change: (preOpenMarket?.Change as number) || 0,
            changePercent: (preOpenMarket?.perChange as number) || 0
          };
        })
        .filter((stock: StockBasic) => stock.symbol !== 'N/A');

      console.log(`DirectNSEAPI: Successfully converted ${stocks.length} stocks to basic format`);
      return stocks;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('DirectNSEAPI: Failed to get top stocks:', errorMessage);
      throw error;
    }
  }
}

export default DirectNSEAPI;