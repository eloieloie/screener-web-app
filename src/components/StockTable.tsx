import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type { Stock } from '../types/Stock'
import SimpleChart from './SimpleChart'

interface StockTableProps {
  stocks: Stock[]
  onRemoveStock: (id: string) => void
  onNavigateToChartsWithTag: (tag: string) => void
  onRefreshStock?: (stockId: string, symbol: string, exchange: string) => Promise<void>
}

const StockTable = ({ stocks, onRemoveStock, onNavigateToChartsWithTag, onRefreshStock }: StockTableProps) => {
  const [expandedCharts, setExpandedCharts] = useState<Set<string>>(new Set())
  const [refreshingStocks, setRefreshingStocks] = useState<Set<string>>(new Set())
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Stock
    direction: 'asc' | 'desc'
  } | null>(null)

  // Handle individual stock refresh
  const handleRefreshStock = async (stock: Stock) => {
    if (!onRefreshStock) return
    
    setRefreshingStocks(prev => new Set(prev.add(stock.id)))
    
    try {
      await onRefreshStock(stock.id, stock.symbol, stock.exchange || 'NSE')
    } catch (error) {
      console.error(`Error refreshing ${stock.symbol}:`, error)
    } finally {
      setRefreshingStocks(prev => {
        const newSet = new Set(prev)
        newSet.delete(stock.id)
        return newSet
      })
    }
  }

  const handleSort = (key: keyof Stock) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  const sortedStocks = useMemo(() => {
    if (!sortConfig) return stocks

    return [...stocks].sort((a, b) => {
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
  }, [stocks, sortConfig])

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
          <small className="text-info">
            � Cached Prices • Use refresh buttons to update
          </small>
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
                <th className="border-0 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedStocks.map((stock, rowIndex) => (
                <React.Fragment key={stock.id}>
                  <motion.tr
                    className="align-middle"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: Math.min(rowIndex * 0.03, 0.5) }}
                  >
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
                            <motion.button
                              key={index}
                              whileHover={{ scale: 1.08, backgroundColor: '#e9ecef' }}
                              whileTap={{ scale: 0.95 }}
                              className="badge bg-light text-dark border-0"
                              style={{ fontSize: '0.65em', cursor: 'pointer' }}
                              onClick={() => onNavigateToChartsWithTag(tag)}
                              title={`View charts for stocks tagged with "${tag}"`}
                            >
                              🏷️ {tag}
                            </motion.button>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted small">No tags</span>
                      )}
                    </td>
                    <td className="border-0 text-end">
                      <div className={`fw-bold ${stock.price === 0 ? 'text-muted' : ''}`}>
                        {stock.price === 0 ? 'No Data' : formatPrice(stock.price)}
                      </div>
                      {stock.cachedPriceData && (
                        <div className="small text-muted">
                          Updated: {new Date(stock.cachedPriceData.lastUpdated).toLocaleTimeString()}
                        </div>
                      )}
                    </td>
                    <td className="border-0 text-center">
                      <div className="d-flex gap-1 justify-content-center">
                        {onRefreshStock && (
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            className="btn btn-sm btn-outline-success"
                            onClick={() => handleRefreshStock(stock)}
                            disabled={refreshingStocks.has(stock.id)}
                            title="Refresh price"
                          >
                            {refreshingStocks.has(stock.id) ? (
                              <div className="spinner-border spinner-border-sm" role="status">
                                <span className="visually-hidden">Refreshing...</span>
                              </div>
                            ) : (
                              '🔄'
                            )}
                          </motion.button>
                        )}
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className={`btn btn-sm ${expandedCharts.has(stock.id) ? 'btn-primary' : 'btn-outline-primary'}`}
                          onClick={() => toggleChart(stock.id)}
                        >
                          📊 {expandedCharts.has(stock.id) ? 'Hide' : 'Show'}
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => onRemoveStock(stock.id)}
                          title="Remove stock"
                        >
                          🗑️
                        </motion.button>
                      </div>
                    </td>
                  </motion.tr>
                  <AnimatePresence>
                    {expandedCharts.has(stock.id) && (
                      <motion.tr
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <td colSpan={4} className="border-0 bg-light p-3">
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.25, delay: 0.05 }}
                          >
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
                          </motion.div>
                        </td>
                      </motion.tr>
                    )}
                  </AnimatePresence>
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