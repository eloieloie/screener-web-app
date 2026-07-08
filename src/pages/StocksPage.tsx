import { useState, useEffect } from 'react'
import type { Stock, AddStockForm } from '../types/Stock'
import StockTable from '../components/StockTable'
import AddStockModal from '../components/AddStockModal'
import { subscribeToStocks, addStock as addStockToFirebase, deleteStock, refreshStockPrice } from '../services/stockService'

interface StocksPageProps {
  onNavigateToChartsWithTag: (tag: string) => void
}

const StocksPage = ({ onNavigateToChartsWithTag }: StocksPageProps) => {
  const [stocks, setStocks] = useState<Stock[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshingAll, setIsRefreshingAll] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState('')

  // Subscribe to real-time stock updates with error handling
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

    // Cleanup subscription on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [])

  const addStock = async (formData: AddStockForm) => {
    try {
      setError(null)
      await addStockToFirebase(formData)
      setIsModalOpen(false)
    } catch (err) {
      setError('Failed to add stock. Please try again.')
      console.error('Error adding stock:', err)
    }
  }

  const removeStock = async (id: string) => {
    try {
      setError(null)
      await deleteStock(id)
    } catch (err) {
      setError('Failed to remove stock. Please try again.')
      console.error('Error removing stock:', err)
    }
  }

  const refreshAllPrices = async () => {
    if (filteredStocks.length === 0) return

    setIsRefreshingAll(true)
    setError(null)

    try {
      let hasAuthError = false
      const refreshPromises = filteredStocks.map(async (stock) => {
        try {
          await refreshStockPrice(stock.id, stock.symbol, stock.exchange || 'NSE')
          return { success: true, symbol: stock.symbol }
        } catch (error) {
          console.error(`Error refreshing ${stock.symbol}:`, error)
          if (error instanceof Error && error.message.includes('not authenticated')) {
            hasAuthError = true
          }
          return { success: false, symbol: stock.symbol, error }
        }
      })
      
      const results = await Promise.all(refreshPromises)
      const failedStocks = results.filter(r => !r.success)
      
      if (hasAuthError) {
        setError('Please log in to Zerodha KiteConnect to refresh stock prices. You can authenticate using the login section.')
      } else if (failedStocks.length > 0) {
        setError(`Failed to refresh ${failedStocks.length} stock(s). Some symbols may be invalid or not currently trading.`)
      } else {
        console.log('All stock prices refreshed successfully')
      }
    } catch (err) {
      setError('Unexpected error occurred while refreshing prices. Please try again.')
      console.error('Error refreshing all prices:', err)
    } finally {
      setIsRefreshingAll(false)
    }
  }

  // Get all unique tags from stocks
  const getUniqueTags = () => {
    const allTags = stocks.flatMap(stock => stock.tags || [])
    return Array.from(new Set(allTags)).sort()
  }

  // Stocks are only shown when the user has typed a search query OR selected a tag.
  // This prevents an overwhelming full list when thousands of stocks are imported.
  const isFilterActive = searchQuery.trim().length > 0 || selectedTag !== ''
  const filteredStocks = isFilterActive
    ? stocks.filter(stock => {
        const q = searchQuery.trim().toLowerCase()
        const matchesSearch =
          q === '' ||
          stock.symbol.toLowerCase().includes(q) ||
          stock.name.toLowerCase().includes(q)
        const matchesTag =
          selectedTag === '' || (stock.tags ?? []).includes(selectedTag)
        return matchesSearch && matchesTag
      })
    : []

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>📊 My Stocks</h2>
        <div className="d-flex align-items-center gap-3">
          {isFilterActive && filteredStocks.length > 0 && (
            <button
              className="btn btn-outline-primary"
              onClick={refreshAllPrices}
              disabled={isRefreshingAll}
            >
              {isRefreshingAll ? (
                <>
                  <div className="spinner-border spinner-border-sm me-2" role="status">
                    <span className="visually-hidden">Refreshing...</span>
                  </div>
                  Refreshing...
                </>
              ) : (
                <><span className="me-1">🔄</span>Refresh All Prices</>
              )}
            </button>
          )}
          <button
            className="btn btn-success"
            onClick={() => setIsModalOpen(true)}
          >
            <span className="me-1">+</span>Add Stock
          </button>
          <div className="badge bg-secondary fs-6">
            {stocks.length} stock{stocks.length !== 1 ? 's' : ''} tracked
          </div>
        </div>
      </div>

      {/* ── Search + Filter bar ─────────────────────────────────────────── */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="row g-2 align-items-center">
            <div className="col-md-6">
              <div className="input-group">
                <span className="input-group-text bg-white">🔍</span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search by symbol or name…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button className="btn btn-outline-secondary" onClick={() => setSearchQuery('')}>✕</button>
                )}
              </div>
            </div>
            <div className="col-md-4">
              <select
                className="form-select"
                value={selectedTag}
                onChange={e => setSelectedTag(e.target.value)}
              >
                <option value="">— Filter by tag —</option>
                {getUniqueTags().map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            </div>
            <div className="col-md-2 text-muted small">
              {isFilterActive
                ? <>{filteredStocks.length} / {stocks.length} shown</>
                : <>{stocks.length} total</>}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tag cloud (only shown when filter active and tags exist) ────── */}
      {isFilterActive && filteredStocks.length > 0 && getUniqueTags().length > 0 && (
        <div className="card mb-4">
          <div className="card-header bg-light">
            <div className="d-flex justify-content-between align-items-center">
              <h6 className="mb-0">🏷️ <span className="ms-2">Stock Tags</span>
                <small className="text-muted ms-2">({getUniqueTags().length} unique)</small>
              </h6>
              <small className="text-muted">
                Showing: {filteredStocks.length} • Total: {stocks.length}
              </small>
            </div>
          </div>
          <div className="card-body py-3">
            <div className="d-flex flex-wrap gap-2 align-items-center">
              {getUniqueTags().map((tag, index) => {
                const stocksWithTag = stocks.filter(stock => stock.tags?.includes(tag))
                return (
                  <button
                    key={index}
                    className={`btn btn-sm position-relative ${selectedTag === tag ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => { onNavigateToChartsWithTag(tag); }}
                    style={{ borderRadius: '20px', fontWeight: '500', transition: 'all 0.2s ease' }}
                    title={`View charts for ${stocksWithTag.length} stock${stocksWithTag.length !== 1 ? 's' : ''} with tag "${tag}"`}
                  >
                    {tag}
                    <span className="badge bg-primary text-white ms-2" style={{ fontSize: '0.65em' }}>
                      {stocksWithTag.length}
                    </span>
                  </button>
                )
              })}
              <div className="ms-3 border-start ps-3">
                <button
                  className="btn btn-success btn-sm"
                  onClick={() => onNavigateToChartsWithTag('')}
                  style={{ borderRadius: '20px', fontWeight: '500' }}
                >
                  📈 View All Charts
                  <span className="badge bg-light text-success ms-2" style={{ fontSize: '0.65em' }}>
                    {stocks.length}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {isFilterActive && filteredStocks.length > 0 && filteredStocks.every(stock => stock.price === 0) && (
        <div className="alert alert-info" role="alert">
          <strong>💡 Live Data Unavailable</strong><br/>
          Your stocks are saved, but live prices require authentication with Zerodha Kite.
          Please log in using the authentication section in the main dashboard to see real-time market data.
        </div>
      )}

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3">Loading your stocks…</p>
        </div>
      ) : stocks.length === 0 ? (
        <div className="text-center py-5">
          <div className="display-1">📈</div>
          <h2 className="h3 mt-3">Start Your Investment Journey</h2>
          <p className="text-muted">Add your first stock to begin tracking your portfolio performance.</p>
        </div>
      ) : !isFilterActive ? (
        /* ── Default idle state — no filter active ────────────────────── */
        <div className="text-center py-5 text-muted">
          <div className="display-4 mb-3">🔍</div>
          <h5>Search or pick a tag to view stocks</h5>
          <p className="small">
            {stocks.length.toLocaleString()} stock{stocks.length !== 1 ? 's' : ''} tracked.
            Use the search bar or the tag filter above to display them.
          </p>
        </div>
      ) : filteredStocks.length === 0 ? (
        <div className="text-center py-5 text-muted">
          <div className="display-4 mb-3">🤷</div>
          <h5>No stocks match your filter</h5>
          <p className="small">Try a different search term or tag.</p>
          <button className="btn btn-outline-secondary btn-sm mt-2" onClick={() => { setSearchQuery(''); setSelectedTag('') }}>
            Clear filters
          </button>
        </div>
      ) : (
        <StockTable
          stocks={filteredStocks}
          onRemoveStock={removeStock}
          onNavigateToChartsWithTag={onNavigateToChartsWithTag}
          onRefreshStock={async (stockId, symbol, exchange) => {
            try {
              await refreshStockPrice(stockId, symbol, exchange)
            } catch (error) {
              console.error(`Error refreshing ${symbol}:`, error)
              if (error instanceof Error && error.message.includes('not authenticated')) {
                setError('Please log in to Zerodha KiteConnect to refresh stock prices.')
              } else {
                setError(`Failed to refresh ${symbol}. ${error instanceof Error ? error.message : 'Please try again.'}`)
              }
            }
          }}
        />
      )}

      {isModalOpen && (
        <AddStockModal 
          onAddStock={addStock}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  )
}

export default StocksPage