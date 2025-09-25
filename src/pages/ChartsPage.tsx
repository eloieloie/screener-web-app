import { useState, useEffect, useMemo, useRef } from 'react'
import type { Stock } from '../types/Stock'
import EnhancedChart from '../components/EnhancedChart'
import { subscribeToStocks } from '../services/stockService'

type Duration = '1month' | '6months' | '1year' | '3years' | '5years'

interface ChartsPageProps {
  selectedTag?: string | null
  onClearTagFilter?: () => void
}

const ChartsPage = ({ selectedTag, onClearTagFilter }: ChartsPageProps) => {
  const [stocks, setStocks] = useState<Stock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDuration, setSelectedDuration] = useState<Duration>('6months')
  const [failedCharts, setFailedCharts] = useState<Set<string>>(new Set())
  const [refreshingCharts, setRefreshingCharts] = useState<Set<string>>(new Set())
  const chartRefs = useRef<Map<string, { hasError: boolean, refresh: () => void }>>(new Map())

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

  // Filter stocks based on selected tag
  const filteredStocks = useMemo(() => {
    if (!selectedTag) return stocks
    return stocks.filter(stock => 
      stock.tags && stock.tags.includes(selectedTag)
    )
  }, [stocks, selectedTag])

  // Handle chart error reporting (only for "Failed to load fresh data" errors)
  const handleChartError = (symbol: string, hasError: boolean, errorMessage?: string) => {
    setFailedCharts(prev => {
      const newSet = new Set(prev)
      // Only track charts that specifically failed to load fresh data
      if (hasError && errorMessage === 'Failed to load fresh data') {
        newSet.add(symbol)
      } else {
        newSet.delete(symbol)
      }
      return newSet
    })
  }

  // Register chart ref for refresh functionality
  const registerChartRef = (symbol: string, refreshFn: () => void) => {
    chartRefs.current.set(symbol, { hasError: false, refresh: refreshFn })
  }

  // Refresh only failed charts
  const handleRefreshFailedCharts = async () => {
    const failedSymbols = Array.from(failedCharts)
    if (failedSymbols.length === 0) return

    setRefreshingCharts(new Set(failedSymbols))

    // Add delays between refreshes to avoid hitting rate limits
    for (const symbol of failedSymbols) {
      const chartRef = chartRefs.current.get(symbol)
      if (chartRef) {
        chartRef.refresh()
        // Wait 500ms between each refresh to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    // Clear refreshing state after all attempts
    setTimeout(() => {
      setRefreshingCharts(new Set())
    }, 2000)
  }

  if (loading) {
    return (
      <div className="container-fluid mt-4">
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
      <div className="container-fluid mt-4">
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      </div>
    )
  }

  if (stocks.length === 0) {
    return (
      <div className="container-fluid mt-4">
        <div className="text-center py-5">
          <div className="display-1">📊</div>
          <h2 className="h3 mt-3">No Stocks to Chart</h2>
          <p className="text-muted">Add some stocks to your portfolio first to see their charts here.</p>
          <p className="text-muted">You can add stocks from the "My Stocks" page.</p>
        </div>
      </div>
    )
  }

  if (filteredStocks.length === 0 && selectedTag) {
    return (
      <div className="container-fluid mt-4">
        <div className="text-center py-5">
          <div className="display-1">🏷️</div>
          <h2 className="h3 mt-3">No Stocks Found for Tag "{selectedTag}"</h2>
          <p className="text-muted">No stocks are tagged with "{selectedTag}".</p>
          <button 
            className="btn btn-primary"
            onClick={onClearTagFilter}
          >
            View All Charts
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="container-fluid mt-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2>📊 Stock Charts</h2>
          <p className="text-muted mb-0">
            {selectedTag 
              ? `Charts for stocks tagged with "${selectedTag}"`
              : 'Historical price charts for your tracked stocks'
            }
          </p>
        </div>
        <div className="d-flex align-items-center gap-3">
          {failedCharts.size > 0 && (
            <button
              className="btn btn-warning btn-sm"
              onClick={handleRefreshFailedCharts}
              disabled={refreshingCharts.size > 0}
              title={`Refresh ${failedCharts.size} chart${failedCharts.size !== 1 ? 's' : ''} that failed to load fresh data`}
            >
              {refreshingCharts.size > 0 ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </span>
                  Refreshing...
                </>
              ) : (
                <>
                  🔄 Refresh Failed Charts ({failedCharts.size})
                </>
              )}
            </button>
          )}
          <div className="badge bg-secondary fs-6">
            {filteredStocks.length} chart{filteredStocks.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Tag Filter Banner */}
      {selectedTag && (
        <div className="alert alert-info d-flex justify-content-between align-items-center mb-4">
          <div>
            <strong>🏷️ Filtered by tag: "{selectedTag}"</strong>
            <span className="ms-2">Showing {filteredStocks.length} of {stocks.length} stocks</span>
          </div>
          <button 
            className="btn btn-outline-primary btn-sm"
            onClick={onClearTagFilter}
          >
            Clear Filter
          </button>
        </div>
      )}

      {/* Failed Charts Notice */}
      {failedCharts.size > 0 && (
        <div className="alert alert-warning d-flex justify-content-between align-items-center mb-4">
          <div>
            <strong>⚠️ {failedCharts.size} chart{failedCharts.size !== 1 ? 's' : ''} failed to load fresh data</strong>
            <div className="small mt-1">
              This usually happens due to API rate limits. Use the "Refresh Failed Charts" button to retry loading them with delays.
            </div>
          </div>
          <button 
            className="btn btn-warning btn-sm"
            onClick={handleRefreshFailedCharts}
            disabled={refreshingCharts.size > 0}
          >
            {refreshingCharts.size > 0 ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" role="status">
                  <span className="visually-hidden">Loading...</span>
                </span>
                Refreshing...
              </>
            ) : (
              '🔄 Retry Now'
            )}
          </button>
        </div>
      )}

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
      <div className="d-flex flex-wrap gap-4">
        {filteredStocks.map((stock) => (
          <div key={stock.id} style={{ width: '400px', minWidth: '400px' }}>
            <div className="card h-100 shadow-sm">
              <div className="card-body">
                <EnhancedChart
                  symbol={stock.symbol}
                  duration={selectedDuration}
                  width={350}
                  height={220}
                  className="w-100"
                  onError={handleChartError}
                  onRefreshReady={registerChartRef}
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
                📊 Charts load once on page load with sample data when not authenticated • 
                🔄 Charts do NOT auto-refresh - use "Refresh Failed Charts" button for manual updates • 
                💡 Individual chart refresh buttons (🔄) available for targeted updates
              </small>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChartsPage