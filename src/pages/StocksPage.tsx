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
    if (stocks.length === 0) return
    
    setIsRefreshingAll(true)
    setError(null)
    
    try {
      let hasAuthError = false
      const refreshPromises = stocks.map(async (stock) => {
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

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>📊 My Stocks</h2>
        <div className="d-flex align-items-center gap-3">
          {stocks.length > 0 && (
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
                <>
                  <span className="me-1">🔄</span>
                  Refresh All Prices
                </>
              )}
            </button>
          )}
          <button 
            className="btn btn-success"
            onClick={() => setIsModalOpen(true)}
          >
            <span className="me-1">+</span>
            Add Stock
          </button>
          <div className="badge bg-secondary fs-6">
            {stocks.length} stock{stocks.length !== 1 ? 's' : ''} tracked
          </div>
        </div>
      </div>

      {stocks.length > 0 && getUniqueTags().length > 0 && (
        <div className="card mb-4">
          <div className="card-header bg-light">
            <div className="d-flex justify-content-between align-items-center">
              <h6 className="mb-0 d-flex align-items-center">
                🏷️ <span className="ms-2">Stock Tags</span>
                <small className="text-muted ms-2">({getUniqueTags().length} unique tags)</small>
              </h6>
              <small className="text-muted">
                Total: {stocks.length} stocks • Tagged: {stocks.filter(s => s.tags && s.tags.length > 0).length}
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
                    className="btn btn-outline-primary btn-sm position-relative"
                    onClick={() => onNavigateToChartsWithTag(tag)}
                    style={{
                      borderRadius: '20px',
                      fontWeight: '500',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-1px)'
                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,123,255,0.3)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                    title={`View charts for ${stocksWithTag.length} stock${stocksWithTag.length !== 1 ? 's' : ''} with tag "${tag}"`}
                  >
                    {tag}
                    <span className="badge bg-primary text-white ms-2" style={{ fontSize: '0.65em' }}>
                      {stocksWithTag.length}
                    </span>
                  </button>
                )
              })}
              
              {getUniqueTags().length > 0 && (
                <div className="ms-3 border-start ps-3">
                  <button
                    className="btn btn-success btn-sm"
                    onClick={() => onNavigateToChartsWithTag('')} // Empty tag shows all stocks
                    style={{
                      borderRadius: '20px',
                      fontWeight: '500',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-1px)'
                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(40,167,69,0.3)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                    title="View charts for all stocks"
                  >
                    📈 View All Charts
                    <span className="badge bg-light text-success ms-2" style={{ fontSize: '0.65em' }}>
                      {stocks.length}
                    </span>
                  </button>
                </div>
              )}
            </div>
            <div className="mt-3 pt-2 border-top">
              <div className="row align-items-center">
                <div className="col-md-8">
                  <small className="text-muted">
                    💡 Click any tag to view charts for stocks with that tag
                  </small>
                </div>
                <div className="col-md-4 text-md-end mt-2 mt-md-0">
                  <small className="text-info">
                    🔗 Charts page will open with filtered results
                  </small>
                </div>
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

      {stocks.length > 0 && stocks.every(stock => stock.price === 0) && (
        <div className="alert alert-info" role="alert">
          <strong>💡 Live Data Unavailable</strong><br/>
          Your stocks are saved, but live prices require authentication with Zerodha Kite. 
          Please log in using the authentication section in the main dashboard to see real-time market data.
        </div>
      )}

      {stocks.length > 0 && (
        <div className="alert alert-warning" role="alert">
          <strong>🔄 Refresh Functionality</strong><br/>
          To use the refresh buttons and update stock prices, you need to authenticate with Zerodha KiteConnect. 
          The refresh buttons will work only after successful authentication. 
          <strong>Navigate to the main dashboard to log in.</strong>
        </div>
      )}

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3">Loading your stocks...</p>
        </div>
      ) : stocks.length === 0 ? (
        <div className="text-center py-5">
          <div className="display-1">📈</div>
          <h2 className="h3 mt-3">Start Your Investment Journey</h2>
          <p className="text-muted">Add your first stock to begin tracking your portfolio performance and make informed investment decisions.</p>
        </div>
      ) : (
        <StockTable 
          stocks={stocks} 
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