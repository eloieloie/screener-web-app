import { useState, useEffect, useCallback } from 'react'
import type { Stock } from '../types/Stock'
import { formatVolume } from '../utils/formatters'
import SimpleChart from './SimpleChart'
import { refreshStockPrice } from '../services/stockService'

interface StockCardProps {
  stock: Stock
  onRemove: () => void
}

const isSameLocalDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

const StockCard = ({ stock, onRemove }: StockCardProps) => {
  const [showChart, setShowChart] = useState(true) // Show charts by default for Firebase stocks
  const [liveStock, setLiveStock] = useState<Stock>(stock)
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(stock.cachedPriceData?.lastUpdated ? new Date(stock.cachedPriceData.lastUpdated) : null)
  const [error, setError] = useState<string | null>(null)
  
  // Quotes are refreshed from the API at most once per day. The result is saved
  // to Firestore (refreshStockPrice), so every later load reads the saved price.
  const fetchLiveData = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) setIsRefreshing(true)
      setError(null)

      const fresh = await refreshStockPrice(stock.id, stock.symbol, stock.exchange || 'NSE')
      setLiveStock(prev => ({ ...fresh, id: prev.id }))
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Error refreshing stock data:', err)
      setError('Failed to refresh price data')
    } finally {
      if (showLoading) setIsRefreshing(false)
      setIsLoading(false)
    }
  }, [stock.id, stock.symbol, stock.exchange])

  useEffect(() => {
    const saved = stock.cachedPriceData?.lastUpdated
    const fetchedToday = !!saved && stock.price > 0 && isSameLocalDay(new Date(saved), new Date())
    if (fetchedToday) return // already refreshed today — use the Firestore copy
    setIsLoading(true)
    fetchLiveData()
    // Intentionally runs once per mount: no polling, no refetch on prop updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
  
  const formatLastUpdated = (date: Date | null) => {
    if (!date) return 'never'
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
          <small className="text-muted">
            Daily data • Updated {formatLastUpdated(lastUpdated)}
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
            title="Refresh price now"
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
            <span className="h5 mb-0">{formatPrice(liveStock.price)}</span>
            <small className="text-muted">
              Last close {liveStock.previousClose ? `• Prev: ₹${liveStock.previousClose.toFixed(2)}` : ''}
            </small>
          </div>
        </div>

        {/* Change Indicators */}
        {liveStock.price > 0 ? (
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
            <span className="badge bg-secondary">No price yet</span>
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
                exchange={liveStock.exchange}
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