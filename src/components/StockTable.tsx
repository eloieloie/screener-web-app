import React, { useState, useEffect, useCallback, useMemo } from 'react'
import type { Stock } from '../types/Stock'
import SimpleChart from './SimpleChart'
import KiteConnectAPI from '../services/KiteConnectAPI'

interface StockTableProps {
  stocks: Stock[]
  onRemoveStock: (id: string) => void
  onNavigateToChartsWithTag: (tag: string) => void
}

const StockTable = ({ stocks, onRemoveStock, onNavigateToChartsWithTag }: StockTableProps) => {
  const [liveStocks, setLiveStocks] = useState<Stock[]>(stocks)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [expandedCharts, setExpandedCharts] = useState<Set<string>>(new Set())
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Stock
    direction: 'asc' | 'desc'
  } | null>(null)

  // Initialize KiteConnect API
  const kiteAPI = useMemo(() => KiteConnectAPI.getInstance(), [])

  // Fetch live data for all stocks
  const fetchAllLiveData = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setIsRefreshing(true)
    }

    try {
      if (!kiteAPI.isReady()) {
        setLiveStocks(stocks)
        return
      }

      const updatedStocks = await Promise.all(
        stocks.map(async (stock) => {
          try {
            const freshData = await kiteAPI.getStockQuote(stock.symbol)
            return freshData ? { ...stock, ...freshData } : stock
          } catch (error) {
            console.error(`Error fetching data for ${stock.symbol}:`, error)
            return stock
          }
        })
      )

      setLiveStocks(updatedStocks)
      setLastUpdated(new Date())
    } catch (error) {
      console.error('Error fetching live data:', error)
    } finally {
      if (showLoading) {
        setIsRefreshing(false)
      }
    }
  }, [stocks, kiteAPI])

  // Update live stocks when props change
  useEffect(() => {
    setLiveStocks(stocks)
    fetchAllLiveData()
  }, [stocks, fetchAllLiveData])

  // Auto-refresh during market hours
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date()
      const currentHour = now.getHours()
      const currentMinute = now.getMinutes()
      const isWeekday = now.getDay() >= 1 && now.getDay() <= 5
      
      const isMarketHours = isWeekday && 
        ((currentHour > 9) || (currentHour === 9 && currentMinute >= 15)) &&
        ((currentHour < 15) || (currentHour === 15 && currentMinute <= 30))
      
      if (isMarketHours && kiteAPI.isReady()) {
        fetchAllLiveData()
      }
    }, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [fetchAllLiveData, kiteAPI])

  const handleSort = (key: keyof Stock) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  const sortedStocks = useMemo(() => {
    if (!sortConfig) return liveStocks

    return [...liveStocks].sort((a, b) => {
      const aValue = a[sortConfig.key]
      const bValue = b[sortConfig.key]

      if (aValue === null || aValue === undefined) return 1
      if (bValue === null || bValue === undefined) return -1

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue
      }

      const aString = String(aValue).toLowerCase()
      const bString = String(bValue).toLowerCase()
      
      if (sortConfig.direction === 'asc') {
        return aString < bString ? -1 : aString > bString ? 1 : 0
      } else {
        return aString > bString ? -1 : aString < bString ? 1 : 0
      }
    })
  }, [liveStocks, sortConfig])

  const toggleChart = (stockId: string) => {
    setExpandedCharts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(stockId)) {
        newSet.delete(stockId)
      } else {
        newSet.add(stockId)
      }
      return newSet
    })
  }

  const formatPrice = (price: number) => price > 0 ? `₹${price.toFixed(2)}` : '-'
  
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
      return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    }
  }

  const getSortIcon = (columnKey: keyof Stock) => {
    if (!sortConfig || sortConfig.key !== columnKey) {
      return '↕️'
    }
    return sortConfig.direction === 'asc' ? '↑' : '↓'
  }

  return (
    <div className="card shadow-sm">
      <div className="card-header bg-white border-0 d-flex justify-content-between align-items-center">
        <h5 className="mb-0">📊 Stock Portfolio</h5>
        <div className="d-flex align-items-center gap-3">
          <small className={kiteAPI.isReady() ? "text-success" : "text-warning"}>
            {kiteAPI.isReady() ? 
              `📈 Live Data • Updated ${formatLastUpdated(lastUpdated)}` : 
              `⚠️ Cached Data • Login for live prices`
            }
          </small>
          <button 
            className={`btn btn-sm ${isRefreshing ? 'btn-secondary' : 'btn-outline-primary'}`}
            onClick={() => fetchAllLiveData(true)}
            disabled={isRefreshing}
            title="Refresh all data"
          >
            {isRefreshing ? (
              <div className="spinner-border spinner-border-sm" role="status">
                <span className="visually-hidden">Refreshing...</span>
              </div>
            ) : (
              '🔄 Refresh All'
            )}
          </button>
        </div>
      </div>
      
      <div className="card-body p-0">
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead className="table-light">
              <tr>
                <th 
                  className="border-0 cursor-pointer user-select-none"
                  onClick={() => handleSort('symbol')}
                  style={{ cursor: 'pointer' }}
                >
                  Stock {getSortIcon('symbol')}
                </th>
                <th className="border-0">
                  Tags
                </th>
                <th 
                  className="border-0 cursor-pointer user-select-none text-end"
                  onClick={() => handleSort('price')}
                  style={{ cursor: 'pointer' }}
                >
                  Price {getSortIcon('price')}
                </th>
                <th className="border-0 text-center">Chart</th>
                <th className="border-0 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedStocks.map((stock) => (
                <React.Fragment key={stock.id}>
                  <tr className="align-middle">
                    <td className="border-0">
                      <div>
                        <div className="d-flex align-items-center">
                          <strong>{stock.symbol}</strong>
                          {stock.exchange && (
                            <span className={`badge ms-2 ${stock.exchange === 'NSE' ? 'bg-primary' : 'bg-warning'}`}>
                              {stock.exchange}
                            </span>
                          )}
                        </div>
                        <small className="text-muted">{stock.name}</small>
                      </div>
                    </td>
                    <td className="border-0">
                      {stock.tags && stock.tags.length > 0 ? (
                        <div className="d-flex flex-wrap gap-1">
                          {stock.tags.map((tag, index) => (
                            <button
                              key={index}
                              className="badge bg-light text-dark border-0"
                              style={{ 
                                fontSize: '0.65em',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s'
                              }}
                              onClick={() => onNavigateToChartsWithTag(tag)}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#e9ecef'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#f8f9fa'
                              }}
                              title={`View charts for stocks tagged with "${tag}"`}
                            >
                              🏷️ {tag}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted small">No tags</span>
                      )}
                    </td>
                    <td className="border-0 text-end">
                      <div className={`fw-bold ${!kiteAPI.isReady() && stock.price === 0 ? 'text-muted' : ''}`}>
                        {stock.price === 0 && !kiteAPI.isReady() ? 'Login Required' : formatPrice(stock.price)}
                      </div>
                    </td>
                    <td className="border-0 text-center">
                      <button 
                        className={`btn btn-sm ${expandedCharts.has(stock.id) ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => toggleChart(stock.id)}
                      >
                        📊 {expandedCharts.has(stock.id) ? 'Hide' : 'Show'}
                      </button>
                    </td>
                    <td className="border-0 text-center">
                      <button 
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => onRemoveStock(stock.id)}
                        title="Remove stock"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                  {expandedCharts.has(stock.id) && (
                    <tr>
                      <td colSpan={5} className="border-0 bg-light p-3">
                        <div className="d-flex justify-content-center">
                          <SimpleChart 
                            symbol={stock.symbol} 
                            width={600} 
                            height={200}
                            className="w-100"
                          />
                        </div>
                        {/* Additional stock stats */}
                        {(stock.dayHigh || stock.dayLow || stock.fiftyTwoWeekHigh || stock.fiftyTwoWeekLow || stock.marketCap) && (
                          <div className="row mt-3 g-3">
                            {stock.dayHigh && stock.dayLow && stock.dayHigh > 0 && stock.dayLow > 0 && (
                              <div className="col-md-3">
                                <small className="text-muted d-block">Day Range</small>
                                <strong>₹{stock.dayLow.toFixed(2)} - ₹{stock.dayHigh.toFixed(2)}</strong>
                              </div>
                            )}
                            {stock.fiftyTwoWeekHigh && stock.fiftyTwoWeekLow && stock.fiftyTwoWeekHigh > 0 && stock.fiftyTwoWeekLow > 0 && (
                              <div className="col-md-3">
                                <small className="text-muted d-block">52W Range</small>
                                <strong>₹{stock.fiftyTwoWeekLow.toFixed(2)} - ₹{stock.fiftyTwoWeekHigh.toFixed(2)}</strong>
                              </div>
                            )}
                            {stock.marketCap && stock.marketCap !== '0' && stock.marketCap !== '' && (
                              <div className="col-md-3">
                                <small className="text-muted d-block">Market Cap</small>
                                <strong>{stock.marketCap}</strong>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default StockTable