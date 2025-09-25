import { 
  collection, 
  doc, 
  addDoc, 
  getDocs, 
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
  where,
  updateDoc,
  arrayUnion 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Stock, AddStockForm } from '../types/Stock';
import KiteConnectAPI from './KiteConnectAPI';

const STOCKS_COLLECTION = 'stocks';

// Create KiteConnect API instance
const kiteAPI = KiteConnectAPI.getInstance();

// Helper function to find existing stock by symbol and exchange
const findExistingStock = async (symbol: string, exchange: string): Promise<{ id: string; tags: string[] } | null> => {
  try {
    const q = query(
      collection(db, STOCKS_COLLECTION),
      where('symbol', '==', symbol),
      where('exchange', '==', exchange)
    );
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    // Return the first match (there should only be one)
    const doc = querySnapshot.docs[0];
    const data = doc.data();
    return {
      id: doc.id,
      tags: data.tags || []
    };
  } catch (error) {
    console.error('Error finding existing stock:', error);
    return null;
  }
};

// Helper function to update tags for existing stock
const updateStockTags = async (stockId: string, newTags: string[]): Promise<void> => {
  try {
    const stockRef = doc(db, STOCKS_COLLECTION, stockId);
    
    // Use arrayUnion to add new tags without duplicates
    await updateDoc(stockRef, {
      tags: arrayUnion(...newTags),
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Error updating stock tags:', error);
    throw new Error('Failed to update stock tags');
  }
};

// Add a new stock to Firestore - only metadata, no price data
// If stock already exists, only add new tags that aren't already present
export const addStock = async (stockData: AddStockForm): Promise<Stock> => {
  try {
    console.log(`Adding/updating stock: ${stockData.symbol} on ${stockData.exchange}`);
    
    // Check if stock already exists
    const existingStock = await findExistingStock(stockData.symbol, stockData.exchange);
    
    if (existingStock) {
      console.log(`Stock ${stockData.symbol} already exists. Checking tags...`);
      
      // Filter out tags that already exist
      const newTags = (stockData.tags || []).filter(tag => 
        !existingStock.tags.includes(tag)
      );
      
      if (newTags.length === 0) {
        console.log(`All tags already exist for ${stockData.symbol}. No updates needed.`);
        // Return existing stock data with live prices if available
        if (kiteAPI.isReady()) {
          const stockDetails = await kiteAPI.getStockQuote(stockData.symbol);
          if (stockDetails) {
            return {
              ...stockDetails,
              id: existingStock.id,
              tags: existingStock.tags
            };
          }
        }
        
        // Return basic structure if API not available
        return {
          id: existingStock.id,
          symbol: stockData.symbol,
          name: stockData.name,
          price: 0,
          change: 0,
          changePercent: 0,
          exchange: stockData.exchange,
          currency: 'INR',
          marketCap: 'N/A',
          tags: existingStock.tags
        };
      }
      
      // Add only new tags
      console.log(`Adding new tags [${newTags.join(', ')}] to existing stock ${stockData.symbol}`);
      await updateStockTags(existingStock.id, newTags);
      
      // Return updated stock data with live prices if available
      const updatedTags = [...existingStock.tags, ...newTags];
      if (kiteAPI.isReady()) {
        const stockDetails = await kiteAPI.getStockQuote(stockData.symbol);
        if (stockDetails) {
          return {
            ...stockDetails,
            id: existingStock.id,
            tags: updatedTags
          };
        }
      }
      
      // Return basic structure if API not available
      return {
        id: existingStock.id,
        symbol: stockData.symbol,
        name: stockData.name,
        price: 0,
        change: 0,
        changePercent: 0,
        exchange: stockData.exchange,
        currency: 'INR',
        marketCap: 'N/A',
        tags: updatedTags
      };
    }
    
    // Stock doesn't exist, create new one
    console.log(`Creating new stock entry for ${stockData.symbol}`);
    
    // Check if API is authenticated before trying to verify stock
    if (!kiteAPI.isReady()) {
      console.warn('API not authenticated - adding stock metadata only');
      
      // Add only metadata without API verification
      const stockDocument = {
        symbol: stockData.symbol,
        name: stockData.name,
        exchange: stockData.exchange,
        tags: stockData.tags || [],
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
        marketCap: 'N/A',
        tags: stockData.tags || []
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
      tags: stockData.tags || [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    const docRef = await addDoc(collection(db, STOCKS_COLLECTION), stockDocument);

    // Return the live API data with the Firebase ID and tags
    return {
      ...stockDetails,
      id: docRef.id,
      tags: stockData.tags || []
    };
  } catch (error) {
    console.error('Error adding/updating stock:', error);
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
      const metadata = doc.data(); // Only contains symbol, name, exchange, tags, timestamps
      
      // Fetch ALL price data from API - nothing from database
      const stockPromise = kiteAPI.getStockQuote(metadata.symbol)
        .then(stockDetails => {
          if (stockDetails) {
            return {
              ...stockDetails,
              id: doc.id, // Only use the Firebase ID, all other data from API
              tags: metadata.tags || [] // Include tags from metadata
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
              marketCap: 'N/A',
              tags: metadata.tags || []
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
            marketCap: 'N/A',
            tags: metadata.tags || []
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
                id: doc.id, // Only Firebase ID, everything else from API
                tags: metadata.tags || [] // Include tags from metadata
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
                marketCap: 'N/A',
                tags: metadata.tags || []
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
              marketCap: 'N/A',
              tags: metadata.tags || []
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
          marketCap: 'N/A',
          tags: metadata.tags || []
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