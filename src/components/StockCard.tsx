import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Stock } from '../types/Stock'
import { formatVolume } from '../utils/formatters'
import SimpleChart from './SimpleChart'
import KiteConnectAPI from '../services/KiteConnectAPI'

interface StockCardProps {
  stock: Stock
  onRemove: () => void
}

const StockCard = ({ stock, onRemove }: StockCardProps) => {
  const [showChart, setShowChart] = useState(true) // Show charts by default for Firebase stocks
  const [liveStock, setLiveStock] = useState<Stock>(stock)
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [error, setError] = useState<string | null>(null)
  
  // Initialize KiteConnect API (memoized to prevent recreation)
  const kiteAPI = useMemo(() => KiteConnectAPI.getInstance(), [])

  // Fetch live stock data
  const fetchLiveData = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) {
        setIsRefreshing(true)
      }
      setError(null)
      
      // Check if API is authenticated before making request
      if (!kiteAPI.isReady()) {
        setError('Authentication required - Please login to Zerodha Kite for live data')
        return
      }
      
      const freshData = await kiteAPI.getStockQuote(stock.symbol)
      
      if (freshData) {
        setLiveStock(prevStock => ({
          ...freshData,
          id: prevStock.id // Keep the original Firebase ID
        }))
        setLastUpdated(new Date())
      }
    } catch (err) {
      console.error('Error fetching live stock data:', err)
      const kiteAPI = KiteConnectAPI.getInstance()
      
      if (err instanceof Error && err.message.includes('not authenticated')) {
        if (kiteAPI.isReady()) {
          // User is authenticated but session doesn't work - show helpful message
          setError('Session issue - Live data temporarily unavailable (using sample data)')
        } else {
          setError('Authentication required - Please login to Zerodha Kite for live data')
        }
      } else {
        setError('Failed to fetch live data')
      }
    } finally {
      if (showLoading) {
        setIsRefreshing(false)
      }
      setIsLoading(false)
    }
  }, [stock.symbol, kiteAPI])

  // Auto-refresh every 30 seconds during market hours
  useEffect(() => {
    // Initial load
    setIsLoading(true)
    fetchLiveData()

    // Set up interval for auto-refresh
    const interval = setInterval(() => {
      const now = new Date()
      const currentHour = now.getHours()
      const currentMinute = now.getMinutes()
      const isWeekday = now.getDay() >= 1 && now.getDay() <= 5
      
      // Market hours: 9:15 AM to 3:30 PM on weekdays
      const isMarketHours = isWeekday && 
        ((currentHour > 9) || (currentHour === 9 && currentMinute >= 15)) &&
        ((currentHour < 15) || (currentHour === 15 && currentMinute <= 30))
      
      // Only refresh if authenticated and during market hours
      if (isMarketHours && kiteAPI.isReady()) {
        fetchLiveData()
      }
    }, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [fetchLiveData, kiteAPI])

  const handleManualRefresh = () => {
    fetchLiveData(true)
  }

  const formatPrice = (price: number) => `₹${price.toFixed(2)}`
  const formatChange = (change: number) => {
    if (change === 0) return '₹0.00';
    return change >= 0 ? `+₹${change.toFixed(2)}` : `-₹${Math.abs(change).toFixed(2)}`;
  }
  const formatChangePercent = (percent: number | string) => {
    const numPercent = typeof percent === 'string' ? parseFloat(percent) : percent;
    if (isNaN(numPercent) || numPercent === 0) return '0.00%';
    return `${numPercent >= 0 ? '+' : ''}${numPercent.toFixed(2)}%`;
  }
  
  const formatLastUpdated = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSeconds = Math.floor(diffMs / 1000)
    const diffMinutes = Math.floor(diffSeconds / 60)
    
    if (diffSeconds < 60) {
      return `${diffSeconds}s ago`
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m ago`
    } else {
      return date.toLocaleTimeString('en-IN', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    }
  }

  return (
    <div className="card h-100 shadow-sm">
      <div className="card-header d-flex justify-content-between align-items-start bg-white border-0 pb-2">
        <div>
          <h5 className="card-title mb-1 d-flex align-items-center">
            {liveStock.symbol}
            {liveStock.exchange && (
              <span className={`badge ms-2 ${liveStock.exchange === 'NSE' ? 'bg-primary' : 'bg-warning'}`}>
                {liveStock.exchange}
              </span>
            )}
            {isLoading && (
              <div className="spinner-border spinner-border-sm ms-2 text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            )}
          </h5>
          <p className="card-subtitle text-muted small mb-0">{liveStock.name}</p>
          <small className={kiteAPI.isReady() ? "text-success" : "text-warning"}>
            {kiteAPI.isReady() ? 
              `📈 Live Data • Updated ${formatLastUpdated(lastUpdated)}` : 
              `⚠️ Cached Data • Login for live prices`
            }
          </small>
          {error && (
            <small className="text-danger d-block">
              ⚠️ {error}
            </small>
          )}
        </div>
        <div className="d-flex flex-column align-items-end">
          <button 
            className="btn btn-outline-danger btn-sm mb-1" 
            onClick={onRemove}
            title="Remove stock"
          >
            ×
          </button>
          <button 
            className={`btn btn-sm ${isRefreshing ? 'btn-secondary' : 'btn-outline-primary'}`}
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            title="Refresh live data"
          >
            {isRefreshing ? (
              <div className="spinner-border spinner-border-sm" role="status">
                <span className="visually-hidden">Refreshing...</span>
              </div>
            ) : (
              '🔄'
            )}
          </button>
        </div>
      </div>

      <div className="card-body pt-2">
        {/* Price Section */}
        <div className="mb-3">
          <div className="d-flex flex-column">
            <span className={`h5 mb-0 ${!kiteAPI.isReady() && liveStock.price === 0 ? 'text-muted' : ''}`}>
              {liveStock.price === 0 && !kiteAPI.isReady() ? 'Login for live price' : formatPrice(liveStock.price)}
            </span>
            <small className="text-muted">
              {kiteAPI.isReady() ? 'Live Price' : 'Requires Authentication'} {liveStock.previousClose && kiteAPI.isReady() && (
                `• Prev: ₹${liveStock.previousClose.toFixed(2)}`
              )}
            </small>
          </div>
        </div>

        {/* Change Indicators */}
        {kiteAPI.isReady() && liveStock.price > 0 ? (
          <div className="d-flex gap-2 mb-3">
            {liveStock.change !== 0 && (
              <span className={`badge ${liveStock.change >= 0 ? 'bg-success' : 'bg-danger'}`}>
                {formatChange(liveStock.change)}
              </span>
            )}
            {liveStock.changePercent !== 0 && (
              <span className={`badge ${liveStock.changePercent >= 0 ? 'bg-success' : 'bg-danger'}`}>
                {formatChangePercent(liveStock.changePercent)}
              </span>
            )}
          </div>
        ) : (
          <div className="d-flex gap-2 mb-3">
            <span className="badge bg-secondary">Login Required</span>
          </div>
        )}

        {/* Stock Stats */}
        {(
          (liveStock.volume && liveStock.volume > 0) ||
          (liveStock.marketCap && liveStock.marketCap !== '0' && liveStock.marketCap !== '') ||
          (liveStock.dayHigh && liveStock.dayLow && liveStock.dayHigh > 0 && liveStock.dayLow > 0) ||
          (liveStock.fiftyTwoWeekHigh && liveStock.fiftyTwoWeekLow && liveStock.fiftyTwoWeekHigh > 0 && liveStock.fiftyTwoWeekLow > 0)
        ) && (
          <div className="row g-2 mb-3">
            {liveStock.volume && liveStock.volume > 0 && (
              <div className="col-12">
                <small className="text-muted">Volume:</small>
                <div className="fw-bold">{formatVolume(liveStock.volume)}</div>
              </div>
            )}
            {liveStock.marketCap && liveStock.marketCap !== '0' && liveStock.marketCap !== '' && (
              <div className="col-12">
                <small className="text-muted">Market Cap:</small>
                <div className="fw-bold">{liveStock.marketCap}</div>
              </div>
            )}
            {liveStock.dayHigh && liveStock.dayLow && liveStock.dayHigh > 0 && liveStock.dayLow > 0 && (
              <div className="col-12">
                <small className="text-muted">Day Range:</small>
                <div className="fw-bold">₹{liveStock.dayLow.toFixed(2)} - ₹{liveStock.dayHigh.toFixed(2)}</div>
              </div>
            )}
            {liveStock.fiftyTwoWeekHigh && liveStock.fiftyTwoWeekLow && liveStock.fiftyTwoWeekHigh > 0 && liveStock.fiftyTwoWeekLow > 0 && (
              <div className="col-12">
                <small className="text-muted">52W Range:</small>
                <div className="fw-bold">₹{liveStock.fiftyTwoWeekLow.toFixed(2)} - ₹{liveStock.fiftyTwoWeekHigh.toFixed(2)}</div>
              </div>
            )}
          </div>
        )}

        {/* Chart Section */}
        <div className="border-top pt-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <button 
              className={`btn btn-sm ${showChart ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setShowChart(!showChart)}
            >
              📊 {showChart ? 'Hide' : 'Show'} Chart
            </button>
          </div>

          {/* Chart Display */}
          {showChart && (
            <div className="chart-container">
              <SimpleChart 
                symbol={liveStock.symbol} 
                width={280} 
                height={140}
                className="w-100"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default StockCard