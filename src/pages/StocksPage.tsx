import { useState, useEffect } from 'react'
import type { Stock, AddStockForm } from '../types/Stock'
import StockList from '../components/StockList'
import AddStockModal from '../components/AddStockModal'
import { subscribeToStocks, addStock as addStockToFirebase, deleteStock } from '../services/stockService'

const StocksPage = () => {
  const [stocks, setStocks] = useState<Stock[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>📊 My Stocks</h2>
        <div className="d-flex align-items-center gap-3">
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
        <StockList 
          stocks={stocks} 
          onRemoveStock={removeStock}
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