"use strict";

const { onRequest } = require("firebase-functions/v2/https");
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const session = require("express-session");
const MemoryStore = require("memorystore");
const { KiteConnect } = require("kiteconnect");

const app = express();
app.set("trust proxy", 1);

// Per-instance in-memory stores (cleared on cold start — Bearer token auth handles this gracefully)
const tokenStore = new Map();
const instrumentsCache = new Map();
let instrumentsLoaded = false;
let kiteService = null;

// KiteConnect is lazily initialised so it picks up env vars injected at request time
function getKiteService() {
  if (!kiteService && process.env.KITE_API_KEY) {
    kiteService = new KiteConnect({ api_key: process.env.KITE_API_KEY });
    console.log("KiteConnect service initialised");
  }
  return kiteService;
}

// Load NSE/BSE instrument metadata (cached per instance lifetime)
async function loadInstruments() {
  const kite = getKiteService();
  if (instrumentsLoaded || !kite) return;
  try {
    console.log("Loading instruments from KiteConnect...");
    const [nse, bse] = await Promise.all([
      kite.getInstruments("NSE"),
      kite.getInstruments("BSE"),
    ]);
    [...nse, ...bse].forEach((inst) => {
      if (inst.instrument_type === "EQ") {
        instrumentsCache.set(inst.tradingsymbol, {
          instrument_token: inst.instrument_token,
          name: inst.name,
          exchange: inst.exchange,
        });
      }
    });
    instrumentsLoaded = true;
    console.log(`Loaded ${instrumentsCache.size} equity instruments`);
  } catch (err) {
    console.error("Failed to load instruments:", err.message);
  }
}

function getInstrumentToken(symbol) {
  const inst = instrumentsCache.get(symbol);
  return inst ? inst.instrument_token : null;
}

// ── Middleware ────────────────────────────────────────────────────────────────

const MemoryStoreSession = MemoryStore(session);

app.use(cors({
  origin: [
    "http://localhost:5174",
    "http://localhost:5173",
    "https://screener-d132c.web.app",
    "https://screener-d132c.firebaseapp.com",
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
}));

app.use(session({
  store: new MemoryStoreSession({ checkPeriod: 86400000 }),
  secret: process.env.SESSION_SECRET || "firebase-session-secret",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: true, httpOnly: true, sameSite: "lax", maxAge: 24 * 60 * 60 * 1000 },
}));

// ── Auth middleware ───────────────────────────────────────────────────────────

function requireAuth(req, res, next) {
  const kite = getKiteService();
  const auth = req.headers["authorization"];

  if (auth && auth.startsWith("Bearer ")) {
    const token = auth.slice(7);
    const stored = tokenStore.get(token);

    if (stored) {
      if (kite) kite.setAccessToken(stored.access_token);
      return next();
    }

    // Token not in store (cold start) — re-validate against KiteConnect
    if (kite) {
      kite.setAccessToken(token);
      return kite.getProfile()
        .then((profile) => {
          tokenStore.set(token, {
            access_token: token,
            user_id: profile.user_id,
            user_name: profile.user_name,
            authenticated: true,
          });
          next();
        })
        .catch(() => requireAuthSession(req, res, next));
    }
  }

  requireAuthSession(req, res, next);
}

function requireAuthSession(req, res, next) {
  if (!req.session.kiteAuth) {
    return res.status(401).json({ error: "Authentication required", message: "Please login with Zerodha first" });
  }
  const kite = getKiteService();
  if (kite) kite.setAccessToken(req.session.kiteAuth.access_token);
  next();
}

function checkService(req, res, next) {
  if (!getKiteService()) {
    return res.status(503).json({ error: "KiteConnect not configured — check KITE_API_KEY environment variable" });
  }
  next();
}

// ── Routes ────────────────────────────────────────────────────────────────────

app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString(), kiteService: !!getKiteService() });
});

app.get("/auth/login", checkService, (req, res) => {
  try {
    res.json({ loginURL: getKiteService().getLoginURL() });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate login URL", details: err.message });
  }
});

