import { 
  collection, 
  doc, 
  addDoc, 
  getDocs, 
  getDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
  where,
  updateDoc,
  arrayUnion,
  setDoc 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Stock, AddStockForm, HistoricalDataPoint } from '../types/Stock';
import KiteConnectAPI from './KiteConnectAPI';

const STOCKS_COLLECTION = 'stocks';
const HISTORICAL_DATA_COLLECTION = 'historicalData';

// Create KiteConnect API instance
const kiteAPI = KiteConnectAPI.getInstance();

// Cached historical data interface
interface CachedHistoricalData {
  symbol: string;
  exchange: string;
  duration: string;
  data: HistoricalDataPoint[];
  cachedAt: Timestamp;
  updatedAt: Timestamp;
}

// Cache duration in milliseconds (24 hours for historical data)
const HISTORICAL_CACHE_DURATION = 24 * 60 * 60 * 1000;

// Historical data caching functions
const getHistoricalDataCacheKey = (symbol: string, exchange: string, duration: string): string => {
  return `${symbol}_${exchange}_${duration}`;
};

// Save historical data to Firebase cache
const saveHistoricalDataToCache = async (
  symbol: string,
  exchange: string,
  duration: string,
  data: HistoricalDataPoint[]
): Promise<void> => {
  try {
    const cacheKey = getHistoricalDataCacheKey(symbol, exchange, duration);
    const docRef = doc(db, HISTORICAL_DATA_COLLECTION, cacheKey);
    
    console.log(`🔄 SAVING HISTORICAL DATA TO CACHE:`, {
      symbol,
      exchange,
      duration,
      cacheKey,
      dataPoints: data.length,
      firstPoint: data[0],
      lastPoint: data[data.length - 1]
    });
    
    const cachedData: CachedHistoricalData = {
      symbol,
      exchange,
      duration,
      data,
      cachedAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    
    await setDoc(docRef, cachedData);
    console.log(`✅ SUCCESSFULLY CACHED historical data for ${symbol} (${duration}) - ${data.length} points`);
  } catch (error) {
    console.error('❌ ERROR saving historical data to cache:', error);
  }
};

// Get historical data from Firebase cache
const getHistoricalDataFromCache = async (
  symbol: string,
  exchange: string,
  duration: string
): Promise<HistoricalDataPoint[] | null> => {
  try {
    const cacheKey = getHistoricalDataCacheKey(symbol, exchange, duration);
    const docRef = doc(db, HISTORICAL_DATA_COLLECTION, cacheKey);
    
    console.log(`🔍 CHECKING CACHE FOR:`, {
      symbol,
      exchange,
      duration,
      cacheKey
    });
    
    const docSnapshot = await getDoc(docRef);
    
    if (!docSnapshot.exists()) {
      console.log(`❌ NO CACHE FOUND for ${symbol} (${duration})`);
      return null;
    }
    
    const cachedData = docSnapshot.data() as CachedHistoricalData;
    const now = Date.now();
    const cachedAt = cachedData.cachedAt.toMillis();
    const ageHours = (now - cachedAt) / (1000 * 60 * 60);
    
    console.log(`📊 CACHE FOUND:`, {
      symbol,
      duration,
      cachedAt: new Date(cachedAt),
      ageHours: ageHours.toFixed(2),
      dataPoints: cachedData.data.length,
      isExpired: now - cachedAt > HISTORICAL_CACHE_DURATION
    });
    
    // Check if cache is still valid (within 24 hours)
    if (now - cachedAt > HISTORICAL_CACHE_DURATION) {
      console.log(`⏰ CACHE EXPIRED for ${symbol} (${duration}) - age: ${ageHours.toFixed(2)} hours`);
      return null;
    }
    
    console.log(`✅ USING CACHED DATA for ${symbol} (${duration}) - ${cachedData.data.length} points`);
    return cachedData.data;
  } catch (error) {
    console.error('❌ ERROR getting historical data from cache:', error);
    return null;
  }
};

// Get historical data with caching (main function to be used by components)
export const getHistoricalData = async (
  symbol: string,
  exchange: string,
  duration: string,
  forceRefresh: boolean = false
): Promise<HistoricalDataPoint[]> => {
  console.log(`🚀 GET HISTORICAL DATA CALLED:`, {
    symbol,
    exchange,
    duration,
    forceRefresh,
    apiReady: kiteAPI.isReady()
  });

  try {
    // If not forcing refresh, try to get from cache first
    if (!forceRefresh) {
      console.log(`💾 ATTEMPTING CACHE LOOKUP (not forcing refresh)`);
      const cachedData = await getHistoricalDataFromCache(symbol, exchange, duration);
      if (cachedData) {
        console.log(`✅ RETURNING CACHED DATA - ${cachedData.length} points`);
        return cachedData;
      }
    } else {
      console.log(`🔄 FORCING REFRESH - skipping cache lookup`);
    }
    
    // Cache miss or force refresh - fetch from API
    if (!kiteAPI.isReady()) {
      console.warn('⚠️ API NOT AUTHENTICATED - cannot fetch fresh historical data');
      // Return cached data even if expired, or empty array
      const expiredCache = await getHistoricalDataFromCache(symbol, exchange, duration);
      if (expiredCache) {
        console.log(`📊 RETURNING EXPIRED CACHE as fallback - ${expiredCache.length} points`);
        return expiredCache;
      }
      console.log(`❌ NO CACHE AVAILABLE - returning empty array`);
      return [];
    }
    
    // Calculate date range based on duration
    const toDate = new Date();
    const durationMap: Record<string, number> = {
      '1month': 30,
      '6months': 180,
      '1year': 365,
      '3years': 1095,
      '5years': 1825
    };
    
    const days = durationMap[duration] || 365;
    const fromDate = new Date(toDate.getTime() - days * 24 * 60 * 60 * 1000);
    
    console.log(`🌐 FETCHING FRESH DATA FROM API:`, {
      symbol,
      duration,
      fromDate: fromDate.toISOString(),
      toDate: toDate.toISOString(),
      days
    });
    
    const freshData = await kiteAPI.getHistoricalData(symbol, fromDate, toDate, 'day');
    
    if (freshData && freshData.length > 0) {
      console.log(`✅ API RETURNED FRESH DATA - ${freshData.length} points`);
      // Save to cache for future use
      await saveHistoricalDataToCache(symbol, exchange, duration, freshData);
      return freshData;
    }
    
    console.log(`⚠️ API RETURNED NO DATA - trying expired cache`);
    // API returned no data, try to return expired cache or empty array
    const expiredCache = await getHistoricalDataFromCache(symbol, exchange, duration);
    if (expiredCache) {
      console.log(`📊 RETURNING EXPIRED CACHE as fallback - ${expiredCache.length} points`);
      return expiredCache;
    }
    console.log(`❌ NO FALLBACK AVAILABLE - returning empty array`);
    return [];
    
  } catch (error) {
    console.error(`❌ ERROR getting historical data for ${symbol}:`, error);
    
    // On error, try to return cached data (even if expired)
    console.log(`🔄 ATTEMPTING FALLBACK TO CACHE after error`);
    const fallbackCache = await getHistoricalDataFromCache(symbol, exchange, duration);
    if (fallbackCache) {
      console.log(`📊 RETURNING CACHE as error fallback - ${fallbackCache.length} points`);
      return fallbackCache;
    }
    console.log(`❌ NO FALLBACK AVAILABLE - returning empty array after error`);
    return [];
  }
};

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

// Helper function to save cached price data to Firebase
const saveCachedPriceData = async (stockId: string, stockData: Stock): Promise<void> => {
  try {
    const stockRef = doc(db, STOCKS_COLLECTION, stockId);
    
    // Filter out undefined values to prevent Firebase errors
    const rawCachedPriceData = {
      price: stockData.price,
      change: stockData.change,
      changePercent: stockData.changePercent,
      volume: stockData.volume,
      marketCap: stockData.marketCap,
      currency: stockData.currency,
      previousClose: stockData.previousClose,
      dayHigh: stockData.dayHigh,
      dayLow: stockData.dayLow,
      fiftyTwoWeekHigh: stockData.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: stockData.fiftyTwoWeekLow,
      lastUpdated: Timestamp.now()
    };
    
    // Remove undefined values to prevent Firestore errors
    const cachedPriceData = Object.fromEntries(
      Object.entries(rawCachedPriceData).filter(([, value]) => value !== undefined)
    );
    
    await updateDoc(stockRef, {
      cachedPriceData: cachedPriceData,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Error saving cached price data:', error);
    throw new Error('Failed to save price data');
  }
};

// Function to refresh price data for a specific stock
export const refreshStockPrice = async (stockId: string, symbol: string, exchange: string): Promise<Stock> => {
  try {
    console.log(`Refreshing price for ${symbol} on ${exchange}`);
    
    // Check if API is authenticated
    if (!kiteAPI.isReady()) {
      throw new Error('KiteConnect API not authenticated. Please log in to Zerodha to refresh stock prices.');
    }
    
    // Fetch fresh data from API
    const stockDetails = await kiteAPI.getStockQuote(symbol, exchange);
    
    if (!stockDetails) {
      throw new Error(`Unable to fetch fresh data for ${symbol}. Please check if the symbol is valid and currently trading.`);
    }
    
    // Save the fresh data to Firebase cache
    await saveCachedPriceData(stockId, stockDetails);
    
    // Get the metadata to include tags
    const stockRef = doc(db, STOCKS_COLLECTION, stockId);
    const docSnapshot = await getDoc(stockRef);
    const metadata = docSnapshot.data();
    
    return {
      ...stockDetails,
      id: stockId,
      tags: metadata?.tags || []
    };
    
  } catch (error) {
    console.error('Error refreshing stock price:', error);
    // Provide more specific error message
    if (error instanceof Error) {
      throw error; // Re-throw with original message
    }
    throw new Error('Failed to refresh stock price. Please try again.');
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
        const stockDetails = await kiteAPI.getStockQuote(stockData.symbol, stockData.exchange);
        if (stockDetails) {
          return {
            ...stockDetails,
            id: existingStock.id,
            tags: existingStock.tags
          };
        }
      }        // Return basic structure if API not available
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
        const stockDetails = await kiteAPI.getStockQuote(stockData.symbol, stockData.exchange);
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
    const stockDetails = await kiteAPI.getStockQuote(stockData.symbol, stockData.exchange);
    
    if (!stockDetails) {
      if (stockData.exchange === 'BSE') {
        throw new Error(`BSE stock ${stockData.symbol} not found. BSE stocks require valid instrument tokens or trading symbols. Please check if this stock exists on BSE through KiteConnect.`);
      } else {
        throw new Error(`Stock ${stockData.symbol} not found on ${stockData.exchange}. Please verify the symbol is correct and currently trading.`);
      }
    }
    
    // Store metadata AND cached price data in Firebase
    const rawCachedPriceData = {
      price: stockDetails.price,
      change: stockDetails.change,
      changePercent: stockDetails.changePercent,
      volume: stockDetails.volume,
      marketCap: stockDetails.marketCap,
      currency: stockDetails.currency,
      previousClose: stockDetails.previousClose,
      dayHigh: stockDetails.dayHigh,
      dayLow: stockDetails.dayLow,
      fiftyTwoWeekHigh: stockDetails.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: stockDetails.fiftyTwoWeekLow,
      lastUpdated: Timestamp.now()
    };

    // Filter out undefined values to avoid Firebase errors
    const cachedPriceData = Object.fromEntries(
      Object.entries(rawCachedPriceData).filter(([, value]) => value !== undefined)
    );

    const stockDocument = {
      symbol: stockData.symbol,
      name: stockData.name,
      exchange: stockData.exchange,
      tags: stockData.tags || [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      cachedPriceData: cachedPriceData
    };

    const docRef = await addDoc(collection(db, STOCKS_COLLECTION), stockDocument);

    // Return the stock data with cached price info
    const returnCachedData = {
      price: stockDetails.price || 0,
      change: stockDetails.change || 0,
      changePercent: stockDetails.changePercent || 0,
      ...cachedPriceData,
      lastUpdated: rawCachedPriceData.lastUpdated.toDate()
    };

    return {
      ...stockDetails,
      id: docRef.id,
      tags: stockData.tags || [],
      cachedPriceData: returnCachedData
    };
  } catch (error) {
    console.error('Error adding/updating stock:', error);
    throw new Error('Failed to add stock. Please check the symbol and try again.');
  }
};

// Get all stocks from Firestore using cached price data
export const getStocks = async (): Promise<Stock[]> => {
  try {
    const querySnapshot = await getDocs(
      query(collection(db, STOCKS_COLLECTION), orderBy('createdAt', 'desc'))
    );
    
    const stocks: Stock[] = [];
    
    querySnapshot.forEach((doc) => {
      const metadata = doc.data();
      
      // Use cached price data if available, otherwise return stock with zero prices
      if (metadata.cachedPriceData) {
        const cachedData = metadata.cachedPriceData;
        stocks.push({
          id: doc.id,
          symbol: metadata.symbol,
          name: metadata.name,
          price: cachedData.price || 0,
          change: cachedData.change || 0,
          changePercent: cachedData.changePercent || 0,
          volume: cachedData.volume,
          marketCap: cachedData.marketCap || 'N/A',
          currency: cachedData.currency || 'INR',
          previousClose: cachedData.previousClose,
          dayHigh: cachedData.dayHigh,
          dayLow: cachedData.dayLow,
          fiftyTwoWeekHigh: cachedData.fiftyTwoWeekHigh,
          fiftyTwoWeekLow: cachedData.fiftyTwoWeekLow,
          exchange: metadata.exchange as 'NSE' | 'BSE',
          tags: metadata.tags || [],
          cachedPriceData: {
            ...cachedData,
            lastUpdated: cachedData.lastUpdated?.toDate() || new Date() // Convert Firestore timestamp to Date
          }
        });
      } else {
        // No cached data available - show stock with empty price data
        stocks.push({
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
        });
      }
    });
    
    return stocks;
  } catch (error) {
    console.error('Error getting stocks:', error);
    throw new Error('Failed to fetch stocks');
  }
};

// Subscribe to real-time metadata updates from Firebase and use cached price data
export const subscribeToStocks = (callback: (stocks: Stock[]) => void): (() => void) => {
  const q = query(collection(db, STOCKS_COLLECTION), orderBy('createdAt', 'desc'));
  
  return onSnapshot(q, async (querySnapshot) => {
    const stocks: Stock[] = [];
    
    querySnapshot.forEach((doc) => {
      const metadata = doc.data();
      
      // Use cached price data if available, otherwise return stock with zero prices
      if (metadata.cachedPriceData) {
        const cachedData = metadata.cachedPriceData;
        stocks.push({
          id: doc.id,
          symbol: metadata.symbol,
          name: metadata.name,
          price: cachedData.price || 0,
          change: cachedData.change || 0,
          changePercent: cachedData.changePercent || 0,
          volume: cachedData.volume,
          marketCap: cachedData.marketCap || 'N/A',
          currency: cachedData.currency || 'INR',
          previousClose: cachedData.previousClose,
          dayHigh: cachedData.dayHigh,
          dayLow: cachedData.dayLow,
          fiftyTwoWeekHigh: cachedData.fiftyTwoWeekHigh,
          fiftyTwoWeekLow: cachedData.fiftyTwoWeekLow,
          exchange: metadata.exchange as 'NSE' | 'BSE',
          tags: metadata.tags || [],
          cachedPriceData: {
            ...cachedData,
            lastUpdated: cachedData.lastUpdated?.toDate() || new Date() // Convert Firestore timestamp to Date
          }
        });
      } else {
        // No cached data available - show stock with empty price data
        stocks.push({
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
        });
      }
    });
    
    callback(stocks);
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

// Clear expired historical data cache
export const clearExpiredHistoricalCache = async (): Promise<number> => {
  try {
    console.log('Checking for expired historical data cache...');
    
    const querySnapshot = await getDocs(collection(db, HISTORICAL_DATA_COLLECTION));
    const now = Date.now();
    let deletedCount = 0;
    
    const deletePromises: Promise<void>[] = [];
    
    querySnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data() as CachedHistoricalData;
      const cachedAt = data.cachedAt.toMillis();
      
      // Check if cache is expired (older than 24 hours)
      if (now - cachedAt > HISTORICAL_CACHE_DURATION) {
        console.log(`Deleting expired cache for ${data.symbol} (${data.duration})`);
        deletePromises.push(deleteDoc(doc(db, HISTORICAL_DATA_COLLECTION, docSnapshot.id)));
        deletedCount++;
      }
    });
    
    if (deletePromises.length > 0) {
      await Promise.all(deletePromises);
      console.log(`Cleared ${deletedCount} expired historical data cache entries`);
    } else {
      console.log('No expired cache entries found');
    }
    
    return deletedCount;
  } catch (error) {
    console.error('Error clearing expired historical cache:', error);
    return 0;
  }
};

// Refresh all cached historical data for a specific stock
export const refreshAllHistoricalDataForStock = async (
  symbol: string, 
  exchange: string
): Promise<void> => {
  try {
    const durations = ['1month', '6months', '1year', '3years', '5years'];
    const refreshPromises = durations.map(duration => 
      getHistoricalData(symbol, exchange, duration, true) // Force refresh
    );
    
    await Promise.all(refreshPromises);
    console.log(`Refreshed all historical data for ${symbol}`);
  } catch (error) {
    console.error(`Error refreshing historical data for ${symbol}:`, error);
    throw error;
  }
};