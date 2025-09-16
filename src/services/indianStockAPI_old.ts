import type { StockAPIResponse } from '../types/Stock';

// Interface for Yahoo Finance stock data
interface YahooFinanceStockData {
  symbol: string;
  longName?: string;
  shortName?: string;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  regularMarketVolume?: number;
  marketCap?: number;
  currency?: string;
  regularMarketPreviousClose?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  averageVolume?: number;
  beta?: number;
  bookValue?: number;
  dividendYield?: number;
  eps?: number;
  forwardPE?: number;
  trailingPE?: number;
  priceToBook?: number;
}

// NSE India Official API
const NSE_BASE_URL = 'https://www.nseindia.com';
const NSE_QUOTE_URL = '/api/quote-equity';
const PROD_NSE_PROXY = 'https://us-central1-screener-d132c.cloudfunctions.net/nseProxy';

// Development proxy URLs (when using Vite dev server)
const isDevelopment = import.meta.env.DEV;
const DEV_NSE_PROXY = '/api/nse';

// Fallback mock data for demonstration when APIs fail
const MOCK_STOCK_DATA: Record<string, StockAPIResponse> = {
  'RELIANCE.NS': {
    symbol: 'RELIANCE.NS',
    longName: 'Reliance Industries Limited',
    regularMarketPrice: 2845.60,
    regularMarketChange: 15.80,
    regularMarketChangePercent: 0.56,
    regularMarketVolume: 2847593,
    marketCap: 19234500000000,
    currency: 'INR',
    regularMarketPreviousClose: 2829.80,
    regularMarketDayHigh: 2858.90,
    regularMarketDayLow: 2835.20,
    fiftyTwoWeekHigh: 3024.90,
    fiftyTwoWeekLow: 2220.30,
  },
  'TCS.NS': {
    symbol: 'TCS.NS',
    longName: 'Tata Consultancy Services Limited',
    regularMarketPrice: 4156.75,
    regularMarketChange: -28.45,
    regularMarketChangePercent: -0.68,
    regularMarketVolume: 1245879,
    marketCap: 15234500000000,
    currency: 'INR',
    regularMarketPreviousClose: 4185.20,
    regularMarketDayHigh: 4189.50,
    regularMarketDayLow: 4145.30,
    fiftyTwoWeekHigh: 4592.25,
    fiftyTwoWeekLow: 3311.00,
  },
  'INFY.NS': {
    symbol: 'INFY.NS',
    longName: 'Infosys Limited',
    regularMarketPrice: 1789.25,
    regularMarketChange: 12.30,
    regularMarketChangePercent: 0.69,
    regularMarketVolume: 3456789,
    marketCap: 7456789000000,
    currency: 'INR',
    regularMarketPreviousClose: 1776.95,
    regularMarketDayHigh: 1795.80,
    regularMarketDayLow: 1785.40,
    fiftyTwoWeekHigh: 1953.90,
    fiftyTwoWeekLow: 1351.65,
  },
  'HDFCBANK.NS': {
    symbol: 'HDFCBANK.NS',
    longName: 'HDFC Bank Limited',
    regularMarketPrice: 1674.85,
    regularMarketChange: 8.75,
    regularMarketChangePercent: 0.53,
    regularMarketVolume: 4567890,
    marketCap: 12789456000000,
    currency: 'INR',
    regularMarketPreviousClose: 1666.10,
    regularMarketDayHigh: 1678.90,
    regularMarketDayLow: 1665.25,
    fiftyTwoWeekHigh: 1791.00,
    fiftyTwoWeekLow: 1363.55,
  },
  'ICICIBANK.NS': {
    symbol: 'ICICIBANK.NS',
    longName: 'ICICI Bank Limited',
    regularMarketPrice: 1245.60,
    regularMarketChange: -5.40,
    regularMarketChangePercent: -0.43,
    regularMarketVolume: 5678901,
    marketCap: 8765432000000,
    currency: 'INR',
    regularMarketPreviousClose: 1251.00,
    regularMarketDayHigh: 1256.75,
    regularMarketDayLow: 1242.30,
    fiftyTwoWeekHigh: 1257.80,
    fiftyTwoWeekLow: 954.00,
  }
};


// NSE API Response Interfaces
interface NSEEquityData {
  info: {
    symbol: string;
    companyName: string;
    industry?: string;
    activeSeries: string[];
    identifier: string;
  };
  metadata: {
    lastUpdateTime: string;
    series: string;
    listingDate: string;
  };
  priceInfo: {
    lastPrice: number;
    change: number;
    pChange: number;
    previousClose: number;
    open: number;
    close: number;
    vwap?: number;
    lowerCP: number;
    upperCP: number;
  };
}