app.post("/auth/session", checkService, async (req, res) => {
  const { request_token } = req.body;
  if (!request_token) return res.status(400).json({ error: "request_token is required" });

  try {
    const kite = getKiteService();
    const data = await kite.generateSession(request_token, process.env.KITE_API_SECRET);
    const authData = {
      access_token: data.access_token,
      user_id: data.user_id,
      user_name: data.user_name,
      authenticated: true,
      timestamp: new Date().toISOString(),
    };

    tokenStore.set(data.access_token, authData);
    req.session.kiteAuth = authData;
    kite.setAccessToken(data.access_token);

    await new Promise((resolve) => req.session.save((err) => { if (err) console.warn("Session save error:", err); resolve(); }));

    res.json({
      success: true,
      message: "Authentication successful",
      access_token: data.access_token,
      user: {
        user_id: data.user_id,
        user_name: data.user_name,
        user_shortname: data.user_shortname,
        avatar_url: data.avatar_url,
        broker: data.broker,
      },
    });
  } catch (err) {
    console.error("Auth session error:", err.message);
    res.status(401).json({ error: "Authentication failed", details: err.message });
  }
});

app.get("/auth/status", async (req, res) => {
  let userData = null;
  const auth = req.headers["authorization"];

  if (auth && auth.startsWith("Bearer ")) {
    const token = auth.slice(7);
    userData = tokenStore.get(token) || null;

    if (!userData && getKiteService()) {
      try {
        getKiteService().setAccessToken(token);
        const profile = await getKiteService().getProfile();
        userData = { access_token: token, user_id: profile.user_id, user_name: profile.user_name, authenticated: true };
        tokenStore.set(token, userData);
      } catch (_) { userData = null; }
    }
  }

  if (!userData) userData = req.session.kiteAuth || null;
  const ok = !!(userData && userData.authenticated);
  res.json({ authenticated: ok, user: ok ? { user_id: userData.user_id, user_name: userData.user_name } : null });
});

app.post("/auth/logout", (req, res) => {
  const auth = req.headers["authorization"];
  if (auth && auth.startsWith("Bearer ")) tokenStore.delete(auth.slice(7));
  if (req.session.kiteAuth) tokenStore.delete(req.session.kiteAuth.access_token);

  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: "Failed to logout" });
    res.json({ success: true, message: "Logged out successfully" });
  });
});

// ── Stock routes ──────────────────────────────────────────────────────────────

app.get("/api/stocks/quote/:symbol", requireAuth, checkService, async (req, res) => {
  try {
    const { symbol } = req.params;
    const { exchange } = req.query;
    await loadInstruments();

    const ex = (exchange === "NSE" || exchange === "BSE") ? exchange : "NSE";
    const clean = symbol.replace(/\.(NS|BO|BSE)\.?$/i, "").replace(/^(NSE|BSE):/i, "").toUpperCase();
    const kiteSymbol = `${ex}:${clean}`;
    const quote = await getKiteService().getQuote(kiteSymbol);
    const d = quote[kiteSymbol];
    if (!d) throw new Error(`No data for ${symbol}`);

    const inst = instrumentsCache.get(clean);
    res.json({
      success: true,
      data: {
        id: (getInstrumentToken(clean) || "").toString() || symbol,
        symbol: clean,
        name: inst ? inst.name : `${clean} Limited`,
        price: d.last_price,
        change: d.net_change,
        changePercent: (d.net_change / d.last_price) * 100,
        volume: d.volume,
        exchange: ex,
        currency: "INR",
        previousClose: d.last_price - d.net_change,
        dayHigh: d.ohlc.high,
        dayLow: d.ohlc.low,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get stock quote", details: err.message, symbol: req.params.symbol });
  }
});

app.post("/api/stocks/multiple", requireAuth, checkService, async (req, res) => {
  try {
    const { symbols } = req.body;
    if (!Array.isArray(symbols) || symbols.length === 0) return res.status(400).json({ error: "symbols array required" });
    if (symbols.length > 100) return res.status(400).json({ error: "Maximum 100 symbols per request" });

    await loadInstruments();
    const keys = symbols.map((s) => `NSE:${s.toUpperCase()}`);
    const quotes = await getKiteService().getQuote(keys);

    const results = symbols.map((symbol) => {
      const d = quotes[`NSE:${symbol.toUpperCase()}`];
      if (!d) return null;
      const inst = instrumentsCache.get(symbol.toUpperCase());
      return {
        id: (getInstrumentToken(symbol.toUpperCase()) || "").toString() || symbol,
        symbol: symbol.toUpperCase(),
        name: inst ? inst.name : `${symbol.toUpperCase()} Limited`,
        price: d.last_price,
        change: d.net_change,
        changePercent: (d.net_change / d.last_price) * 100,
        volume: d.volume,
        exchange: "NSE",
        currency: "INR",
        previousClose: d.last_price - d.net_change,
        dayHigh: d.ohlc.high,
        dayLow: d.ohlc.low,
        timestamp: new Date().toISOString(),
      };
    }).filter(Boolean);

    res.json({ success: true, data: results, count: results.length, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to get multiple quotes", details: err.message });
  }
});

app.get("/api/stocks/top", requireAuth, checkService, async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);

  const nifty50 = [
    "RELIANCE", "TCS", "HDFCBANK", "INFY", "HINDUNILVR",
    "ICICIBANK", "KOTAKBANK", "SBIN", "BHARTIARTL", "ITC",
    "ASIANPAINT", "LT", "AXISBANK", "MARUTI", "SUNPHARMA",
    "TITAN", "ULTRACEMCO", "NESTLEIND", "WIPRO", "M&M",
    "NTPC", "HCLTECH", "TECHM", "POWERGRID", "TATAMOTORS",
    "BAJFINANCE", "COALINDIA", "ONGC", "GRASIM", "BAJAJFINSV",
    "ADANIPORTS", "TATASTEEL", "CIPLA", "DRREDDY", "EICHERMOT",
    "IOC", "HINDALCO", "BRITANNIA", "DIVISLAB", "INDUSINDBK",
    "JSWSTEEL", "SHREECEM", "APOLLOHOSP", "HEROMOTOCO", "UPL",
    "BAJAJ-AUTO", "SBILIFE", "HDFCLIFE", "BPCL", "TATACONSUM",
  ];

  try {
    await loadInstruments();
    const symbols = nifty50.slice(0, limit);
    const keys = symbols.map((s) => `NSE:${s}`);
    const quotes = await getKiteService().getQuote(keys);

    const results = symbols.map((symbol) => {
      const d = quotes[`NSE:${symbol}`];
      if (!d) return null;
      const inst = instrumentsCache.get(symbol);
      return {
        id: (getInstrumentToken(symbol) || "").toString() || symbol,
        symbol,
        name: inst ? inst.name : `${symbol} Limited`,
        price: d.last_price,
        change: d.net_change,
        changePercent: (d.net_change / d.last_price) * 100,
        volume: d.volume,
        exchange: "NSE",
        currency: "INR",
        previousClose: d.last_price - d.net_change,
        dayHigh: d.ohlc.high,
        dayLow: d.ohlc.low,
        timestamp: new Date().toISOString(),
      };
    }).filter(Boolean);

    res.json({ success: true, data: results, count: results.length, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to get top stocks", details: err.message });
  }
});

app.get("/api/stocks/historical/:symbol", requireAuth, checkService, async (req, res) => {
  try {
    const { symbol } = req.params;
    const { from, to, interval = "day" } = req.query;

    if (!from || !to) return res.status(400).json({ error: "from and to date parameters are required (YYYY-MM-DD)" });

    await loadInstruments();
    const token = getInstrumentToken(symbol.toUpperCase());
    if (!token) return res.status(404).json({ error: `Instrument not found: ${symbol}` });

    const data = await getKiteService().getHistoricalData(token, interval, from, to);
    res.json({
      success: true,
      data: data.map((p) => ({ date: p.date, open: p.open, high: p.high, low: p.low, close: p.close, volume: p.volume })),
      count: data.length,
      symbol: symbol.toUpperCase(),
      from,
      to,
      interval,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get historical data", details: err.message });
  }
});

// ── NSE Equity instruments — used by the temporary import page ───────────────

// In-memory NSE equity cache for this function instance (24h TTL)
let nseEquityCache = null;
let nseEquityCacheTime = null;
const NSE_CACHE_DURATION = 24 * 60 * 60 * 1000;

const ensureNseEquityCache = async (kite, forceRefresh = false) => {
  if (!forceRefresh && nseEquityCache && nseEquityCacheTime && Date.now() - nseEquityCacheTime < NSE_CACHE_DURATION) {
    return nseEquityCache;
  }
  console.log("[NSE_IMPORT] Fetching NSE instruments from Zerodha...");
  const instruments = await kite.getInstruments("NSE");
  // instrument_type === 'EQ' excludes futures/options/bonds in most cases.
  // The suffix exclusion removes special NSE series that still carry type 'EQ':
  // -SG (G-Secs/SDL), -BE (trade-for-trade), -N0/-N1/-N2 (odd-lot), -BL, -IL.
  const NON_EQUITY_SUFFIX = /-(SG|BE|N0|N1|N2|BL|IL|SM|EM)$/;
  nseEquityCache = instruments.filter(
    inst => inst.instrument_type === "EQ" && !NON_EQUITY_SUFFIX.test(inst.tradingsymbol)
  ).map(inst => ({
    symbol: inst.tradingsymbol,
    name: inst.name,
    exchange: inst.exchange,
    instrument_token: inst.instrument_token,
    isin: inst.isin || null,
    tick_size: inst.tick_size,
    lot_size: inst.lot_size,
  }));
  nseEquityCacheTime = Date.now();
  console.log(`[NSE_IMPORT] Cached ${nseEquityCache.length} NSE equity instruments`);
  return nseEquityCache;
};

app.get("/api/instruments/nse/equity", requireAuth, checkService, async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === "true";
    if (forceRefresh) { nseEquityCache = null; nseEquityCacheTime = null; }
    const equities = await ensureNseEquityCache(getKiteService(), forceRefresh);
    res.json({
      success: true,
      data: equities,
      metadata: {
        total_count: equities.length,
        cached: true,
        cached_at: nseEquityCacheTime ? new Date(nseEquityCacheTime).toISOString() : null,
        expires_at: nseEquityCacheTime ? new Date(nseEquityCacheTime + NSE_CACHE_DURATION).toISOString() : null,
      },
    });
  } catch (err) {
    console.error("[NSE_IMPORT] Error:", err.message);
    res.status(500).json({ success: false, message: "Failed to fetch NSE equity list", error: err.message });
  }
});

// ── NSE Official Industry Classification — static archive CSV ───────────────
// Kite Connect has no sector/industry/fundamentals data at all — this pulls
// NSE's own official index-constituent list (covers ~750 index-member stocks,
// not the full universe) as a much more accurate alternative to guessing
// sector from the company name.

let nseIndustryCache = null;
let nseIndustryCacheTime = null;
const NSE_INDUSTRY_CACHE_DURATION = 24 * 60 * 60 * 1000;
const NSE_INDUSTRY_CSV_URL = "https://archives.nseindia.com/content/indices/ind_niftytotalmarket_list.csv";

// Minimal quote-aware CSV line splitter — company names can contain commas
// inside quoted fields (e.g. `"XYZ, Ltd"`).
function splitCsvLine(line) {
  const cells = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "\"") {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

// Parses NSE's official index-constituent CSV (columns: Company Name, Industry,
// Symbol, Series, ISIN Code) into a flat { symbol: industry } map. Parses by
// header name, not fixed position, so a future NSE column reorder doesn't
// silently corrupt data.
function parseNseIndustryCsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) throw new Error("Empty CSV");

  const header = splitCsvLine(lines[0]);
  const industryIdx = header.indexOf("Industry");
  const symbolIdx = header.indexOf("Symbol");
  if (industryIdx === -1 || symbolIdx === -1) {
    throw new Error(`Expected "Industry" and "Symbol" columns, got: ${header.join(", ")}`);
  }

  const map = {};
  for (const line of lines.slice(1)) {
    const cols = splitCsvLine(line);
    const symbol = cols[symbolIdx]?.trim().toUpperCase();
    const industry = cols[industryIdx]?.trim();
    if (symbol && industry) map[symbol] = industry;
  }
  return map;
}

const ensureNseIndustryCache = async (forceRefresh = false) => {
  if (!forceRefresh && nseIndustryCache && nseIndustryCacheTime && Date.now() - nseIndustryCacheTime < NSE_INDUSTRY_CACHE_DURATION) {
    return nseIndustryCache;
  }
  console.log("[NSE_INDUSTRY] Fetching official industry classification from NSE archives...");
  const response = await fetch(NSE_INDUSTRY_CSV_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      "Accept": "text/csv,*/*",
    },
  });
  if (!response.ok) {
    throw new Error(`NSE archive request failed: ${response.status} ${response.statusText}`);
  }
  const text = await response.text();
  nseIndustryCache = parseNseIndustryCsv(text);
  nseIndustryCacheTime = Date.now();
  console.log(`[NSE_INDUSTRY] Cached official industry classification for ${Object.keys(nseIndustryCache).length} symbols`);
  return nseIndustryCache;
};

app.get("/api/instruments/nse/industry-classification", requireAuth, async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === "true";
    if (forceRefresh) { nseIndustryCache = null; nseIndustryCacheTime = null; }
    const data = await ensureNseIndustryCache(forceRefresh);
    res.json({
      success: true,
      data,
      metadata: {
        total_count: Object.keys(data).length,
        cached: true,
        cached_at: nseIndustryCacheTime ? new Date(nseIndustryCacheTime).toISOString() : null,
        expires_at: nseIndustryCacheTime ? new Date(nseIndustryCacheTime + NSE_INDUSTRY_CACHE_DURATION).toISOString() : null,
      },
    });
  } catch (err) {
    console.error("[NSE_INDUSTRY] Error:", err.message);
    res.status(500).json({ success: false, message: "Failed to fetch NSE industry classification", error: err.message });
  }
});

