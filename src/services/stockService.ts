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
import type { Stock, AddStockForm } from '../types/Stock';
import KiteConnectAPI from './kiteConnectAPI';

const STOCKS_COLLECTION = 'stocks';

// Create KiteConnect API instance
const kiteAPI = new KiteConnectAPI();

// Add a new stock to Firestore with real API data
export const addStock = async (stockData: AddStockForm): Promise<Stock> => {
  try {
    console.log(`Adding stock: ${stockData.symbol} on ${stockData.exchange}`);
    
    // Get stock details from KiteConnect API
    const stockDetails = await kiteAPI.getStockQuote(stockData.symbol);
    
    if (!stockDetails) {
      throw new Error(`Stock ${stockData.symbol} not found`);
    }
    
    const stockDocument = {
      symbol: stockDetails.symbol,
      name: stockDetails.name,
      exchange: stockData.exchange,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    const docRef = await addDoc(collection(db, STOCKS_COLLECTION), stockDocument);

    return {
      ...stockDetails,
      id: docRef.id
    };
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
      const stockPromise = kiteAPI.getStockQuote(data.symbol)
        .then(stockDetails => {
          if (stockDetails) {
            return {
              ...stockDetails,
              id: doc.id
            };
          } else {
            // Return basic data if API fails
            return {
              id: doc.id,
              symbol: data.symbol,
              name: data.name,
              price: 0,
              change: 0,
              changePercent: 0,
              exchange: data.exchange as 'NSE' | 'BSE',
              currency: 'INR',
              marketCap: 'N/A'
            } as Stock;
          }
        })
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
            exchange: data.exchange as 'NSE' | 'BSE',
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
      const stockPromise = kiteAPI.getStockQuote(data.symbol)
        .then(stockDetails => {
          if (stockDetails) {
            return {
              ...stockDetails,
              id: doc.id
            };
          } else {
            // Return basic data if API fails
            return {
              id: doc.id,
              symbol: data.symbol,
              name: data.name,
              price: 0,
              change: 0,
              changePercent: 0,
              exchange: data.exchange as 'NSE' | 'BSE',
              currency: 'INR',
              marketCap: 'N/A'
            } as Stock;
          }
        })
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
            exchange: data.exchange as 'NSE' | 'BSE',
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
    const stockDetails = await kiteAPI.getStockQuote(data.symbol);
    
    if (!stockDetails) {
      throw new Error('Failed to fetch stock details');
    }
    
    return {
      ...stockDetails,
      id: stockId
    };
  } catch (error) {
    console.error('Error refreshing stock data:', error);
    throw new Error('Failed to refresh stock data');
  }
};

// Get available stock symbols
export const getAvailableSymbols = async (): Promise<string[]> => {
  try {
    return await kiteAPI.getInstruments();
  } catch (error) {
    console.error('Error getting available symbols:', error);
    return [];
  }
};

// Get market status
export const getMarketStatus = async (): Promise<{ isOpen: boolean; status: string; nextOpen?: string }> => {
  try {
    return await kiteAPI.getMarketStatus();
  } catch (error) {
    console.error('Error getting market status:', error);
    // Return default closed status
    return {
      isOpen: false,
      status: 'Unknown',
      nextOpen: 'Check back later'
    };
  }
};

// Get popular stocks for the screener
export const getPopularStocks = async (limit: number = 20): Promise<Stock[]> => {
  try {
    return await kiteAPI.getTopStocks(limit);
  } catch (error) {
    console.error('Error getting popular stocks:', error);
    return [];
  }
};