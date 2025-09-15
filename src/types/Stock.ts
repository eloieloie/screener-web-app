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
}

export interface AddStockForm {
  symbol: string; // User will enter just "RELIANCE", we'll add .NS/.BO
  name: string;
  exchange: 'NSE' | 'BSE';
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