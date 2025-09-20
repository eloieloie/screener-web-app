# 📈 Indian Stock Screener

A React-based web application to track and monitor Indian stocks from NSE (National Stock Exchange) and BSE (Bombay Stock Exchange). The application integrates with Zerodha's KiteConnect API for real-time stock data and stores user portfolios in Firebase Firestore.

## 🚀 Features

- **Real-time Indian Stock Data**: Integrates with Zerodha KiteConnect API for live market data
- **Demo Mode**: Works without authentication using simulated market data
- **Exchange Support**: Full support for NSE stocks with automatic symbol handling
- **Smart Suggestions**: Auto-complete with popular Indian stock symbols
- **Live Price Updates**: Real-time price updates with change indicators
- **Persistent Storage**: User portfolios saved to Firebase Firestore
- **Indian Market Focus**: Currency in INR (₹), Indian number formatting, and market-specific details
- **Comprehensive Stock Info**: 
  - Current price and daily changes
  - Day high/low ranges
  - Trading volume
  - Market capitalization
  - Historical price charts (via KiteConnect and demo data)
- **Professional Charts**: Integration with TradingView widgets for advanced charting

## 🏛️ Supported Exchanges

- **NSE (National Stock Exchange)**: Primary Indian stock exchange
- **Market Status**: Real-time market status with trading hours

## 📊 API Integration

The application uses **Zerodha KiteConnect API** for professional-grade market data:

### 🔑 Authentication Modes
- **Demo Mode** (Default): Uses simulated data for development and testing
- **Live Mode**: Requires Zerodha KiteConnect authentication for real-time data

### 🌐 API Features
- **Real-time Quotes**: Live stock prices and market data
- **Historical Data**: Historical price data for charting
- **Market Status**: Live market status and trading hours
- **Symbol Search**: Comprehensive stock symbol database
- **Multiple Quotes**: Batch quote fetching for efficiency

### 📈 Data Sources
- **Live Data**: Zerodha KiteConnect API (when authenticated)
- **Demo Data**: Realistic simulated market data for development
- **Charts**: TradingView integration for professional charting
- **Backup**: Automatic fallback to demo data if API is unavailable

## 📊 Popular Indian Stocks Supported

The app includes auto-suggestions for popular Indian stocks including:
- RELIANCE (Reliance Industries Limited)
- TCS (Tata Consultancy Services Limited)
- INFY (Infosys Limited)
- HDFCBANK (HDFC Bank Limited)
- ICICIBANK (ICICI Bank Limited)
- HINDUNILVR (Hindustan Unilever Limited)
- ITC (ITC Limited)
- SBIN (State Bank of India)
- BHARTIARTL (Bharti Airtel Limited)
- ASIANPAINT (Asian Paints Limited)

## 🛠️ Technology Stack

- **Frontend**: React 18 with TypeScript
- **Build Tool**: Vite
- **Database**: Firebase Firestore
- **Stock Data**: Zerodha KiteConnect API
- **Charts**: TradingView Widgets + Custom Canvas Charts
- **Styling**: CSS3 with modern design
- **State Management**: React Hooks

## 🔧 Setup Instructions

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd screener-web-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Firebase Configuration**
   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
   - Enable Firestore Database
   - Copy your Firebase config to `src/config/firebase.ts`

4. **Zerodha KiteConnect Setup (Optional)**
   - For live data, register at [Kite Connect](https://kite.trade/)
   - Get your API key and secret
   - The app works in demo mode without authentication

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Build for production**
   ```bash
   npm run build
   ```

## 🔥 Firebase Setup

The application requires Firebase Firestore for storing user stock portfolios. Make sure to:

1. Create a Firebase project
2. Enable Firestore Database
3. Set up proper security rules for your use case
4. Replace the Firebase configuration in `src/config/firebase.ts`

## 🔑 KiteConnect Integration

The app includes comprehensive KiteConnect API integration:

### Demo Mode (Default)
- Works without any authentication
- Uses realistic simulated market data
- Perfect for development and testing
- All features available with demo data

### Live Mode (Optional)
- Requires Zerodha KiteConnect account
- Real-time market data
- Historical data for charts
- Live market status

### Authentication Flow
```javascript
// The app automatically handles authentication
// Demo mode is used when not authenticated
// Live data requires KiteConnect login flow
```

## 📱 Usage

1. **Add Stocks**: Click "Add Stock" and enter Indian stock symbols (e.g., RELIANCE, TCS)
2. **Auto-complete**: Type stock symbols to see suggestions
3. **Real-time Data**: View live prices, changes, and market data
4. **Charts**: Interactive price charts with historical data
5. **Portfolio Management**: Add/remove stocks, persistent storage
6. **Demo Mode**: Full functionality without requiring API authentication

## 🌐 API Architecture

The application features a robust API integration system:

### KiteConnect Service (`src/services/kiteConnectAPI.ts`)
- **Authentication**: Handles KiteConnect login flow
- **Demo Mode**: Comprehensive fallback with realistic data
- **Quote Fetching**: Single and batch quote operations
- **Historical Data**: Chart data with configurable intervals
- **Market Status**: Live trading status and hours
- **Error Handling**: Graceful degradation to demo mode

### Stock Service (`src/services/stockService.ts`)
- **Firebase Integration**: Firestore operations
- **Real-time Updates**: Live stock price updates
- **Caching**: Efficient data management
- **Symbol Validation**: Indian stock symbol validation

## 💱 Currency & Formatting

- **Currency**: Indian Rupees (₹)
- **Number Formatting**: 
  - Lakhs (L) for 100K+
  - Crores (Cr) for 10M+
  - Follows Indian numbering conventions
- **Utilities**: Centralized formatting in `src/utils/formatters.ts`

## 🎨 Features Overview

- **Real-time Data**: Live prices from Zerodha KiteConnect API
- **Demo Mode**: Full functionality without authentication
- **Professional Charts**: TradingView integration + custom canvas charts
- **Smart Validation**: Indian stock symbol validation
- **Responsive Design**: Works on desktop and mobile
- **Error Handling**: Graceful error handling with automatic fallback
- **Loading States**: Visual feedback during API calls
- **Historical Data**: Price history for charting and analysis

## 📄 Project Structure

```
src/
├── components/             # React components
│   ├── AddStockModal.tsx      # Modal for adding new stocks
│   ├── StockCard.tsx          # Individual stock display card
│   ├── StockList.tsx          # List of all stocks
│   ├── MiniChartWidget.tsx    # TradingView chart widget
│   └── SimpleChart.tsx        # Custom canvas chart with KiteConnect data
├── services/              # API and business logic
│   ├── kiteConnectAPI.ts      # Zerodha KiteConnect API integration
│   └── stockService.ts        # Firebase operations & API coordination
├── utils/                 # Utility functions
│   └── formatters.ts          # Indian number formatting utilities
├── types/                 # TypeScript type definitions
│   └── Stock.ts              # Stock-related interfaces
├── config/                # Configuration files
│   └── firebase.ts           # Firebase configuration
└── App.tsx                # Main application component
```

## 🚀 Deployment

The app can be deployed to any static hosting service:
- Vercel
- Netlify
- Firebase Hosting
- GitHub Pages

Run `npm run build` to create production-ready files in the `dist` directory.

## 📈 Future Enhancements

- KiteConnect authentication UI for live data
- Advanced portfolio analytics
- Stock alerts and notifications
- Sector-wise categorization
- Market indices (NIFTY, SENSEX) tracking
- News integration
- Technical indicators
- Options and derivatives support

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

This project is open source and available under the [MIT License](LICENSE).