# 📈 Indian Stock Screener

A React-based web application to track and monitor Indian stocks from NSE (National Stock Exchange) and BSE (Bombay Stock Exchange). The application uses real-time data from Yahoo Finance API and stores user portfolios in Firebase Firestore.

## 🚀 Features

- **Real-time Indian Stock Data**: Fetches live data from Yahoo Finance API for NSE and BSE stocks
- **Exchange Support**: Full support for both NSE and BSE exchanges
- **Smart Suggestions**: Auto-complete with popular Indian stock symbols
- **Live Price Updates**: Real-time price updates with change indicators
- **Persistent Storage**: User portfolios saved to Firebase Firestore
- **Indian Market Focus**: Currency in INR (₹), Indian number formatting, and market-specific details
- **Comprehensive Stock Info**: 
  - Current price and daily changes
  - Day high/low ranges
  - 52-week high/low ranges
  - Trading volume
  - Market capitalization
  - Exchange badges

## 🏛️ Supported Exchanges

- **NSE (National Stock Exchange)**: Primary Indian stock exchange
- **BSE (Bombay Stock Exchange)**: Asia's oldest stock exchange

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
- **Stock Data**: Yahoo Finance API
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

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Build for production**
   ```bash
   npm run build
   ```

## 🔥 Firebase Setup

The application requires Firebase Firestore for storing user stock portfolios. Make sure to:

1. Create a Firebase project
2. Enable Firestore Database
3. Set up proper security rules for your use case
4. Replace the Firebase configuration in `src/config/firebase.ts`

## 📱 Usage

1. **Add Stocks**: Click "Add Stock" and enter Indian stock symbols (e.g., RELIANCE, TCS)
2. **Select Exchange**: Choose between NSE or BSE
3. **Auto-complete**: Type stock symbols to see suggestions
4. **View Details**: Stock cards show comprehensive market data
5. **Real-time Updates**: Data refreshes automatically
6. **Remove Stocks**: Click the × button to remove stocks from your portfolio

## 🌐 API Integration

The application uses Yahoo Finance API to fetch real-time Indian stock data:
- **Endpoint**: `https://query1.finance.yahoo.com/v7/finance/quote`
- **Symbol Format**: 
  - NSE stocks: `SYMBOL.NS` (e.g., `RELIANCE.NS`)
  - BSE stocks: `SYMBOL.BO` (e.g., `RELIANCE.BO`)

## 💱 Currency & Formatting

- **Currency**: Indian Rupees (₹)
- **Number Formatting**: 
  - Lakhs (L) for 100K+
  - Crores (Cr) for 10M+
  - Follows Indian numbering conventions

## 🎨 Features Overview

- **Real-time Data**: Live prices from Yahoo Finance
- **Exchange Badges**: Visual indicators for NSE/BSE
- **Smart Validation**: Indian stock symbol validation
- **Responsive Design**: Works on desktop and mobile
- **Error Handling**: Graceful error handling with user feedback
- **Loading States**: Visual feedback during API calls

## 📄 Project Structure

```
src/
├── components/          # React components
│   ├── AddStockModal.tsx   # Modal for adding new stocks
│   ├── StockCard.tsx       # Individual stock display card
│   └── StockList.tsx       # List of all stocks
├── services/           # API and business logic
│   ├── indianStockAPI.ts   # Yahoo Finance API integration
│   └── stockService.ts     # Firebase operations
├── types/              # TypeScript type definitions
│   └── Stock.ts           # Stock-related interfaces
├── config/             # Configuration files
│   └── firebase.ts        # Firebase configuration
└── App.tsx             # Main application component
```

## 🚀 Deployment

The app can be deployed to any static hosting service:
- Vercel
- Netlify
- Firebase Hosting
- GitHub Pages

Run `npm run build` to create production-ready files in the `dist` directory.

## 📈 Future Enhancements

- Historical price charts
- Stock alerts and notifications
- Portfolio performance tracking
- Sector-wise categorization
- Market indices (NIFTY, SENSEX) tracking
- News integration
- Technical indicators

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

This project is open source and available under the [MIT License](LICENSE).