import { useState } from 'react'
import type { AddStockForm } from '../types/Stock'
import { validateIndianStockSymbol, getStockSuggestions } from '../services/indianStockAPI'
import './AddStockModal.css'

interface AddStockModalProps {
  onAddStock: (stock: AddStockForm) => Promise<void> | void
  onClose: () => void
}

const AddStockModal = ({ onAddStock, onClose }: AddStockModalProps) => {
  const [formData, setFormData] = useState<AddStockForm>({
    symbol: '',
    name: '',
    exchange: 'NSE'
  })
  const [errors, setErrors] = useState<Partial<Record<keyof AddStockForm, string>>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [suggestions, setSuggestions] = useState<Array<{symbol: string, name: string, exchange: string}>>([])

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof AddStockForm, string>> = {}
    
    if (!formData.symbol.trim()) {
      newErrors.symbol = 'Stock symbol is required'
    } else if (!validateIndianStockSymbol(formData.symbol)) {
      newErrors.symbol = 'Invalid Indian stock symbol (1-20 alphanumeric characters)'
    }
    
    if (!formData.name.trim()) {
      newErrors.name = 'Company name is required'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (validateForm() && !isSubmitting) {
      setIsSubmitting(true)
      try {
        await onAddStock(formData)
      } catch (error) {
        console.error('Error submitting form:', error)
      } finally {
        setIsSubmitting(false)
      }
    }
  }

  const handleInputChange = (field: keyof AddStockForm, value: string | 'NSE' | 'BSE') => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
    
    // Show suggestions when typing symbol
    if (field === 'symbol' && typeof value === 'string') {
      const newSuggestions = getStockSuggestions(value)
      setSuggestions(newSuggestions)
    }
  }

  const selectSuggestion = (suggestion: {symbol: string, name: string, exchange: string}) => {
    setFormData(prev => ({
      ...prev,
      symbol: suggestion.symbol,
      name: suggestion.name,
      exchange: suggestion.exchange as 'NSE' | 'BSE'
    }))
    setSuggestions([])
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add New Stock</h2>
          <button className="close-btn" onClick={onClose} disabled={isSubmitting}>×</button>
        </div>
        
        <form onSubmit={handleSubmit} className="stock-form">
          <div className="form-group" style={{ position: 'relative' }}>
            <label htmlFor="symbol">Stock Symbol *</label>
            <input
              id="symbol"
              type="text"
              value={formData.symbol}
              onChange={(e) => handleInputChange('symbol', e.target.value.toUpperCase())}
              placeholder="e.g., RELIANCE, TCS, INFY"
              className={errors.symbol ? 'error' : ''}
              maxLength={20}
              disabled={isSubmitting}
            />
            {errors.symbol && <span className="error-message">{errors.symbol}</span>}
            
            {/* Suggestions dropdown */}
            {suggestions.length > 0 && (
              <div className="suggestions-dropdown" style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: 'white',
                border: '1px solid #ddd',
                borderRadius: '4px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                zIndex: 1000,
                maxHeight: '200px',
                overflowY: 'auto'
              }}>
                {suggestions.map((suggestion, index) => (
                  <div
                    key={`${suggestion.symbol}-${index}`}
                    className="suggestion-item"
                    onClick={() => selectSuggestion(suggestion)}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #eee',
                      fontSize: '14px'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                  >
                    <div style={{ fontWeight: 'bold' }}>{suggestion.symbol}</div>
                    <div style={{ color: '#666', fontSize: '12px' }}>
                      {suggestion.name} ({suggestion.exchange})
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="name">Company Name *</label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="e.g., Reliance Industries Limited"
              className={errors.name ? 'error' : ''}
              disabled={isSubmitting}
            />
            {errors.name && <span className="error-message">{errors.name}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="exchange">Exchange *</label>
            <select
              id="exchange"
              value={formData.exchange}
              onChange={(e) => handleInputChange('exchange', e.target.value as 'NSE' | 'BSE')}
              className={errors.exchange ? 'error' : ''}
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            >
              <option value="NSE">NSE (National Stock Exchange)</option>
              <option value="BSE">BSE (Bombay Stock Exchange)</option>
            </select>
            {errors.exchange && <span className="error-message">{errors.exchange}</span>}
          </div>

          <div className="form-actions">
            <button 
              type="button" 
              onClick={onClose} 
              className="cancel-button"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="submit-button"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Adding...' : 'Add Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddStockModal