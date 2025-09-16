import { useState, useEffect } from 'react'
import type { Stock, AddStockForm } from './types/Stock'
import StockList from './components/StockList'
import AddStockModal from './components/AddStockModal'
import { subscribeToStocks, addStock as addStockToFirebase, deleteStock, updateStock } from './services/stockService'
import './App.css'

function App() {
  const [stocks, setStocks] = useState<Stock[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
      <main className="app-main">
        <div className="actions-bar">
          <button 
            className="add-stock-btn"
            onClick={() => setIsModalOpen(true)}
          >
            + Add Stock
          </button>
          <div className="stock-count">
            {stocks.length} stock{stocks.length !== 1 ? 's' : ''} tracked
          </div>
        </div>

        {error && (
          <div className="error-message" style={{ 
            background: '#fee', 
            color: '#c33', 
            padding: '1rem', 
            borderRadius: '8px', 
            margin: '1rem 0',
            border: '1px solid #fcc'
          }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="loading-state" style={{ 
            textAlign: 'center', 
            padding: '2rem',
            color: '#666'
          }}>
            <div>📊</div>
            <p>Loading your stocks...</p>
          </div>
        ) : stocks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <h2>No stocks added yet</h2>
            <p>Click "Add Stock" to start tracking your investments</p>
          </div>
        ) : (
          <StockList 
            stocks={stocks} 
            onRemoveStock={removeStock}
            onUpdatePrice={updateStockPrice}
          />
        )}
      </main>

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
