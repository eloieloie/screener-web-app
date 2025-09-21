import { useState } from 'react'
import type { AddStockForm } from '../types/Stock'
import { addStock as addStockToFirebase } from '../services/stockService'

interface BulkStockEntry {
  id: string
  symbol: string
  name: string
  exchange: 'NSE' | 'BSE'
  status: 'pending' | 'adding' | 'success' | 'error'
  error?: string
}

const BulkStocksPage = () => {
  const [bulkText, setBulkText] = useState('')
  const [stocks, setStocks] = useState<BulkStockEntry[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedExchange, setSelectedExchange] = useState<'NSE' | 'BSE'>('NSE')

  // Popular Indian stocks for quick add
  const popularStocks = [
    { symbol: 'RELIANCE', name: 'Reliance Industries Ltd' },
    { symbol: 'TCS', name: 'Tata Consultancy Services Ltd' },
    { symbol: 'INFY', name: 'Infosys Ltd' },
    { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd' },
    { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd' },
    { symbol: 'HINDUNILVR', name: 'Hindustan Unilever Ltd' },
    { symbol: 'ITC', name: 'ITC Ltd' },
    { symbol: 'SBIN', name: 'State Bank of India' },
    { symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd' },
    { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank Ltd' },
    { symbol: 'LT', name: 'Larsen & Toubro Ltd' },
    { symbol: 'ASIANPAINT', name: 'Asian Paints Ltd' },
    { symbol: 'MARUTI', name: 'Maruti Suzuki India Ltd' },
    { symbol: 'TITAN', name: 'Titan Company Ltd' },
    { symbol: 'ULTRACEMCO', name: 'UltraTech Cement Ltd' },
  ]

  const parseBulkInput = () => {
    const lines = bulkText.trim().split('\n').filter(line => line.trim())
    const newStocks: BulkStockEntry[] = []

    lines.forEach((line, index) => {
      const parts = line.trim().split(/[,\t]/).map(part => part.trim())
      
      if (parts.length >= 1) {
        const symbol = parts[0].toUpperCase()
        const name = parts[1] || `${symbol} Company` // Default name if not provided
        
        newStocks.push({
          id: `bulk-${Date.now()}-${index}`,
          symbol,
          name,
          exchange: selectedExchange,
          status: 'pending'
        })
      }
    })

    setStocks(newStocks)
  }

  const addPopularStocks = () => {
    const newStocks: BulkStockEntry[] = popularStocks.map((stock, index) => ({
      id: `popular-${Date.now()}-${index}`,
      symbol: stock.symbol,
      name: stock.name,
      exchange: selectedExchange,
      status: 'pending'
    }))

    setStocks(prev => [...prev, ...newStocks])
  }

  const removeStock = (id: string) => {
    setStocks(prev => prev.filter(stock => stock.id !== id))
  }

  const updateStock = (id: string, updates: Partial<BulkStockEntry>) => {
    setStocks(prev => prev.map(stock => 
      stock.id === id ? { ...stock, ...updates } : stock
    ))
  }

  const processAllStocks = async () => {
    if (stocks.length === 0) return

    setIsProcessing(true)
    
    for (const stock of stocks) {
      if (stock.status === 'success') continue // Skip already successful ones
      
      updateStock(stock.id, { status: 'adding' })
      
      try {
        const stockData: AddStockForm = {
          symbol: stock.symbol,
          name: stock.name,
          exchange: stock.exchange
        }
        
        await addStockToFirebase(stockData)
        updateStock(stock.id, { status: 'success' })
        
        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 200))
        
      } catch (error) {
        console.error(`Error adding ${stock.symbol}:`, error)
        updateStock(stock.id, { 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Failed to add stock'
        })
      }
    }
    
    setIsProcessing(false)
  }

  const clearAll = () => {
    setStocks([])
    setBulkText('')
  }

  const getStatusIcon = (status: BulkStockEntry['status']) => {
    switch (status) {
      case 'pending': return '⏳'
      case 'adding': return '🔄'
      case 'success': return '✅'
      case 'error': return '❌'
      default: return '⏳'
    }
  }

  const getStatusColor = (status: BulkStockEntry['status']) => {
    switch (status) {
      case 'pending': return 'text-warning'
      case 'adding': return 'text-primary'
      case 'success': return 'text-success'
      case 'error': return 'text-danger'
      default: return 'text-muted'
    }
  }

  const successCount = stocks.filter(s => s.status === 'success').length
  const errorCount = stocks.filter(s => s.status === 'error').length
  const pendingCount = stocks.filter(s => s.status === 'pending').length

  return (
    <div className="container mt-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2>📊 Bulk Stock Management</h2>
          <p className="text-muted mb-0">Add multiple stocks to your portfolio at once</p>
        </div>
        <div className="badge bg-secondary fs-6">
          {stocks.length} stock{stocks.length !== 1 ? 's' : ''} queued
        </div>
      </div>

      {/* Input Methods */}
      <div className="row g-4 mb-4">
        {/* Manual Input */}
        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-header">
              <h5 className="card-title mb-0">✍️ Manual Entry</h5>
            </div>
            <div className="card-body">
              <div className="mb-3">
                <label htmlFor="exchange" className="form-label">Default Exchange</label>
                <select 
                  id="exchange"
                  className="form-select"
                  value={selectedExchange}
                  onChange={(e) => setSelectedExchange(e.target.value as 'NSE' | 'BSE')}
                >
                  <option value="NSE">NSE (National Stock Exchange)</option>
                  <option value="BSE">BSE (Bombay Stock Exchange)</option>
                </select>
              </div>
              
              <div className="mb-3">
                <label htmlFor="bulkInput" className="form-label">Stock List</label>
                <textarea
                  id="bulkInput"
                  className="form-control"
                  rows={8}
                  placeholder="Enter stocks (one per line):&#10;RELIANCE, Reliance Industries Ltd&#10;TCS, Tata Consultancy Services&#10;INFY&#10;HDFCBANK, HDFC Bank&#10;&#10;Format: SYMBOL, Company Name (optional)&#10;You can also use comma or tab separated values"
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                />
              </div>
              
              <button 
                className="btn btn-outline-primary w-100"
                onClick={parseBulkInput}
                disabled={!bulkText.trim()}
              >
                📝 Parse & Add to Queue
              </button>
            </div>
          </div>
        </div>

        {/* Quick Add */}
        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-header">
              <h5 className="card-title mb-0">⚡ Quick Add Popular Stocks</h5>
            </div>
            <div className="card-body">
              <p className="text-muted mb-3">Add top 15 Indian stocks to get started quickly</p>
              
              <div className="mb-3">
                <small className="text-muted">Popular stocks include:</small>
                <div className="mt-2">
                  {popularStocks.slice(0, 8).map((stock, index) => (
                    <span key={index} className="badge bg-light text-dark me-1 mb-1">
                      {stock.symbol}
                    </span>
                  ))}
                  <span className="text-muted">...and 7 more</span>
                </div>
              </div>
              
              <div className="mb-3">
                <label className="form-label">Exchange for Popular Stocks</label>
                <select 
                  className="form-select"
                  value={selectedExchange}
                  onChange={(e) => setSelectedExchange(e.target.value as 'NSE' | 'BSE')}
                >
                  <option value="NSE">NSE</option>
                  <option value="BSE">BSE</option>
                </select>
              </div>
              
              <button 
                className="btn btn-success w-100"
                onClick={addPopularStocks}
              >
                ⚡ Add All Popular Stocks
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stock Queue */}
      {stocks.length > 0 && (
        <div className="card mb-4">
          <div className="card-header d-flex justify-content-between align-items-center">
            <h5 className="card-title mb-0">📋 Stock Queue</h5>
            <div className="d-flex gap-2">
              {successCount > 0 && (
                <span className="badge bg-success">{successCount} ✅</span>
              )}
              {errorCount > 0 && (
                <span className="badge bg-danger">{errorCount} ❌</span>
              )}
              {pendingCount > 0 && (
                <span className="badge bg-warning">{pendingCount} ⏳</span>
              )}
            </div>
          </div>
          <div className="card-body">
            {/* Action Buttons */}
            <div className="d-flex gap-2 mb-3">
              <button 
                className="btn btn-primary"
                onClick={processAllStocks}
                disabled={isProcessing || pendingCount === 0}
              >
                {isProcessing ? (
                  <>
                    <div className="spinner-border spinner-border-sm me-2" role="status">
                      <span className="visually-hidden">Processing...</span>
                    </div>
                    Processing...
                  </>
                ) : (
                  `🚀 Add ${pendingCount} Stocks`
                )}
              </button>
              
              <button 
                className="btn btn-outline-secondary"
                onClick={clearAll}
                disabled={isProcessing}
              >
                🗑️ Clear All
              </button>
            </div>

            {/* Stock List */}
            <div className="row g-2">
              {stocks.map((stock) => (
                <div key={stock.id} className="col-md-6 col-lg-4">
                  <div className={`card border-0 shadow-sm h-100 ${
                    stock.status === 'success' ? 'border-success' : 
                    stock.status === 'error' ? 'border-danger' : ''
                  }`}>
                    <div className="card-body p-3">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div>
                          <h6 className="card-title mb-1 d-flex align-items-center">
                            <span className={`me-2 ${getStatusColor(stock.status)}`}>
                              {getStatusIcon(stock.status)}
                            </span>
                            {stock.symbol}
                            <span className={`badge ms-2 ${stock.exchange === 'NSE' ? 'bg-primary' : 'bg-warning'}`}>
                              {stock.exchange}
                            </span>
                          </h6>
                          <p className="card-text small text-muted mb-0">{stock.name}</p>
                        </div>
                        {stock.status !== 'adding' && (
                          <button 
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => removeStock(stock.id)}
                            disabled={isProcessing}
                          >
                            ×
                          </button>
                        )}
                      </div>
                      
                      {stock.status === 'adding' && (
                        <div className="d-flex align-items-center">
                          <div className="spinner-border spinner-border-sm me-2" role="status">
                            <span className="visually-hidden">Adding...</span>
                          </div>
                          <small className="text-primary">Adding to portfolio...</small>
                        </div>
                      )}
                      
                      {stock.status === 'error' && stock.error && (
                        <div className="mt-2">
                          <small className="text-danger">❌ {stock.error}</small>
                        </div>
                      )}
                      
                      {stock.status === 'success' && (
                        <div className="mt-2">
                          <small className="text-success">✅ Successfully added!</small>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="row">
        <div className="col-12">
          <div className="card border-0 bg-light">
            <div className="card-body">
              <h5 className="card-title">💡 How to Use Bulk Stock Management</h5>
              <div className="row">
                <div className="col-md-6">
                  <h6>📝 Manual Entry Format:</h6>
                  <ul className="small">
                    <li><strong>Symbol only:</strong> RELIANCE</li>
                    <li><strong>Symbol with name:</strong> RELIANCE, Reliance Industries Ltd</li>
                    <li><strong>Multiple formats:</strong> Tab or comma separated</li>
                    <li>One stock per line</li>
                  </ul>
                </div>
                <div className="col-md-6">
                  <h6>⚡ Quick Add Features:</h6>
                  <ul className="small">
                    <li>Instantly add top 15 Indian stocks</li>
                    <li>Choose NSE or BSE exchange</li>
                    <li>All popular stocks included</li>
                    <li>Perfect for getting started</li>
                  </ul>
                </div>
              </div>
              <div className="mt-3">
                <h6>🚀 Processing:</h6>
                <p className="small mb-0">
                  Stocks are added one by one with status tracking. You can remove individual stocks before processing 
                  or clear the entire queue. Successfully added stocks will appear in your "My Stocks" page.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BulkStocksPage