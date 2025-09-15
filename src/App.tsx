import { useState } from 'react'
import type { Stock, AddStockForm } from './types/Stock'
import StockList from './components/StockList'
import AddStockModal from './components/AddStockModal'
import './App.css'

function App() {
  const [stocks, setStocks] = useState<Stock[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)

  const addStock = (formData: AddStockForm) => {
    const newStock: Stock = {
      id: Date.now().toString(),
      symbol: formData.symbol.toUpperCase(),
      name: formData.name,
      price: formData.price,
      change: (Math.random() - 0.5) * 10, // Random change for demo
      changePercent: ((Math.random() - 0.5) * 10),
      volume: Math.floor(Math.random() * 1000000),
      marketCap: `$${(Math.random() * 100).toFixed(1)}B`
    }
    
    setStocks(prev => [...prev, newStock])
    setIsModalOpen(false)
  }

  const removeStock = (id: string) => {
    setStocks(prev => prev.filter(stock => stock.id !== id))
  }

  const updateStockPrice = (id: string, newPrice: number) => {
    setStocks(prev => prev.map(stock => 
      stock.id === id 
        ? { 
            ...stock, 
            price: newPrice,
            change: newPrice - stock.price,
            changePercent: ((newPrice - stock.price) / stock.price) * 100
          }
        : stock
    ))
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>📈 Stock Screener</h1>
        <p>Track and monitor your favorite stocks</p>
      </header>

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

        {stocks.length === 0 ? (
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
