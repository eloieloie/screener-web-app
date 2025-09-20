import { useState, useEffect } from 'react'
import type { Stock } from '../types/Stock'
import { subscribeToStocks } from '../services/stockService'
import ChartWidget from './ChartWidget'
import './Analytics.css'

interface PortfolioStats {
  totalValue: number
  totalGain: number
  totalGainPercent: number
  bestPerformer: Stock | null
  worstPerformer: Stock | null
  topSectors: { name: string; count: number; value: number }[]
}

function Analytics() {
  const [stocks, setStocks] = useState<Stock[]>([])
  const [stats, setStats] = useState<PortfolioStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedStockForChart, setSelectedStockForChart] = useState<string>('')

  useEffect(() => {
    const unsubscribe = subscribeToStocks((stockList) => {
      setStocks(stockList)
      calculateStats(stockList)
      setLoading(false)
      
      // Auto-select first stock for chart if none selected
      if (stockList.length > 0 && !selectedStockForChart) {
        setSelectedStockForChart(stockList[0].symbol)
      }
    })

    return () => unsubscribe()
  }, [selectedStockForChart])

  const calculateStats = (stockList: Stock[]) => {
    if (stockList.length === 0) {
      setStats(null)
      return
    }

    const totalValue = stockList.reduce((sum, stock) => sum + (stock.price || 0), 0)
    const totalGain = stockList.reduce((sum, stock) => {
      const change = stock.price && stock.previousClose ? stock.price - stock.previousClose : 0
      return sum + change
    }, 0)
    const totalGainPercent = totalValue > 0 ? (totalGain / (totalValue - totalGain)) * 100 : 0

    // Find best and worst performers
    let bestPerformer: Stock | null = null
    let worstPerformer: Stock | null = null
    let bestChange = -Infinity
    let worstChange = Infinity

    stockList.forEach(stock => {
      const changePercent = stock.changePercent || 0
      if (changePercent > bestChange) {
        bestChange = changePercent
        bestPerformer = stock
      }
      if (changePercent < worstChange) {
        worstChange = changePercent
        worstPerformer = stock
      }
    })

    // Group by sectors (simplified - using first letter of symbol as sector indicator)
    const sectorMap = new Map<string, { count: number; value: number }>()
    stockList.forEach(stock => {
      const sector = stock.symbol.charAt(0).toUpperCase() // Simplified sector grouping
      const existing = sectorMap.get(sector) || { count: 0, value: 0 }
      sectorMap.set(sector, {
        count: existing.count + 1,
        value: existing.value + (stock.price || 0)
      })
    })

    const topSectors = Array.from(sectorMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 3)

    setStats({
      totalValue,
      totalGain,
      totalGainPercent,
      bestPerformer,
      worstPerformer,
      topSectors
    })
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(value)
  }

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
  }

  if (loading) {
    return (
      <div className="analytics">
        <div className="analytics-header">
          <h1>Portfolio Analytics</h1>
          <p>Analyzing your investment performance</p>
        </div>
        <div className="loading-state">
          <div>📊</div>
          <p>Loading analytics...</p>
        </div>
      </div>
    )
  }

  if (!stats || stocks.length === 0) {
    return (
      <div className="analytics">
        <div className="analytics-header">
          <h1>Portfolio Analytics</h1>
          <p>Gain insights into your investment performance</p>
        </div>
        <div className="empty-analytics">
          <div className="empty-icon">📈</div>
          <h2>No Data Available</h2>
          <p>Add some stocks to your portfolio to see detailed analytics and performance insights.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="analytics">
      <div className="analytics-header">
        <h1>Portfolio Analytics</h1>
        <p>Track your investment performance and insights</p>
      </div>

      {/* Chart Widget Section */}
      {selectedStockForChart && (
        <div className="chart-section">
          <div className="chart-selector">
            <label htmlFor="stock-selector">Select Stock for Chart:</label>
            <select 
              id="stock-selector"
              value={selectedStockForChart}
              onChange={(e) => setSelectedStockForChart(e.target.value)}
              className="stock-selector"
            >
              {stocks.map(stock => (
                <option key={stock.symbol} value={stock.symbol}>
                  {stock.symbol} - {stock.name}
                </option>
              ))}
            </select>
          </div>
          <ChartWidget symbol={selectedStockForChart} />
        </div>
      )}

      <div className="analytics-grid">
        {/* Portfolio Overview */}
        <div className="analytics-card overview-card">
          <h3>Portfolio Overview</h3>
          <div className="overview-stats">
            <div className="stat-item">
              <span className="stat-label">Total Value</span>
              <span className="stat-value">{formatCurrency(stats.totalValue)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Total Gain/Loss</span>
              <span className={`stat-value ${stats.totalGain >= 0 ? 'positive' : 'negative'}`}>
                {formatCurrency(stats.totalGain)}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Return %</span>
              <span className={`stat-value ${stats.totalGainPercent >= 0 ? 'positive' : 'negative'}`}>
                {formatPercent(stats.totalGainPercent)}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Holdings</span>
              <span className="stat-value">{stocks.length} stocks</span>
            </div>
          </div>
        </div>

        {/* Best Performer */}
        {stats.bestPerformer && (
          <div className="analytics-card performer-card best">
            <h3>🏆 Best Performer</h3>
            <div className="performer-info">
              <div className="performer-symbol">{stats.bestPerformer.symbol}</div>
              <div className="performer-name">{stats.bestPerformer.name}</div>
              <div className="performer-change positive">
                {formatPercent(stats.bestPerformer.changePercent || 0)}
              </div>
              <div className="performer-price">
                {formatCurrency(stats.bestPerformer.price || 0)}
              </div>
            </div>
          </div>
        )}

        {/* Worst Performer */}
        {stats.worstPerformer && (
          <div className="analytics-card performer-card worst">
            <h3>📉 Needs Attention</h3>
            <div className="performer-info">
              <div className="performer-symbol">{stats.worstPerformer.symbol}</div>
              <div className="performer-name">{stats.worstPerformer.name}</div>
              <div className="performer-change negative">
                {formatPercent(stats.worstPerformer.changePercent || 0)}
              </div>
              <div className="performer-price">
                {formatCurrency(stats.worstPerformer.price || 0)}
              </div>
            </div>
          </div>
        )}

        {/* Sector Distribution */}
        <div className="analytics-card sector-card">
          <h3>Top Holdings by Value</h3>
          <div className="sector-list">
            {stats.topSectors.map((sector, index) => (
              <div key={sector.name} className="sector-item">
                <div className="sector-info">
                  <span className="sector-name">Group {sector.name}</span>
                  <span className="sector-count">{sector.count} stocks</span>
                </div>
                <div className="sector-value">
                  <span className="sector-amount">{formatCurrency(sector.value)}</span>
                  <div className="sector-bar">
                    <div 
                      className="sector-fill"
                      style={{ 
                        width: `${(sector.value / stats.totalValue) * 100}%`,
                        backgroundColor: `hsl(${220 + index * 30}, 70%, 60%)`
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Market Summary */}
        <div className="analytics-card market-card">
          <h3>Market Summary</h3>
          <div className="market-stats">
            <div className="market-item">
              <span className="market-label">Stocks Tracked</span>
              <span className="market-value">{stocks.length}</span>
            </div>
            <div className="market-item">
              <span className="market-label">Gainers</span>
              <span className="market-value positive">
                {stocks.filter(s => (s.changePercent || 0) > 0).length}
              </span>
            </div>
            <div className="market-item">
              <span className="market-label">Losers</span>
              <span className="market-value negative">
                {stocks.filter(s => (s.changePercent || 0) < 0).length}
              </span>
            </div>
            <div className="market-item">
              <span className="market-label">Avg. Change</span>
              <span className={`market-value ${stats.totalGainPercent >= 0 ? 'positive' : 'negative'}`}>
                {formatPercent(stats.totalGainPercent)}
              </span>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="analytics-card activity-card">
          <h3>Recent Activity</h3>
          <div className="activity-list">
            {stocks.slice(0, 5).map(stock => (
              <div key={stock.id} className="activity-item">
                <div className="activity-symbol">{stock.symbol}</div>
                <div className="activity-details">
                  <span className="activity-price">{formatCurrency(stock.price || 0)}</span>
                  <span className={`activity-change ${(stock.changePercent || 0) >= 0 ? 'positive' : 'negative'}`}>
                    {formatPercent(stock.changePercent || 0)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Analytics