app.post("/api/instruments/nse/import/validate", requireAuth, (req, res) => {
  const { stocks } = req.body;
  if (!Array.isArray(stocks) || stocks.length === 0) {
    return res.status(400).json({ success: false, message: "stocks array is required and must not be empty" });
  }
  const valid = [], invalid = [];
  for (const s of stocks) {
    if (s.symbol && s.exchange && s.name) {
      valid.push({ symbol: s.symbol.trim().toUpperCase(), name: s.name.trim(), exchange: s.exchange, tags: Array.isArray(s.tags) ? s.tags : [], instrument_token: s.instrument_token || null, isin: s.isin || null });
    } else {
      invalid.push({ raw: s, reason: "Missing symbol, name, or exchange" });
    }
  }
  res.json({ success: true, valid_count: valid.length, invalid_count: invalid.length, valid, invalid });
});

// ── Order routes — LIVE trading ──────────────────────────────────────────────
// These place/cancel real orders on the connected Zerodha account. Added to
// test whether the current Kite Connect plan permits order placement.

app.post("/api/orders/place", requireAuth, checkService, async (req, res) => {
  try {
    const {
      variety = "regular",
      exchange,
      tradingsymbol,
      transaction_type,
      order_type,
      quantity,
      product,
      price,
      trigger_price,
      validity = "DAY",
    } = req.body;

    if (!exchange || !tradingsymbol || !transaction_type || !order_type || !quantity || !product) {
      return res.status(400).json({
        error: "Missing required order fields: exchange, tradingsymbol, transaction_type, order_type, quantity, product",
      });
    }

    const orderParams = {
      exchange,
      tradingsymbol: tradingsymbol.toUpperCase(),
      transaction_type,
      order_type,
      quantity: Number(quantity),
      product,
      validity,
    };
    if ((order_type === "LIMIT" || order_type === "SL") && price) {
      orderParams.price = Number(price);
    }
    if ((order_type === "SL" || order_type === "SL-M") && trigger_price) {
      orderParams.trigger_price = Number(trigger_price);
    }

    console.log(`Placing ${variety} order:`, orderParams);
    const result = await getKiteService().placeOrder(variety, orderParams);

    res.json({ success: true, data: result, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("Error placing order:", err.message);
    res.status(500).json({ error: "Failed to place order", details: err.message });
  }
});

app.post("/api/orders/cancel", requireAuth, checkService, async (req, res) => {
  try {
    const { variety = "regular", order_id } = req.body;
    if (!order_id) return res.status(400).json({ error: "order_id is required" });

    console.log(`Cancelling ${variety} order ${order_id}`);
    const result = await getKiteService().cancelOrder(variety, order_id);

    res.json({ success: true, data: result, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("Error cancelling order:", err.message);
    res.status(500).json({ error: "Failed to cancel order", details: err.message });
  }
});

app.get("/api/orders", requireAuth, checkService, async (req, res) => {
  try {
    const orders = await getKiteService().getOrders();
    res.json({ success: true, data: orders, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("Error fetching orders:", err.message);
    res.status(500).json({ error: "Failed to fetch orders", details: err.message });
  }
});

// ── Error handlers ────────────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(err.status || 500).json({ error: "Internal server error", details: err.message });
});

app.use("*", (req, res) => {
  res.status(404).json({ error: "Endpoint not found", path: req.originalUrl });
});

// ── Export as Firebase Function ───────────────────────────────────────────────

exports.api = onRequest({ region: "us-central1" }, app);
