import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
const PORT = 3001;

// Enable CORS for our frontend
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:5174", "http://localhost:3000"],
  credentials: true
}));

app.use(express.json());

// Cookie store for NSE session management
let nseCookies = "";
let lastCookieUpdate = 0;
const COOKIE_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Helper function to get fresh NSE cookies
async function refreshNSECookies() {
  try {
    console.log("🔄 Refreshing NSE session cookies...");
    const response = await fetch("https://www.nseindia.com/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "DNT": "1",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      }
    });

    const setCookieHeaders = response.headers.raw()['set-cookie'];
    if (setCookieHeaders) {
      nseCookies = setCookieHeaders.map(cookie => cookie.split(';')[0]).join('; ');
      lastCookieUpdate = Date.now();
      console.log("✅ NSE cookies refreshed successfully");
    }
  } catch (error) {
    console.error("❌ Failed to refresh NSE cookies:", error.message);
  }
}

// Helper function to ensure we have valid cookies
async function ensureValidCookies() {
  if (!nseCookies || Date.now() - lastCookieUpdate > COOKIE_REFRESH_INTERVAL) {
    await refreshNSECookies();
  }
}

// Helper function to make NSE API requests
async function makeNSERequest(endpoint, retries = 3) {
  await ensureValidCookies();
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`📡 Making NSE request (attempt ${attempt}): ${endpoint}`);
      
      const response = await fetch(endpoint, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          "Accept": "application/json,text/plain,*/*",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          "Referer": "https://www.nseindia.com/",
          "DNT": "1",
          "Connection": "keep-alive",
          "Cookie": nseCookies,
        }
      });

      if (response.status === 200) {
        const data = await response.json();
        console.log(`✅ NSE request successful: ${endpoint}`);
        return { success: true, data };
      } else if (response.status === 403 || response.status === 451) {
        console.log(`⚠️  NSE blocked request (${response.status}), refreshing cookies...`);
        await refreshNSECookies();
        continue;
      } else {
        const text = await response.text();
        console.log(`❌ NSE request failed (${response.status}): ${text.slice(0, 200)}`);
        return { success: false, error: `NSE API error: ${response.status}`, status: response.status };
      }
    } catch (error) {
      console.error(`❌ NSE request error (attempt ${attempt}):`, error.message);
      if (attempt === retries) {
        return { success: false, error: error.message };
      }
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

// Get stock quote
app.get("/api/nse/quote", async (req, res) => {
  const symbol = (req.query.symbol || "").toString().toUpperCase().trim();
  
  if (!symbol) {
    return res.status(400).json({ error: "symbol parameter is required" });
  }

  console.log(`📊 Fetching quote for: ${symbol}`);
  
  const result = await makeNSERequest(
    `https://www.nseindia.com/api/quote-equity?symbol=${encodeURIComponent(symbol)}`
  );
  
  if (result.success) {
    res.json(result.data);
  } else {
    res.status(result.status || 500).json({ error: result.error });
  }
});

// Get all stock symbols
app.get("/api/nse/symbols", async (req, res) => {
  console.log("📋 Fetching all NSE symbols...");
  
  const result = await makeNSERequest(
    "https://www.nseindia.com/api/equity-stockIndices?index=SECURITIES%20IN%20F%26O"
  );
  
  if (result.success && result.data && result.data.data) {
    // Extract symbols from the response
    const symbols = result.data.data.map(item => item.symbol).filter(Boolean);
    console.log(`✅ Fetched ${symbols.length} symbols`);
    res.json({ symbols: symbols.slice(0, 500) }); // Limit to 500 symbols
  } else {
    // Fallback with common symbols
    const fallbackSymbols = [
      "RELIANCE", "TCS", "HDFCBANK", "INFY", "HINDUNILVR", "ICICIBANK", "KOTAKBANK", 
      "BHARTIARTL", "ITC", "SBIN", "LT", "ASIANPAINT", "AXISBANK", "MARUTI", "BAJFINANCE",
      "HCLTECH", "DMART", "SUNPHARMA", "TITAN", "ULTRACEMCO", "NESTLEIND", "WIPRO",
      "ADANIENT", "JSWSTEEL", "POWERGRID", "TATAMOTORS", "NTPC", "COALINDIA", "ONGC",
      "GRASIM", "BAJAJFINSV", "HINDALCO", "TECHM", "INDUSINDBK", "DRREDDY", "CIPLA",
      "EICHERMOT", "BRITANNIA", "DIVISLAB", "APOLLOHOSP", "BPCL", "TATACONSUM", "IOC",
      "PIDILITIND", "GODREJCP", "SIEMENS", "UPL", "DABUR", "BAJAJ-AUTO", "HEROMOTOCO"
    ];
    
    console.log("⚠️  Using fallback symbols");
    res.json({ symbols: fallbackSymbols });
  }
});

// Get market status
app.get("/api/nse/market-status", async (req, res) => {
  console.log("🏛️  Fetching market status...");
  
  const result = await makeNSERequest(
    "https://www.nseindia.com/api/marketStatus"
  );
  
  if (result.success) {
    res.json(result.data);
  } else {
    // Fallback market status
    const now = new Date();
    const istTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
    const hour = istTime.getHours();
    const day = istTime.getDay();
    
    // Market is open Monday-Friday 9:15 AM to 3:30 PM IST
    const isMarketHours = day >= 1 && day <= 5 && hour >= 9 && hour < 16;
    
    res.json({
      marketState: [{
        market: "Capital Market",
        marketStatus: isMarketHours ? "Open" : "Closed",
        tradeDate: istTime.toISOString().split('T')[0],
        index: "NIFTY 50"
      }]
    });
  }
});

// Get top gainers/losers
app.get("/api/nse/top-stocks", async (req, res) => {
  console.log("📈 Fetching top stocks...");
  
  const result = await makeNSERequest(
    "https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%2050"
  );
  
  if (result.success && result.data && result.data.data) {
    const stocks = result.data.data.slice(0, 20).map(stock => ({
      symbol: stock.symbol,
      name: stock.companyName || stock.symbol,
      price: stock.lastPrice || 0,
      change: stock.change || 0,
      changePercent: stock.pChange || 0,
      volume: stock.totalTradedVolume || 0,
      marketCap: stock.meta?.companyName || "N/A"
    }));
    
    console.log(`✅ Fetched ${stocks.length} top stocks`);
    res.json({ stocks });
  } else {
    res.status(500).json({ error: "Failed to fetch top stocks" });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    cookiesLastUpdated: new Date(lastCookieUpdate).toISOString(),
    cookiesValid: nseCookies.length > 0 && Date.now() - lastCookieUpdate < COOKIE_REFRESH_INTERVAL
  });
});

// Initialize cookies on startup
refreshNSECookies();

app.listen(PORT, () => {
  console.log(`🚀 NSE Proxy Server running on http://localhost:${PORT}`);
  console.log(`📊 Available endpoints:`);
  console.log(`   GET /api/nse/quote?symbol=SYMBOL`);
  console.log(`   GET /api/nse/symbols`);
  console.log(`   GET /api/nse/market-status`);
  console.log(`   GET /api/nse/top-stocks`);
  console.log(`   GET /api/health`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down proxy server...');
  process.exit(0);
});