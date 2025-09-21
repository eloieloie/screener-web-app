import { useState, useEffect } from 'react'
import type { Stock } from '../types/Stock'
import EnhancedChart from '../components/EnhancedChart'
import { subscribeToStocks } from '../services/stockService'

type Duration = '1month' | '6months' | '1year' | '3years' | '5years'

const ChartsPage = () => {
  const [stocks, setStocks] = useState<Stock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDuration, setSelectedDuration] = useState<Duration>('6months')

  const durationOptions = [
    { value: '1month', label: '1 Month', icon: '📅' },
    { value: '6months', label: '6 Months', icon: '📊' },
    { value: '1year', label: '1 Year', icon: '📈' },
    { value: '3years', label: '3 Years', icon: '📉' },
    { value: '5years', label: '5 Years', icon: '🗓️' }
  ] as const

  // Subscribe to stocks from database
  useEffect(() => {
    let unsubscribe: (() => void) | null = null
    
    try {
      unsubscribe = subscribeToStocks((stockList) => {
        setStocks(stockList)
        setLoading(false)
        setError(null)
      })
    } catch (err) {
      console.error('Error setting up stock subscription:', err)
      setError('Failed to connect to the database. Please check your internet connection.')
      setLoading(false)
    }

    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [])

  if (loading) {
    return (
      <div className="container mt-4">
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3">Loading your stock charts...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mt-4">
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      </div>
    )
  }

  if (stocks.length === 0) {
    return (
      <div className="container mt-4">
        <div className="text-center py-5">
          <div className="display-1">📊</div>
          <h2 className="h3 mt-3">No Stocks to Chart</h2>
          <p className="text-muted">Add some stocks to your portfolio first to see their charts here.</p>
          <p className="text-muted">You can add stocks from the "My Stocks" page.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mt-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2>📊 Stock Charts</h2>
          <p className="text-muted mb-0">Historical price charts for your tracked stocks</p>
        </div>
        <div className="badge bg-secondary fs-6">
          {stocks.length} chart{stocks.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Duration Selector */}
      <div className="card mb-4">
        <div className="card-body">
          <h5 className="card-title mb-3">⏱️ Time Period</h5>
          <div className="btn-group" role="group" aria-label="Duration selector">
            {durationOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`btn ${selectedDuration === option.value ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => setSelectedDuration(option.value)}
              >
                {option.icon} {option.label}
              </button>
            ))}
          </div>
          <div className="mt-2">
            <small className="text-muted">
              Currently showing: <strong>{durationOptions.find(opt => opt.value === selectedDuration)?.label}</strong> charts
            </small>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="row g-4">
        {stocks.map((stock) => (
          <div key={stock.id} className="col-lg-6 col-xl-4">
            <div className="card h-100 shadow-sm">
              <div className="card-body">
                <EnhancedChart
                  symbol={stock.symbol}
                  duration={selectedDuration}
                  width={350}
                  height={220}
                  className="w-100"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer Info */}
      <div className="row mt-4">
        <div className="col-12">
          <div className="card border-0 bg-light">
            <div className="card-body text-center py-3">
              <small className="text-muted">
                📊 Charts update automatically when authenticated with Zerodha Kite • 
                🔄 Data refreshes every 30 seconds during market hours • 
                💡 Sample data shown when not authenticated
              </small>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChartsPage