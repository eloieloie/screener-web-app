import { 
  collection, 
  doc, 
  addDoc, 
  getDocs, 
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Stock, AddStockForm } from '../types/Stock';
import KiteConnectAPI from './KiteConnectAPI';

const STOCKS_COLLECTION = 'stocks';

// Create KiteConnect API instance
const kiteAPI = KiteConnectAPI.getInstance();

// Add a new stock to Firestore - only metadata, no price data
export const addStock = async (stockData: AddStockForm): Promise<Stock> => {
  try {
    console.log(`Adding stock: ${stockData.symbol} on ${stockData.exchange}`);
    
    // Check if API is authenticated before trying to verify stock
    if (!kiteAPI.isReady()) {
      console.warn('API not authenticated - adding stock metadata only');
      
      // Add only metadata without API verification
      const stockDocument = {
        symbol: stockData.symbol,
        name: stockData.name,
        exchange: stockData.exchange,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      const docRef = await addDoc(collection(db, STOCKS_COLLECTION), stockDocument);

      // Return basic stock structure
      return {
        id: docRef.id,
        symbol: stockData.symbol,
        name: stockData.name,
        price: 0,
        change: 0,
        changePercent: 0,
        exchange: stockData.exchange,
        currency: 'INR',
        marketCap: 'N/A'
      };
    }
    
    // Verify stock exists by getting API data (but don't store it)
    const stockDetails = await kiteAPI.getStockQuote(stockData.symbol);
    
    if (!stockDetails) {
      throw new Error(`Stock ${stockData.symbol} not found`);
    }
    
    // Only store metadata in Firebase - no price data
    const stockDocument = {
      symbol: stockData.symbol,
      name: stockData.name,
      exchange: stockData.exchange,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    const docRef = await addDoc(collection(db, STOCKS_COLLECTION), stockDocument);

    // Return the live API data with the Firebase ID
    return {
      ...stockDetails,
      id: docRef.id
    };
  } catch (error) {
    console.error('Error adding stock:', error);
    throw new Error('Failed to add stock. Please check the symbol and try again.');
  }
};

// Get all stocks from Firestore metadata and fetch live price data from API
export const getStocks = async (): Promise<Stock[]> => {
  try {
    const querySnapshot = await getDocs(
      query(collection(db, STOCKS_COLLECTION), orderBy('createdAt', 'desc'))
    );
    
    const stockPromises: Promise<Stock>[] = [];
    querySnapshot.forEach((doc) => {
      const metadata = doc.data(); // Only contains symbol, name, exchange, timestamps
      
      // Fetch ALL price data from API - nothing from database
      const stockPromise = kiteAPI.getStockQuote(metadata.symbol)
        .then(stockDetails => {
          if (stockDetails) {
            return {
              ...stockDetails,
              id: doc.id // Only use the Firebase ID, all other data from API
            };
          } else {
            // Return basic metadata if API fails - no price data
            return {
              id: doc.id,
              symbol: metadata.symbol,
              name: metadata.name,
              price: 0,
              change: 0,
              changePercent: 0,
              exchange: metadata.exchange as 'NSE' | 'BSE',
              currency: 'INR',
              marketCap: 'N/A'
            } as Stock;
          }
        })
        .catch(error => {
          console.error(`Error fetching live data for ${metadata.symbol}:`, error);
          // Return basic metadata if API fails
          return {
            id: doc.id,
            symbol: metadata.symbol,
            name: metadata.name,
            price: 0,
            change: 0,
            changePercent: 0,
            exchange: metadata.exchange as 'NSE' | 'BSE',
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

// Subscribe to real-time metadata updates from Firebase and fetch live prices from API
export const subscribeToStocks = (callback: (stocks: Stock[]) => void): (() => void) => {
  const q = query(collection(db, STOCKS_COLLECTION), orderBy('createdAt', 'desc'));
  
  return onSnapshot(q, async (querySnapshot) => {
    const stockPromises: Promise<Stock>[] = [];
    querySnapshot.forEach((doc) => {
      const metadata = doc.data(); // Only metadata from Firebase
      
      // Check if API is authenticated before making calls
      if (kiteAPI.isReady()) {
        // Fetch ALL live price data from API - never from database
        const stockPromise = kiteAPI.getStockQuote(metadata.symbol)
          .then(stockDetails => {
            if (stockDetails) {
              return {
                ...stockDetails,
                id: doc.id // Only Firebase ID, everything else from API
              };
            } else {
              // Return basic metadata if API fails
              return {
                id: doc.id,
                symbol: metadata.symbol,
                name: metadata.name,
                price: 0,
                change: 0,
                changePercent: 0,
                exchange: metadata.exchange as 'NSE' | 'BSE',
                currency: 'INR',
                marketCap: 'N/A'
              } as Stock;
            }
          })
          .catch(() => {
            console.warn(`Live data unavailable for ${metadata.symbol} - authentication required`);
            // Return basic metadata if API fails
            return {
              id: doc.id,
              symbol: metadata.symbol,
              name: metadata.name,
              price: 0,
              change: 0,
              changePercent: 0,
              exchange: metadata.exchange as 'NSE' | 'BSE',
              currency: 'INR',
              marketCap: 'N/A'
            } as Stock;
          });
        stockPromises.push(stockPromise);
      } else {
        // If not authenticated, return basic metadata immediately
        const basicStock: Stock = {
          id: doc.id,
          symbol: metadata.symbol,
          name: metadata.name,
          price: 0,
          change: 0,
          changePercent: 0,
          exchange: metadata.exchange as 'NSE' | 'BSE',
          currency: 'INR',
          marketCap: 'N/A'
        };
        stockPromises.push(Promise.resolve(basicStock));
      }
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

// Get available stock symbols
export const getAvailableSymbols = async (): Promise<{ tradingsymbol: string; name: string; instrument_type: string; exchange: string }[]> => {
  try {
    // For now, return a predefined list of popular NSE stocks
    // In a real implementation, you could fetch this from the backend
    const popularStocks = [
      { tradingsymbol: 'RELIANCE', name: 'Reliance Industries Limited', instrument_type: 'EQ', exchange: 'NSE' },
      { tradingsymbol: 'TCS', name: 'Tata Consultancy Services Limited', instrument_type: 'EQ', exchange: 'NSE' },
      { tradingsymbol: 'HDFCBANK', name: 'HDFC Bank Limited', instrument_type: 'EQ', exchange: 'NSE' },
      { tradingsymbol: 'INFY', name: 'Infosys Limited', instrument_type: 'EQ', exchange: 'NSE' },
      { tradingsymbol: 'HINDUNILVR', name: 'Hindustan Unilever Limited', instrument_type: 'EQ', exchange: 'NSE' },
      { tradingsymbol: 'ICICIBANK', name: 'ICICI Bank Limited', instrument_type: 'EQ', exchange: 'NSE' },
      { tradingsymbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank Limited', instrument_type: 'EQ', exchange: 'NSE' },
      { tradingsymbol: 'SBIN', name: 'State Bank of India', instrument_type: 'EQ', exchange: 'NSE' },
      { tradingsymbol: 'BHARTIARTL', name: 'Bharti Airtel Limited', instrument_type: 'EQ', exchange: 'NSE' },
      { tradingsymbol: 'ITC', name: 'ITC Limited', instrument_type: 'EQ', exchange: 'NSE' },
    ];
    
    return popularStocks;
  } catch (error) {
    console.error('Error getting available symbols:', error);
    return [];
  }
};

// Get market status
export const getMarketStatus = async (): Promise<{ isOpen: boolean; status: string; nextOpen?: string }> => {
  try {
    const status = await kiteAPI.getMarketStatus();
    // Convert string status to object format
    const isOpen = status.includes('open');
    return {
      isOpen,
      status,
      nextOpen: isOpen ? undefined : 'Next trading session: 9:15 AM'
    };
  } catch (error) {
    console.error('Error getting market status:', error);
    // Return default closed status
    return {
      isOpen: false,
      status: 'API not accessible - Please login to Zerodha',
      nextOpen: 'Login required for market status'
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