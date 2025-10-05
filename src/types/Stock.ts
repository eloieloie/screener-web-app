export interface Stock {
  id: string;
  symbol: string; // e.g., "RELIANCE.NS" for NSE, "RELIANCE.BO" for BSE
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  marketCap?: string;
  exchange?: 'NSE' | 'BSE';
  currency?: string; // INR for Indian stocks
  previousClose?: number;
  dayHigh?: number;
  dayLow?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  tags?: string[]; // Array of tags for categorization
  // Cached price data fields
  cachedPriceData?: {
    price: number;
    change: number;
    changePercent: number;
    volume?: number;
    marketCap?: string;
    currency?: string;
    previousClose?: number;
    dayHigh?: number;
    dayLow?: number;
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;
    lastUpdated: Date;
  };
  isRefreshing?: boolean; // UI state for refresh button
}

// Database interface - stores metadata and cached price data
export interface StockMetadata {
  id: string;
  symbol: string;
  name: string;
  exchange: 'NSE' | 'BSE';
  tags: string[]; // Array of tags for categorization
  createdAt: Date;
  updatedAt: Date;
  // Cached price data (optional - may not exist for newly added stocks)
  cachedPriceData?: {
    price: number;
    change: number;
    changePercent: number;
    volume?: number;
    marketCap?: string;
    currency?: string;
    previousClose?: number;
    dayHigh?: number;
    dayLow?: number;
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;
    lastUpdated: Date;
  };
}

export interface AddStockForm {
  symbol: string; // User will enter just "RELIANCE", we'll add .NS/.BO
  name: string;
  exchange: 'NSE' | 'BSE';
  tags: string[]; // Array of tags for categorization
}

export interface StockAPIResponse {
  symbol: string;
  longName: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  regularMarketVolume?: number;
  marketCap?: number;
  currency: string;
  regularMarketPreviousClose: number;
  regularMarketDayHigh: number;
  regularMarketDayLow: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
}