import { useState, useEffect, useMemo, useRef } from 'react'
import type { Stock } from '../types/Stock'
import EnhancedChart from '../components/EnhancedChart'
import { subscribeToStocks } from '../services/stockService'

const BATCH_SIZE = 10
const BATCH_DELAY_MS = 5000

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
  const [liveDataEnabled, setLiveDataEnabled] = useState(false)
  const chartRefs = useRef<Map<string, { hasError: boolean, refresh: () => void }>>(new Map())

  // Batch activation: track which stock IDs are allowed to load
  const [enabledStocks, setEnabledStocks] = useState<Set<string>>(new Set())
  const [batchInfo, setBatchInfo] = useState<{ current: number; total: number } | null>(null)
  const batchTimers = useRef<ReturnType<typeof setTimeout>[]>([])

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

  // Stable key for the current set of filtered stocks (avoids re-firing on price-only updates)
  const filteredStockKey = useMemo(
    () => filteredStocks.map(s => s.id).join(','),
    [filteredStocks]
  )

  // Batch-activate charts: enable BATCH_SIZE charts every BATCH_DELAY_MS ms
  useEffect(() => {
    // Clear any pending batch timers from a previous run
    batchTimers.current.forEach(clearTimeout)
    batchTimers.current = []

    if (filteredStocks.length === 0) {
      setEnabledStocks(new Set())
      setBatchInfo(null)
      return
    }

    const totalBatches = Math.ceil(filteredStocks.length / BATCH_SIZE)
    setBatchInfo({ current: 0, total: totalBatches })
    setEnabledStocks(new Set()) // reset on list change

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * BATCH_SIZE
      const end = Math.min(start + BATCH_SIZE, filteredStocks.length)
      const batchIds = filteredStocks.slice(start, end).map(s => s.id)
      const delay = batchIndex * BATCH_DELAY_MS

      const timer = setTimeout(() => {
        setEnabledStocks(prev => {
          const next = new Set(prev)
          batchIds.forEach(id => next.add(id))
          return next
        })
        setBatchInfo({ current: batchIndex + 1, total: totalBatches })
      }, delay)

      batchTimers.current.push(timer)
    }

    return () => {
      batchTimers.current.forEach(clearTimeout)
      batchTimers.current = []
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredStockKey])

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
          {/* Live Data Toggle */}
          <div className="form-check form-switch">
            <input 
              className="form-check-input" 
              type="checkbox" 
              id="liveDataToggle"
              checked={liveDataEnabled}
              onChange={(e) => {
                const newValue = e.target.checked;
                console.log(`🔄 LIVE DATA TOGGLE CHANGED:`, {
                  from: liveDataEnabled,
                  to: newValue,
                  stocksToRefresh: filteredStocks.length
                });
                setLiveDataEnabled(newValue);
              }}
            />
            <label className="form-check-label" htmlFor="liveDataToggle">
              {liveDataEnabled ? '📡 Live Data' : '💾 Cached Data'}
            </label>
          </div>
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

      {/* Batch loading progress */}
      {batchInfo && batchInfo.current < batchInfo.total && (
        <div className="alert alert-info d-flex align-items-center gap-3 mb-4 py-2">
          <div className="spinner-border spinner-border-sm text-info flex-shrink-0" role="status">
            <span className="visually-hidden">Loading…</span>
          </div>
          <div className="flex-grow-1">
            <strong>Loading charts in batches</strong>
            <span className="ms-2 text-muted">
              Batch {batchInfo.current + 1} of {batchInfo.total} — 
              {' '}{enabledStocks.size} of {filteredStocks.length} charts active, 
              {' '}{filteredStocks.length - enabledStocks.size} queued
              {batchInfo.current < batchInfo.total - 1 && ` (next batch in ${BATCH_DELAY_MS / 1000}s)`}
            </span>
          </div>
          <div className="progress flex-shrink-0" style={{ width: '120px', height: '6px' }}>
            <div
              className="progress-bar"
              role="progressbar"
              style={{ width: `${(enabledStocks.size / filteredStocks.length) * 100}%` }}
            />
          </div>
        </div>
      )}

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
                  liveDataEnabled={liveDataEnabled}
                  exchange={stock.exchange}
                  enabled={enabledStocks.has(stock.id)}
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
                📊 Charts use {liveDataEnabled ? 'live API data' : 'cached Firebase data (updated daily)'} • 
                🔄 Toggle "Live Data" to fetch fresh data from KiteConnect API • 
                💾 Cached data persists for 24 hours to improve performance and reduce API calls •
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