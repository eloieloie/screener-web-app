import { useState, useEffect } from 'react'
import type { Stock } from '../types/Stock'
import { subscribeToStocks } from '../services/stockService'
import ChartWidget from './ChartWidget'

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
      <div className="container">
        <div className="text-center mb-4">
          <h1 className="display-5">Portfolio Analytics</h1>
          <p className="text-muted">Analyzing your investment performance</p>
        </div>
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3">Loading analytics...</p>
        </div>
      </div>
    )
  }

  if (!stats || stocks.length === 0) {
    return (
      <div className="container">
        <div className="text-center mb-4">
          <h1 className="display-5">Portfolio Analytics</h1>
          <p className="text-muted">Gain insights into your investment performance</p>
        </div>
        <div className="text-center py-5">
          <div className="display-1">📈</div>
          <h2 className="h3 mt-3">No Data Available</h2>
          <p className="text-muted">Add some stocks to your portfolio to see detailed analytics and performance insights.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="text-center mb-4">
        <h1 className="display-5">Portfolio Analytics</h1>
        <p className="text-muted">Track your investment performance and insights</p>
      </div>

      {/* Chart Widget Section */}
      {selectedStockForChart && (
        <div className="card mb-4">
          <div className="card-header">
            <div className="row align-items-center">
              <div className="col">
                <h5 className="card-title mb-0">Stock Chart</h5>
              </div>
              <div className="col-auto">
                <select 
                  className="form-select form-select-sm"
                  value={selectedStockForChart}
                  onChange={(e) => setSelectedStockForChart(e.target.value)}
                >
                  {stocks.map(stock => (
                    <option key={stock.symbol} value={stock.symbol}>
                      {stock.symbol} - {stock.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="card-body">
            <ChartWidget symbol={selectedStockForChart} />
          </div>
        </div>
      )}

      <div className="row g-4">
        {/* Portfolio Overview */}
        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-header">
              <h5 className="card-title mb-0">Portfolio Overview</h5>
            </div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-6">
                  <div className="text-center">
                    <div className="h5 mb-1">{formatCurrency(stats.totalValue)}</div>
                    <small className="text-muted">Total Value</small>
                  </div>
                </div>
                <div className="col-6">
                  <div className="text-center">
                    <div className={`h5 mb-1 ${stats.totalGain >= 0 ? 'text-success' : 'text-danger'}`}>
                      {formatCurrency(stats.totalGain)}
                    </div>
                    <small className="text-muted">Total Gain/Loss</small>
                  </div>
                </div>
                <div className="col-6">
                  <div className="text-center">
                    <div className={`h5 mb-1 ${stats.totalGainPercent >= 0 ? 'text-success' : 'text-danger'}`}>
                      {formatPercent(stats.totalGainPercent)}
                    </div>
                    <small className="text-muted">Return %</small>
                  </div>
                </div>
                <div className="col-6">
                  <div className="text-center">
                    <div className="h5 mb-1">{stocks.length}</div>
                    <small className="text-muted">Holdings</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Best Performer */}
        {stats.bestPerformer && (
          <div className="col-lg-3 col-md-6">
            <div className="card h-100 border-success">
              <div className="card-header bg-success text-white">
                <h6 className="card-title mb-0">🏆 Best Performer</h6>
              </div>
              <div className="card-body text-center">
                <div className="h5 mb-1">{stats.bestPerformer.symbol}</div>
                <div className="small text-muted mb-2">{stats.bestPerformer.name}</div>
                <div className="h6 text-success mb-1">
                  {formatPercent(stats.bestPerformer.changePercent || 0)}
                </div>
                <div className="small">
                  {formatCurrency(stats.bestPerformer.price || 0)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Worst Performer */}
        {stats.worstPerformer && (
          <div className="col-lg-3 col-md-6">
            <div className="card h-100 border-danger">
              <div className="card-header bg-danger text-white">
                <h6 className="card-title mb-0">📉 Needs Attention</h6>
              </div>
              <div className="card-body text-center">
                <div className="h5 mb-1">{stats.worstPerformer.symbol}</div>
                <div className="small text-muted mb-2">{stats.worstPerformer.name}</div>
                <div className="h6 text-danger mb-1">
                  {formatPercent(stats.worstPerformer.changePercent || 0)}
                </div>
                <div className="small">
                  {formatCurrency(stats.worstPerformer.price || 0)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sector Distribution */}
        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-header">
              <h5 className="card-title mb-0">Top Holdings by Value</h5>
            </div>
            <div className="card-body">
              {stats.topSectors.map((sector, index) => (
                <div key={sector.name} className="d-flex justify-content-between align-items-center mb-3">
                  <div>
                    <div className="fw-bold">Group {sector.name}</div>
                    <small className="text-muted">{sector.count} stocks</small>
                  </div>
                  <div className="text-end">
                    <div className="fw-bold">{formatCurrency(sector.value)}</div>
                    <div className="progress mt-1" style={{ width: '100px', height: '6px' }}>
                      <div 
                        className="progress-bar"
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
        </div>

        {/* Market Summary */}
        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-header">
              <h5 className="card-title mb-0">Market Summary</h5>
            </div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-6">
                  <div className="text-center">
                    <div className="h5 mb-1">{stocks.length}</div>
                    <small className="text-muted">Stocks Tracked</small>
                  </div>
                </div>
                <div className="col-6">
                  <div className="text-center">
                    <div className="h5 mb-1 text-success">
                      {stocks.filter(s => (s.changePercent || 0) > 0).length}
                    </div>
                    <small className="text-muted">Gainers</small>
                  </div>
                </div>
                <div className="col-6">
                  <div className="text-center">
                    <div className="h5 mb-1 text-danger">
                      {stocks.filter(s => (s.changePercent || 0) < 0).length}
                    </div>
                    <small className="text-muted">Losers</small>
                  </div>
                </div>
                <div className="col-6">
                  <div className="text-center">
                    <div className={`h5 mb-1 ${stats.totalGainPercent >= 0 ? 'text-success' : 'text-danger'}`}>
                      {formatPercent(stats.totalGainPercent)}
                    </div>
                    <small className="text-muted">Avg. Change</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title mb-0">Recent Activity</h5>
            </div>
            <div className="card-body">
              <div className="row g-3">
                {stocks.slice(0, 5).map(stock => (
                  <div key={stock.id} className="col-lg-2 col-md-4 col-sm-6">
                    <div className="text-center p-2 border rounded">
                      <div className="fw-bold">{stock.symbol}</div>
                      <div className="small mb-1">{formatCurrency(stock.price || 0)}</div>
                      <div className={`badge ${(stock.changePercent || 0) >= 0 ? 'bg-success' : 'bg-danger'}`}>
                        {formatPercent(stock.changePercent || 0)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Analytics