// Helper function to sleep/delay
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// NSE India API Service Class
class NSEIndia {
  private readonly baseUrl = NSE_BASE_URL;
  private readonly baseHeaders = {
    'Authority': 'www.nseindia.com',
    'Referer': 'https://www.nseindia.com/',
    'Accept': '*/*',
    'Origin': this.baseUrl,
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'application/json, text/plain, */*',
    'Connection': 'keep-alive'
  };
  private userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
  private noOfConnections = 0;

  async getData(url: string): Promise<unknown> {
    let retries = 0;
    let hasError = false;
    
    do {
      while (this.noOfConnections >= 5) {
        await sleep(500);
      }
      
      this.noOfConnections++;
      
      try {
        // Use development proxy if available
        let fetchUrl = url;
        const headers: Record<string, string> = { ...this.baseHeaders, 'User-Agent': this.userAgent };
        
        if (isDevelopment && url.startsWith(this.baseUrl)) {
          // Replace NSE base URL with development proxy
          fetchUrl = url.replace(this.baseUrl, DEV_NSE_PROXY);
          console.log(`Using development proxy: ${fetchUrl}`);
        } else {
          fetchUrl = url.replace(this.baseUrl, PROD_NSE_PROXY);
        }

        const response = await fetch(fetchUrl, { headers });

        this.noOfConnections--;
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
      } catch (error) {
        hasError = true;
        retries++;
        this.noOfConnections--;
        
        if (retries >= 3) {
          throw error;
        }
        
        await sleep(1000 * retries); // Exponential backoff
      }
    } while (hasError && retries < 3);
  }

  async getDataByEndpoint(apiEndpoint: string): Promise<unknown> {
    // In development, use proxy directly without base URL
    if (isDevelopment) {
      const proxyUrl = `${DEV_NSE_PROXY}${apiEndpoint}`;
      return this.getData(proxyUrl);
    }
    return this.getData(`${this.baseUrl}${apiEndpoint}`);
  }

  async getEquityDetails(symbol: string): Promise<NSEEquityData> {
    const result = await this.getDataByEndpoint(`${NSE_QUOTE_URL}?symbol=${encodeURIComponent(symbol.toUpperCase())}`);
    return result as NSEEquityData;
  }
}

// Create NSE API instance
const nseIndia = new NSEIndia();

