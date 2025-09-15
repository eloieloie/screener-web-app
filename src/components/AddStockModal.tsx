import { useState } from 'react'
import type { AddStockForm } from '../types/Stock'
import './AddStockModal.css'

interface AddStockModalProps {
  onAddStock: (stock: AddStockForm) => void
  onClose: () => void
}

const AddStockModal = ({ onAddStock, onClose }: AddStockModalProps) => {
  const [formData, setFormData] = useState<AddStockForm>({
    symbol: '',
    name: '',
    price: 0
  })
  const [errors, setErrors] = useState<Partial<Record<keyof AddStockForm, string>>>({})

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof AddStockForm, string>> = {}
    
    if (!formData.symbol.trim()) {
      newErrors.symbol = 'Stock symbol is required'
    } else if (formData.symbol.length < 1 || formData.symbol.length > 10) {
      newErrors.symbol = 'Symbol must be 1-10 characters'
    }
    
    if (!formData.name.trim()) {
      newErrors.name = 'Company name is required'
    }
    
    if (formData.price <= 0) {
      newErrors.price = 'Price must be greater than 0'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validateForm()) {
      onAddStock(formData)
    }
  }

  const handleInputChange = (field: keyof AddStockForm, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add New Stock</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit} className="stock-form">
          <div className="form-group">
            <label htmlFor="symbol">Stock Symbol *</label>
            <input
              id="symbol"
              type="text"
              value={formData.symbol}
              onChange={(e) => handleInputChange('symbol', e.target.value.toUpperCase())}
              placeholder="e.g., AAPL, GOOGL, TSLA"
              className={errors.symbol ? 'error' : ''}
              maxLength={10}
            />
            {errors.symbol && <span className="error-message">{errors.symbol}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="name">Company Name *</label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="e.g., Apple Inc., Alphabet Inc."
              className={errors.name ? 'error' : ''}
            />
            {errors.name && <span className="error-message">{errors.name}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="price">Current Price ($) *</label>
            <input
              id="price"
              type="number"
              value={formData.price || ''}
              onChange={(e) => handleInputChange('price', parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              step="0.01"
              min="0"
              className={errors.price ? 'error' : ''}
            />
            {errors.price && <span className="error-message">{errors.price}</span>}
          </div>

          <div className="form-actions">
            <button type="button" onClick={onClose} className="cancel-button">
              Cancel
            </button>
            <button type="submit" className="submit-button">
              Add Stock
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddStockModal