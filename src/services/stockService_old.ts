import { 
  collection, 
  doc, 
  addDoc, 
  getDocs, 
  getDoc,
  updateDoc, 
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Stock, AddStockForm, StockAPIResponse } from '../types/Stock';
import { fetchIndianStockData, formatMarketCap } from './indianStockAPI';

const STOCKS_COLLECTION = 'stocks';

// Convert API response to Stock object
const convertAPIResponseToStock = (apiData: StockAPIResponse, docId: string): Stock => ({
  id: docId,
  symbol: apiData.symbol,
  name: apiData.longName,
  price: apiData.regularMarketPrice,
  change: apiData.regularMarketChange,
  changePercent: apiData.regularMarketChangePercent,
  volume: apiData.regularMarketVolume,
  marketCap: formatMarketCap(apiData.marketCap || 0),
  exchange: apiData.symbol.endsWith('.NS') ? 'NSE' : 'BSE',
  currency: apiData.currency,
  previousClose: apiData.regularMarketPreviousClose,
  dayHigh: apiData.regularMarketDayHigh,
  dayLow: apiData.regularMarketDayLow,
  fiftyTwoWeekHigh: apiData.fiftyTwoWeekHigh,
  fiftyTwoWeekLow: apiData.fiftyTwoWeekLow,
});

// Add a new stock to Firestore with real API data
export const addStock = async (stockData: AddStockForm): Promise<Stock> => {
  try {
    // Fetch real stock data from API
    const apiData = await fetchIndianStockData(stockData.symbol, stockData.exchange);
    
    const stockDocument = {
      symbol: apiData.symbol,
      name: apiData.longName,
      exchange: stockData.exchange,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    const docRef = await addDoc(collection(db, STOCKS_COLLECTION), stockDocument);

    return convertAPIResponseToStock(apiData, docRef.id);
  } catch (error) {
    console.error('Error adding stock:', error);
    throw new Error('Failed to add stock. Please check the symbol and try again.');
  }
};

// Get all stocks from Firestore with real-time API data
export const getStocks = async (): Promise<Stock[]> => {
  try {
    const querySnapshot = await getDocs(
      query(collection(db, STOCKS_COLLECTION), orderBy('createdAt', 'desc'))
    );
    
    const stockPromises: Promise<Stock>[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // Fetch fresh data from API for each stock
      const stockPromise = fetchIndianStockData(data.symbol.replace('.NS', '').replace('.BO', ''), data.exchange)
        .then(apiData => convertAPIResponseToStock(apiData, doc.id))
        .catch(error => {
          console.error(`Error fetching data for ${data.symbol}:`, error);
          // Return basic data if API fails
          return {
            id: doc.id,
            symbol: data.symbol,
            name: data.name,
            price: 0,
            change: 0,
            changePercent: 0,
            exchange: data.exchange,
            currency: 'INR',
            marketCap: 'N/A'
          } as Stock;
        });
      stockPromises.push(stockPromise);
    });
    
    return await Promise.all(stockPromises);
  } catch (error) {
    console.error('Error getting stocks:', error);
    throw new Error('Failed to fetch stocks');
  }
};

// Subscribe to real-time updates of stocks with API data refresh
export const subscribeToStocks = (callback: (stocks: Stock[]) => void): (() => void) => {
  const q = query(collection(db, STOCKS_COLLECTION), orderBy('createdAt', 'desc'));
  
  return onSnapshot(q, async (querySnapshot) => {
    const stockPromises: Promise<Stock>[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // Fetch fresh data from API for each stock
      const stockPromise = fetchIndianStockData(data.symbol.replace('.NS', '').replace('.BO', ''), data.exchange)
        .then(apiData => convertAPIResponseToStock(apiData, doc.id))
        .catch(error => {
          console.error(`Error fetching data for ${data.symbol}:`, error);
          // Return basic data if API fails
          return {
            id: doc.id,
            symbol: data.symbol,
            name: data.name,
            price: 0,
            change: 0,
            changePercent: 0,
            exchange: data.exchange,
            currency: 'INR',
            marketCap: 'N/A'
          } as Stock;
        });
      stockPromises.push(stockPromise);
    });
    
    try {
      const stocks = await Promise.all(stockPromises);
      callback(stocks);
    } catch (error) {
      console.error('Error in stocks subscription:', error);
    }
  }, (error) => {
    console.error('Error in stocks subscription:', error);
  });
};

// Delete a stock
export const deleteStock = async (stockId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, STOCKS_COLLECTION, stockId));
  } catch (error) {
    console.error('Error deleting stock:', error);
    throw new Error('Failed to delete stock');
  }
};

// Update entire stock document
export const updateStock = async (stockId: string, updates: Partial<Stock>): Promise<void> => {
  try {
    const stockRef = doc(db, STOCKS_COLLECTION, stockId);
    await updateDoc(stockRef, {
      ...updates,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Error updating stock:', error);
    throw new Error('Failed to update stock');
  }
};

// Refresh stock data manually
export const refreshStockData = async (stockId: string): Promise<Stock> => {
  try {
    const stockRef = doc(db, STOCKS_COLLECTION, stockId);
    const stockDoc = await getDoc(stockRef);
    
    if (!stockDoc.exists()) {
      throw new Error('Stock not found');
    }
    
    const data = stockDoc.data();
    const apiData = await fetchIndianStockData(
      data.symbol.replace('.NS', '').replace('.BO', ''), 
      data.exchange
    );
    
    return convertAPIResponseToStock(apiData, stockId);
  } catch (error) {
    console.error('Error refreshing stock data:', error);
    throw new Error('Failed to refresh stock data');
  }
};