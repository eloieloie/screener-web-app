import { useState } from 'react'
import type { Stock } from '../types/Stock'
import { formatVolume } from '../services/indianStockAPI'
import './StockCard.css'

interface StockCardProps {
  stock: Stock
  onRemove: () => void
  onUpdatePrice: (newPrice: number) => void
}

const StockCard = ({ stock, onRemove, onUpdatePrice }: StockCardProps) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editPrice, setEditPrice] = useState(stock.price.toString())

  const handlePriceUpdate = () => {
    const newPrice = parseFloat(editPrice)
    if (!isNaN(newPrice) && newPrice > 0) {
      onUpdatePrice(newPrice)
    }
    setIsEditing(false)
  }

  const formatPrice = (price: number) => `₹${price.toFixed(2)}`
  const formatChange = (change: number) => change >= 0 ? `+₹${change.toFixed(2)}` : `-₹${Math.abs(change).toFixed(2)}`
  const formatChangePercent = (percent: number) => `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`

  return (
    <div className="stock-card">
      <div className="stock-header">
        <div className="stock-info">
          <h3 className="stock-symbol">
            {stock.symbol}
            {stock.exchange && (
              <span className="exchange-badge" style={{
                marginLeft: '8px',
                fontSize: '10px',
                background: stock.exchange === 'NSE' ? '#0066cc' : '#ff6600',
                color: 'white',
                padding: '2px 6px',
                borderRadius: '4px'
              }}>
                {stock.exchange}
              </span>
            )}
          </h3>
          <p className="stock-name">{stock.name}</p>
        </div>
        <button className="remove-btn" onClick={onRemove} title="Remove stock">
          ×
        </button>
      </div>

      <div className="stock-price-section">
        {isEditing ? (
          <div className="price-edit">
            <input
              type="number"
              value={editPrice}
              onChange={(e) => setEditPrice(e.target.value)}
              step="0.01"
              min="0"
              className="price-input"
            />
            <div className="price-actions">
              <button onClick={handlePriceUpdate} className="save-btn">✓</button>
              <button onClick={() => setIsEditing(false)} className="cancel-btn">×</button>
            </div>
          </div>
        ) : (
          <div className="price-display" onClick={() => setIsEditing(true)}>
            <span className="current-price">{formatPrice(stock.price)}</span>
            <span className="edit-hint">Click to refresh</span>
          </div>
        )}
      </div>

      <div className="stock-changes">
        <span className={`change ${stock.change >= 0 ? 'positive' : 'negative'}`}>
          {formatChange(stock.change)}
        </span>
        <span className={`change-percent ${stock.changePercent >= 0 ? 'positive' : 'negative'}`}>
          ({formatChangePercent(stock.changePercent)})
        </span>
      </div>

      {stock.volume && (
        <div className="stock-stats">
          <div className="stat">
            <label>Volume:</label>
            <span>{formatVolume(stock.volume)}</span>
          </div>
          {stock.marketCap && (
            <div className="stat">
              <label>Market Cap:</label>
              <span>{stock.marketCap}</span>
            </div>
          )}
          {stock.dayHigh && stock.dayLow && (
            <div className="stat">
              <label>Day Range:</label>
              <span>₹{stock.dayLow.toFixed(2)} - ₹{stock.dayHigh.toFixed(2)}</span>
            </div>
          )}
          {stock.fiftyTwoWeekHigh && stock.fiftyTwoWeekLow && (
            <div className="stat">
              <label>52W Range:</label>
              <span>₹{stock.fiftyTwoWeekLow.toFixed(2)} - ₹{stock.fiftyTwoWeekHigh.toFixed(2)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default StockCard