// Popular Indian stock symbols for suggestions
export const POPULAR_INDIAN_STOCKS = [
  { symbol: 'RELIANCE', name: 'Reliance Industries Limited', exchange: 'NSE' },
  { symbol: 'TCS', name: 'Tata Consultancy Services Limited', exchange: 'NSE' },
  { symbol: 'INFY', name: 'Infosys Limited', exchange: 'NSE' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank Limited', exchange: 'NSE' },
  { symbol: 'ICICIBANK', name: 'ICICI Bank Limited', exchange: 'NSE' },
  { symbol: 'HINDUNILVR', name: 'Hindustan Unilever Limited', exchange: 'NSE' },
  { symbol: 'ITC', name: 'ITC Limited', exchange: 'NSE' },
  { symbol: 'SBIN', name: 'State Bank of India', exchange: 'NSE' },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel Limited', exchange: 'NSE' },
  { symbol: 'ASIANPAINT', name: 'Asian Paints Limited', exchange: 'NSE' },
];

// Format symbol for Yahoo Finance API (add .NS for NSE, .BO for BSE)
export const formatSymbolForAPI = (symbol: string, exchange: 'NSE' | 'BSE'): string => {
  const cleanSymbol = symbol.toUpperCase().trim();
  return exchange === 'NSE' ? `${cleanSymbol}.NS` : `${cleanSymbol}.BO`;
};

// Fetch stock data from NSE API with Yahoo Finance fallback
export const fetchIndianStockData = async (symbol: string, exchange: 'NSE' | 'BSE'): Promise<StockAPIResponse> => {
  const cleanSymbol = symbol.toUpperCase().trim();
  
  // Add better console logging for debugging
  console.group(`🔍 Fetching data for ${cleanSymbol} (${exchange})`);
  
  try {
    // Try NSE API first (works for NSE stocks)
    if (exchange === 'NSE') {
      console.log(`📡 Trying NSE API for ${cleanSymbol}`);
      try {
        const nseData = await nseIndia.getEquityDetails(cleanSymbol);
        
        console.log(`✅ Successfully fetched data for ${cleanSymbol} from NSE API`);
        console.groupEnd();
        return {
          symbol: `${cleanSymbol}.NS`,
          longName: nseData.info.companyName || cleanSymbol,
          regularMarketPrice: nseData.priceInfo.lastPrice || 0,
          regularMarketChange: nseData.priceInfo.change || 0,
          regularMarketChangePercent: nseData.priceInfo.pChange || 0,
          regularMarketVolume: 0, // NSE API doesn't provide volume in quote endpoint
          marketCap: 0, // NSE API doesn't provide market cap in quote endpoint
          currency: 'INR',
          regularMarketPreviousClose: nseData.priceInfo.previousClose || 0,
          regularMarketDayHigh: nseData.priceInfo.upperCP || 0,
          regularMarketDayLow: nseData.priceInfo.lowerCP || 0,
          fiftyTwoWeekHigh: 0, // Would need separate API call
          fiftyTwoWeekLow: 0, // Would need separate API call
        };
      } catch (nseError) {
        const errorMessage = nseError instanceof Error ? nseError.message : String(nseError);
        if (errorMessage.includes('403')) {
          console.log(`🚫 NSE API blocked (403 Forbidden) for ${cleanSymbol} - trying Yahoo Finance`);
        } else if (errorMessage.includes('CORS')) {
          console.log(`🌐 CORS error with NSE API for ${cleanSymbol} - trying Yahoo Finance`);
        } else if (errorMessage.includes('Network')) {
          console.log(`📡 Network error with NSE API for ${cleanSymbol} - trying Yahoo Finance`);
        } else {
          console.log(`❌ NSE API failed for ${cleanSymbol}: ${errorMessage} - trying Yahoo Finance`);
        }
        // Fall through to Yahoo Finance
      }
    }
    
    // Try Yahoo Finance API as fallback
    console.log(`📡 Trying Yahoo Finance API for ${cleanSymbol}`);
    try {
      const yahooSymbol = formatSymbolForAPI(cleanSymbol, exchange);
      const isDevelopment = import.meta.env.DEV;
      const baseUrl = isDevelopment ? '/api/yahoo' : 'https://query1.finance.yahoo.com';
      
      const response = await fetch(
        `${baseUrl}/v7/finance/quote?symbols=${yahooSymbol}&fields=longName,regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketVolume,marketCap,currency,regularMarketPreviousClose,regularMarketDayHigh,regularMarketDayLow,fiftyTwoWeekHigh,fiftyTwoWeekLow`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.quoteResponse?.result && data.quoteResponse.result.length > 0) {
        const stockData = data.quoteResponse.result[0];
        console.log(`✅ Successfully fetched data for ${cleanSymbol} from Yahoo Finance API`);
        console.groupEnd();
        return {
          symbol: stockData.symbol,
          longName: stockData.longName || stockData.shortName || cleanSymbol,
          regularMarketPrice: stockData.regularMarketPrice || 0,
          regularMarketChange: stockData.regularMarketChange || 0,
          regularMarketChangePercent: stockData.regularMarketChangePercent || 0,
          regularMarketVolume: stockData.regularMarketVolume || 0,
          marketCap: stockData.marketCap || 0,
          currency: stockData.currency || 'INR',
          regularMarketPreviousClose: stockData.regularMarketPreviousClose || 0,
          regularMarketDayHigh: stockData.regularMarketDayHigh || 0,
          regularMarketDayLow: stockData.regularMarketDayLow || 0,
          fiftyTwoWeekHigh: stockData.fiftyTwoWeekHigh || 0,
          fiftyTwoWeekLow: stockData.fiftyTwoWeekLow || 0,
        };
      } else {
        throw new Error('No stock data found in Yahoo Finance response');
      }
    } catch (yahooError) {
      const errorMessage = yahooError instanceof Error ? yahooError.message : String(yahooError);
      if (errorMessage.includes('403')) {
        console.log(`🚫 Yahoo Finance API blocked (403 Forbidden) for ${cleanSymbol} - using mock data`);
      } else if (errorMessage.includes('CORS')) {
        console.log(`🌐 CORS error with Yahoo Finance API for ${cleanSymbol} - using mock data`);
      } else if (errorMessage.includes('Network')) {
        console.log(`📡 Network error with Yahoo Finance API for ${cleanSymbol} - using mock data`);
      } else {
        console.log(`❌ Yahoo Finance API failed for ${cleanSymbol}: ${errorMessage} - using mock data`);
      }
    }
    
    // If all APIs fail, use mock data as fallback
    console.log(`🎭 All APIs failed for ${cleanSymbol}, using mock data`);
    const mockData = MOCK_STOCK_DATA[formatSymbolForAPI(cleanSymbol, exchange)];
    if (mockData) {
      console.log(`✅ Using mock data for ${cleanSymbol}`);
      console.groupEnd();
      return mockData;
    }
    
    console.groupEnd();
    throw new Error('All API services failed and no mock data available');
  } catch (error) {
    console.groupEnd();
    console.error('❌ Error fetching stock data:', error);
    throw new Error(`Failed to fetch data for ${symbol}. Please check the symbol and try again.`);
  }
};

// Fetch multiple stocks data
export const fetchMultipleStocksData = async (symbols: { symbol: string, exchange: 'NSE' | 'BSE' }[]): Promise<StockAPIResponse[]> => {
  const formattedSymbols = symbols.map(s => formatSymbolForAPI(s.symbol, s.exchange)).join(',');
  
  try {
    const isDevelopment = import.meta.env.DEV;
    const baseUrl = isDevelopment ? '/api/yahoo' : 'https://query1.finance.yahoo.com';
    
    const response = await fetch(
      `${baseUrl}/v7/finance/quote?symbols=${formattedSymbols}&fields=longName,regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketVolume,marketCap,currency,regularMarketPreviousClose,regularMarketDayHigh,regularMarketDayLow,fiftyTwoWeekHigh,fiftyTwoWeekLow`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.quoteResponse?.result) {
      throw new Error('No stock data found');
    }

    return data.quoteResponse.result.map((stockData: YahooFinanceStockData) => ({
      symbol: stockData.symbol,
      longName: stockData.longName || stockData.shortName || stockData.symbol,
      regularMarketPrice: stockData.regularMarketPrice || 0,
      regularMarketChange: stockData.regularMarketChange || 0,
      regularMarketChangePercent: stockData.regularMarketChangePercent || 0,
      regularMarketVolume: stockData.regularMarketVolume,
      marketCap: stockData.marketCap,
      currency: stockData.currency || 'INR',
      regularMarketPreviousClose: stockData.regularMarketPreviousClose || 0,
      regularMarketDayHigh: stockData.regularMarketDayHigh || 0,
      regularMarketDayLow: stockData.regularMarketDayLow || 0,
      fiftyTwoWeekHigh: stockData.fiftyTwoWeekHigh || 0,
      fiftyTwoWeekLow: stockData.fiftyTwoWeekLow || 0,
    }));
  } catch (error) {
    console.error('Error fetching multiple stocks data:', error);
    throw new Error('Failed to fetch stocks data. Please try again.');
  }
};

// Validate Indian stock symbol
export const validateIndianStockSymbol = (symbol: string): boolean => {
  // Basic validation for Indian stock symbols
  const cleanSymbol = symbol.trim().toUpperCase();
  
  // Should be 1-20 characters, alphanumeric
  if (!/^[A-Z0-9]{1,20}$/.test(cleanSymbol)) {
    return false;
  }
  
  return true;
};

// Get suggestions based on partial symbol
export const getStockSuggestions = (partial: string): Array<{symbol: string, name: string, exchange: string}> => {
  const search = partial.toUpperCase().trim();
  
  if (search.length < 1) return [];
  
  return POPULAR_INDIAN_STOCKS.filter(stock => 
    stock.symbol.includes(search) || 
    stock.name.toUpperCase().includes(search)
  ).slice(0, 5);
};

// Format market cap for display
export const formatMarketCap = (marketCap: number): string => {
  if (!marketCap) return 'N/A';
  
  if (marketCap >= 1e12) {
    return `₹${(marketCap / 1e12).toFixed(2)}T`;
  } else if (marketCap >= 1e9) {
    return `₹${(marketCap / 1e9).toFixed(2)}B`;
  } else if (marketCap >= 1e7) {
    return `₹${(marketCap / 1e7).toFixed(2)}Cr`;
  } else if (marketCap >= 1e5) {
    return `₹${(marketCap / 1e5).toFixed(2)}L`;
  } else {
    return `₹${marketCap.toLocaleString('en-IN')}`;
  }
};

// Format volume for display
export const formatVolume = (volume: number): string => {
  if (!volume) return 'N/A';
  
  if (volume >= 1e7) {
    return `${(volume / 1e7).toFixed(2)}Cr`;
  } else if (volume >= 1e5) {
    return `${(volume / 1e5).toFixed(2)}L`;
  } else if (volume >= 1e3) {
    return `${(volume / 1e3).toFixed(2)}K`;
  } else {
    return volume.toLocaleString('en-IN');
  }
};