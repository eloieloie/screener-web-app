# 📈 Indian Stock Screener

A React + TypeScript web app for tracking Indian stocks (NSE/BSE) with live market data from Zerodha's **KiteConnect API**, portfolio storage in **Firebase Firestore**, and access gated behind **Firebase Authentication**.

## 🚀 Features

- **Firebase Authentication**: Email/password + Google sign-in. First run auto-detects that no admin account exists yet and shows a one-time "Create Admin Account" setup form instead of a login form.
- **Live Indian Stock Data**: Real-time quotes, day range, volume, and market cap via Zerodha KiteConnect (NSE and BSE).
- **Portfolio Storage**: Stocks and price caches persisted in Firestore, with real-time subscriptions.
- **Tagging & Sector Classification**: Freeform tags for organizing stocks, plus an automatic sector/industry classifier (keyword-rule based) for bulk NSE imports.
- **Bulk Stock Management**: Add stocks manually (one per line), via CSV upload (with company-name lookup or direct symbol columns), or via a one-click "popular stocks" quick-add — with automatic NSE⇄BSE fallback if a symbol isn't found on the chosen exchange.
- **Historical Charts**: Interactive sparkline charts (via [lightweight-charts](https://github.com/tradingview/lightweight-charts)) across 1M/6M/1Y/3Y/5Y windows, with a left price axis, subtle gridlines, and a hover crosshair/tooltip. Charts load in batches to avoid hammering the API when many stocks are tracked.
- **Portfolio Analytics**: Aggregate portfolio value/gain, best/worst performers, and a TradingView chart widget for any tracked symbol.
- **Indian Market Formatting**: Currency in ₹, volumes formatted in Lakhs/Crores.

## 🗺️ Pages

The app is a single-page shell (`src/App.tsx`) that switches between:

| Page | Component | Purpose |
|---|---|---|
| Dashboard | (inline in `App.tsx`) | KiteConnect auth status + quick links to the other pages |
| Stocks List | `pages/StocksPage.tsx` | Search/filter your tracked stocks, browse the tag cloud, manage individual stocks in a sortable table |
| Bulk Add | `pages/BulkStocksPage.tsx` | Add many stocks at once: manual paste, CSV upload, or quick-add popular stocks |
| Charts | `pages/ChartsPage.tsx` | Grid of per-stock sparkline charts, filterable by tag, with a shared time-range selector |
| Analytics | `components/Analytics.tsx` | Portfolio-level stats and a TradingView chart for a selected stock |
| NSE Import *(temporary)* | `pages/TempNseImportPage.tsx` | One-shot bulk import of the full NSE equity list with automatic sector/industry tagging; to be removed once a scheduled ingestion pipeline replaces it |

## 🔑 Authentication

Two independent auth layers:

1. **Firebase Authentication** (`src/config/firebase.ts`, `src/pages/LoginPage.tsx`) gates the whole app. Firestore security rules (`firestore.rules`) require `request.auth != null` for all reads/writes. The `users` collection stores one document per signed-in account; if it's empty, the login page switches to a "first-time setup" flow that creates the initial admin account.
2. **Zerodha KiteConnect** (`components/AuthenticationStatus.tsx`, `services/kiteConnectAPI.ts`) is a separate, per-session login required to fetch *live market data*. Without it, stocks can still be added/tagged/browsed, but quotes and charts show "login required" states.

## 🛠️ Technology Stack

- **Frontend**: React 19, TypeScript, Vite 7
- **UI**: Bootstrap 5
- **Charts**: [lightweight-charts](https://github.com/tradingview/lightweight-charts) (sparklines), TradingView embedded widgets (Analytics), a small canvas chart (inline table rows)
- **Auth & Database**: Firebase Authentication + Firestore
- **Backend**: Express app wrapping the Zerodha KiteConnect SDK — deployed as a Firebase Cloud Function (`functions/`) and mirrored by a local dev server (`server/`) for `npm run dev`
- **Market Data**: Zerodha KiteConnect API

## 📁 Project Structure

```
src/
├── pages/
│   ├── StocksPage.tsx          # "My Stocks" — search, tag cloud, table
│   ├── BulkStocksPage.tsx      # Manual / CSV / quick-add bulk import
│   ├── ChartsPage.tsx          # Batched grid of per-stock charts
│   ├── TempNseImportPage.tsx   # Temporary full-NSE sector-tagging importer
│   └── LoginPage.tsx           # Firebase email/Google login + first-run admin setup
├── components/
│   ├── StockTable.tsx          # Sortable stock table with inline expandable charts
│   ├── AddStockModal.tsx       # Single-stock add modal
│   ├── EnhancedChart.tsx       # lightweight-charts sparkline (used on ChartsPage)
│   ├── SimpleChart.tsx         # Canvas mini-chart (used inline in StockTable)
│   ├── ChartWidget.tsx         # TradingView widget wrapper (used on Analytics)
│   ├── Analytics.tsx           # Portfolio analytics dashboard
│   └── AuthenticationStatus.tsx# Zerodha KiteConnect login/status card
├── services/
│   ├── kiteConnectAPI.ts       # Frontend client for the backend's KiteConnect routes
│   └── stockService.ts         # Firestore CRUD, caching, bulk import/delete helpers
├── types/Stock.ts              # Stock, StockMetadata, NseEquity, historical data types
├── utils/formatters.ts         # ₹ currency / Lakh-Crore volume formatting
├── config/firebase.ts          # Firebase app + Auth + Firestore init
└── App.tsx                     # Auth gate + page shell/navigation

functions/                      # Firebase Cloud Function (deployed backend)
server/                         # Local Express backend for `npm run dev` (same routes as functions/)
```

## 🌐 Backend API

Both `functions/index.js` (deployed) and `server/server.js` (local dev) expose the same Express routes, wrapping Zerodha KiteConnect:

- `GET /health` — health check
- `GET /auth/login`, `POST /auth/session`, `GET /auth/status`, `POST /auth/logout` — KiteConnect login flow
- `GET /api/stocks/quote/:symbol`, `POST /api/stocks/multiple`, `GET /api/stocks/top` — live quotes
- `GET /api/stocks/historical/:symbol` — historical price data for charts
- `GET /api/instruments/nse/equity` — full NSE equity list (used by the NSE Import page)

In production, Firebase Hosting rewrites `/api/**`, `/auth/**`, and `/health` to the `api` Cloud Function (see `firebase.json`); in development, Vite proxies the same paths to `http://localhost:3001` (see `vite.config.ts`).

## 🔧 Setup

1. **Clone and install**
   ```bash
   git clone <repository-url>
   cd screener-web-app
   npm install
   cd server && npm install && cd ..
   ```

2. **Firebase project**
   - Create a project at the [Firebase Console](https://console.firebase.google.com/)
   - Enable **Firestore Database**
   - Enable **Authentication** → Email/Password and Google providers
   - Deploy the security rules: `firebase deploy --only firestore:rules`
   - Copy your web app config into a `.env` file (see `.env.example`):
     ```
     VITE_FIREBASE_API_KEY=
     VITE_FIREBASE_AUTH_DOMAIN=
     VITE_FIREBASE_PROJECT_ID=
     VITE_FIREBASE_STORAGE_BUCKET=
     VITE_FIREBASE_MESSAGING_SENDER_ID=
     VITE_FIREBASE_APP_ID=
     ```

3. **Zerodha KiteConnect credentials**
   - Register an app at [Kite Connect](https://kite.trade/) to get an API key/secret
   - Copy `server/.env.example` to `server/.env` and fill in `KITE_API_KEY`, `KITE_API_SECRET`, `SESSION_SECRET`
   - For deployment, set the same values as Cloud Functions config/secrets for `functions/`

4. **Run locally** (two processes)
   ```bash
   cd server && npm start     # backend on http://localhost:3001
   npm run dev                # frontend (see vite.config.ts for port/HTTPS config)
   ```
   On first load, sign in with the Firebase login page — if no admin account exists yet, it prompts you to create one. Then use the "Login to Zerodha Kite" card on the Dashboard to enable live data.

5. **Build for production**
   ```bash
   npm run build
   ```

## 🚀 Deployment

Deploys to **Firebase Hosting + Cloud Functions**:

```bash
npm run build
firebase deploy
```

This publishes `dist/` as the static site, deploys `functions/` as the `api` Cloud Function, and applies `firestore.rules`.

## 💱 Currency & Formatting

- Currency in Indian Rupees (₹)
- Volumes formatted in Lakhs (L) / Crores (Cr) — see `src/utils/formatters.ts`

## 📈 Future Enhancements

- Replace the temporary NSE Import page with a scheduled ingestion pipeline
- Stock alerts and notifications
- Market indices (NIFTY, SENSEX) tracking
- Technical indicators

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

This project is open source, available under the MIT License.
