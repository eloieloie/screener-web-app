import { useState, useEffect } from 'react'
import type { Stock, AddStockForm } from './types/Stock'
import StockList from './components/StockList'
import AddStockModal from './components/AddStockModal'
import Analytics from './components/Analytics'
import { subscribeToStocks, addStock as addStockToFirebase, deleteStock, updateStock } from './services/stockService'
import './App.css'

function App() {
  const [stocks, setStocks] = useState<Stock[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'analytics'>('dashboard')

  // Subscribe to real-time stock updates
  useEffect(() => {
    const unsubscribe = subscribeToStocks((stockList) => {
      setStocks(stockList)
      setLoading(false)
      setError(null)
    })

    // Cleanup subscription on unmount
    return () => unsubscribe()
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

  const updateStockPrice = async (id: string, newPrice: number) => {
    try {
      await updateStock(id, { price: newPrice })
      console.log(`Updated stock ${id} with new price: ${newPrice}`)
    } catch (error) {
      console.error('Failed to update stock price:', error)
    }
  }

  return (
    <div className="app">
      {/* Navigation Menu */}
      <nav className="app-nav">
        <div className="nav-menu">
          <button 
            className={`nav-btn ${currentPage === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentPage('dashboard')}
          >
            <span className="nav-icon">📊</span>
            Dashboard
          </button>
          <button 
            className={`nav-btn ${currentPage === 'analytics' ? 'active' : ''}`}
            onClick={() => setCurrentPage('analytics')}
          >
            <span className="nav-icon">📈</span>
            Analytics
          </button>
        </div>
      </nav>

      {currentPage === 'dashboard' ? (
        <main className="app-main">
        <div className="actions-bar">
          <button 
            className="add-stock-btn"
            onClick={() => setIsModalOpen(true)}
          >
            <span>+</span>
            Add Stock
          </button>
          <div className="stock-count">
            {stocks.length} stock{stocks.length !== 1 ? 's' : ''} tracked
          </div>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {loading ? (
          <div className="loading-state">
            <div>📊</div>
            <p>Loading your stocks...</p>
          </div>
        ) : stocks.length === 0 ? (
          <div className="empty-state animate-fade-in">
            <div className="empty-icon">�</div>
            <h2>Start Your Investment Journey</h2>
            <p>Add your first stock to begin tracking your portfolio performance and make informed investment decisions.</p>
          </div>
        ) : (
          <StockList 
            stocks={stocks} 
            onRemoveStock={removeStock}
            onUpdatePrice={updateStockPrice}
          />
        )}
        </main>
      ) : (
        <Analytics />
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

export default App
