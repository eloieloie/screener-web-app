// Free market-data routes (no broker login required).
//   quotes + history  -> Yahoo Finance (via yahoo-finance2), NSE = ".NS", BSE = ".BO"
//   instrument list   -> NSE's public EQUITY_L.csv archive
// Response shapes mirror the Kite-backed /api/stocks/* routes so the frontend
// can swap between them transparently.
import { Router } from 'express';
import YahooFinance from 'yahoo-finance2';

const yahoo = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
const router = Router();

// ── Yahoo call wrapper: limited concurrency, retries, and a short result cache ──
// Yahoo throttles bursts, so we queue calls (MAX_CONCURRENT at a time) and retry
// transient failures. Identical in-flight/recent requests share one result.
const MAX_CONCURRENT = 4;
let active = 0;
const waiting = [];
const acquire = () => new Promise((resolve) => {
  if (active < MAX_CONCURRENT) { active++; resolve(); } else waiting.push(resolve);
});
const release = () => { const next = waiting.shift(); if (next) next(); else active--; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const yahooCall = async (fn) => {
  await acquire();
  try {
    for (let attempt = 0; ; attempt++) {
      try { return await fn(); } catch (err) {
        const notFound = /not found|no data found|delisted/i.test(err.message || '');
        if (notFound || attempt >= 2) throw err;
        await sleep(800 * (attempt + 1));
      }
    }
  } finally { release(); }
};

const memo = new Map(); // key -> { at, promise }
const memoized = (key, ttlMs, fn) => {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.promise;
  const promise = fn().catch((e) => { memo.delete(key); throw e; });
  memo.set(key, { at: Date.now(), promise });
  return promise;
};

const NIFTY_50 = [
  'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'HINDUNILVR', 'ICICIBANK', 'KOTAKBANK', 'SBIN',
  'BHARTIARTL', 'ITC', 'ASIANPAINT', 'LT', 'AXISBANK', 'MARUTI', 'SUNPHARMA', 'TITAN',
  'ULTRACEMCO', 'NESTLEIND', 'WIPRO', 'M&M', 'NTPC', 'HCLTECH', 'TECHM', 'POWERGRID',
  'TATAMOTORS', 'BAJFINANCE', 'COALINDIA', 'ONGC', 'GRASIM', 'BAJAJFINSV', 'ADANIPORTS',
  'TATASTEEL', 'CIPLA', 'DRREDDY', 'EICHERMOT', 'IOC', 'HINDALCO', 'BRITANNIA', 'DIVISLAB',
  'INDUSINDBK', 'JSWSTEEL', 'SHREECEM', 'APOLLOHOSP', 'HEROMOTOCO', 'UPL', 'BAJAJ-AUTO',
  'SBILIFE', 'HDFCLIFE', 'BPCL', 'TATACONSUM',
];

const INTERVALS = {
  minute: '1m', '5minute': '5m', '15minute': '15m', '30minute': '30m', hour: '60m', day: '1d',
};

const cleanSymbol = (s) =>
  String(s).replace(/\.(NS|BO|BSE)\.?$/i, '').replace(/^(NSE|BSE):/i, '').toUpperCase();

const toYahoo = (symbol, exchange) =>
  `${cleanSymbol(symbol)}${String(exchange).toUpperCase() === 'BSE' ? '.BO' : '.NS'}`;

const formatQuote = (q, exchange) => {
  const price = q.regularMarketPrice ?? 0;
  return {
    id: q.symbol,
    symbol: cleanSymbol(q.symbol),
    name: q.longName || q.shortName || `${cleanSymbol(q.symbol)} Limited`,
    price,
    change: q.regularMarketChange ?? 0,
    changePercent: q.regularMarketChangePercent ?? 0,
    volume: q.regularMarketVolume ?? 0,
    marketCap: q.marketCap ? `₹${Number(q.marketCap).toLocaleString('en-IN')}` : 'N/A',
    exchange,
    currency: q.currency || 'INR',
    previousClose: q.regularMarketPreviousClose ?? price,
    dayHigh: q.regularMarketDayHigh ?? price,
    dayLow: q.regularMarketDayLow ?? price,
    timestamp: new Date().toISOString(),
  };
};

router.get('/stocks/quote/:symbol', async (req, res) => {
  const exchange = req.query.exchange === 'BSE' ? 'BSE' : 'NSE';
  try {
    const ySym = toYahoo(req.params.symbol, exchange);
    const q = await memoized(`q:${ySym}`, 5 * 60 * 1000, () => yahooCall(() => yahoo.quote(ySym)));
    if (!q) throw new Error(`No quote data available for ${req.params.symbol}`);
    res.json({ success: true, data: formatQuote(q, exchange), timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get stock quote', details: error.message, symbol: req.params.symbol });
  }
});

router.post('/stocks/multiple', async (req, res) => {
  try {
    const symbols = Array.isArray(req.body?.symbols) ? req.body.symbols : [];
    if (!symbols.length) return res.status(400).json({ error: 'symbols array is required' });
    const quotes = await yahooCall(() => yahoo.quote(symbols.map((s) => toYahoo(s, 'NSE')), { return: 'array' }));
    res.json({ success: true, data: quotes.map((q) => formatQuote(q, 'NSE')), timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get quotes', details: error.message });
  }
});

router.get('/stocks/top', async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);
    const quotes = await yahooCall(() => yahoo.quote(NIFTY_50.slice(0, limit).map((s) => toYahoo(s, 'NSE')), { return: 'array' }));
    res.json({ success: true, data: quotes.map((q) => formatQuote(q, 'NSE')), timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get top stocks', details: error.message });
  }
});

router.get('/stocks/historical/:symbol', async (req, res) => {
  try {
    const { from, to, interval = 'day' } = req.query;
    const exchange = req.query.exchange === 'BSE' ? 'BSE' : 'NSE';
    if (!from || !to) return res.status(400).json({ error: 'from and to date parameters are required (YYYY-MM-DD)' });
    if (!INTERVALS[interval]) {
      return res.status(400).json({ error: `Invalid interval. Allowed values: ${Object.keys(INTERVALS).join(', ')}` });
    }
    // Yahoo treats period2 as exclusive, so add a day to include `to`.
    const period2 = new Date(new Date(to).getTime() + 24 * 60 * 60 * 1000);
    const ySym = toYahoo(req.params.symbol, exchange);
    const result = await memoized(`h:${ySym}:${from}:${to}:${interval}`, 60 * 60 * 1000, () =>
      yahooCall(() => yahoo.chart(ySym, { period1: new Date(from), period2, interval: INTERVALS[interval] })));
    const data = result.quotes
      .filter((p) => p.open != null && p.close != null)
      .map((p) => ({
        date: p.date.toISOString(),
        open: p.open, high: p.high, low: p.low, close: p.close, volume: p.volume ?? 0,
      }));
    res.json({
      success: true, data, count: data.length, symbol: cleanSymbol(req.params.symbol),
      from, to, interval, timestamp: new Date().toISOString(),
    });
  } catch (error) {
    // Symbol Yahoo doesn't know => a definitive "no data" (cacheable), not a failure.
    if (/not found|no data found|delisted/i.test(error.message || '')) {
      const { from, to, interval = 'day' } = req.query;
      return res.json({ success: true, data: [], count: 0, symbol: cleanSymbol(req.params.symbol), from, to, interval, timestamp: new Date().toISOString() });
    }
    res.status(500).json({ error: 'Failed to get historical data', details: error.message, symbol: req.params.symbol });
  }
});

router.get('/stocks/market-status', (req, res) => {
  // NSE hours: Mon-Fri 09:15-15:30 IST (server timezone independent)
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const t = ist.getUTCHours() * 100 + ist.getUTCMinutes();
  const weekday = ist.getUTCDay() >= 1 && ist.getUTCDay() <= 5;
  res.json({ success: true, status: weekday && t >= 915 && t <= 1530 ? 'open' : 'closed', timestamp: new Date().toISOString() });
});

// ── NSE equity list from NSE's public archive ───────────────────────────────
let equityCache = null;
let equityCacheTime = 0;
const DAY = 24 * 60 * 60 * 1000;

router.get('/instruments/nse/equity', async (req, res) => {
  try {
    if (req.query.refresh === 'true' || !equityCache || Date.now() - equityCacheTime > DAY) {
      const r = await fetch('https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if (!r.ok) throw new Error(`NSE archive responded ${r.status}`);
      const lines = (await r.text()).trim().split(/\r?\n/).slice(1);
      equityCache = lines.map((line, i) => {
        const c = line.split(',').map((x) => x.trim());
        return { series: c[2], symbol: c[0], name: c[1], isin: c[6] || null, lot: Number(c[5]) || 1, i };
      }).filter((e) => e.series === 'EQ').map((e) => ({
        symbol: e.symbol, name: e.name, exchange: 'NSE',
        instrument_token: e.i, // no broker token available for free; unused for Yahoo
        isin: e.isin, tick_size: 0.05, lot_size: e.lot,
      }));
      equityCacheTime = Date.now();
    }
    res.json({
      success: true,
      data: equityCache,
      metadata: {
        total_count: equityCache.length, cached: true,
        cached_at: new Date(equityCacheTime).toISOString(),
        expires_at: new Date(equityCacheTime + DAY).toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch NSE equity list', details: error.message });
  }
});

export default router;
