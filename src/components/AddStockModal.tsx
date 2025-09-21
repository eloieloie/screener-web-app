import { useState, useEffect } from 'react'
import type { AddStockForm } from '../types/Stock'
import { getAvailableSymbols } from '../services/stockService'

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
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [availableSymbols, setAvailableSymbols] = useState<string[]>([])
  const [isLoadingSymbols, setIsLoadingSymbols] = useState(false)

  // Load available symbols on mount
  useEffect(() => {
    const loadSymbols = async () => {
      setIsLoadingSymbols(true)
      try {
        const instruments = await getAvailableSymbols()
        const symbolStrings = instruments
          .filter(inst => inst.instrument_type === 'EQ')
          .map(inst => inst.tradingsymbol)
          .slice(0, 100) // Limit to first 100 for performance
        setAvailableSymbols(symbolStrings)
      } catch (error) {
        console.error('Failed to load symbols:', error)
      } finally {
        setIsLoadingSymbols(false)
      }
    }
    
    loadSymbols()
  }, [])

  const validateIndianStockSymbol = (symbol: string): boolean => {
    // Basic validation for Indian stock symbols
    const cleanSymbol = symbol.trim().toUpperCase()
    
    // Should be 1-20 characters, alphanumeric
    if (!/^[A-Z0-9]{1,20}$/.test(cleanSymbol)) {
      return false
    }
    
    return true
  }

  const getFilteredSuggestions = (partial: string): string[] => {
    const search = partial.toUpperCase().trim()
    
    if (search.length < 1) return []
    
    return availableSymbols
      .filter(symbol => symbol.includes(search))
      .slice(0, 10) // Limit to 10 suggestions
  }

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
      const newSuggestions = getFilteredSuggestions(value)
      setSuggestions(newSuggestions)
    }
  }

  const selectSuggestion = (symbol: string) => {
    setFormData(prev => ({
      ...prev,
      symbol: symbol,
      name: prev.name || symbol // Keep existing name or use symbol as fallback
    }))
    setSuggestions([])
  }

  return (
    <div className="modal-backdrop show d-flex align-items-center justify-content-center" onClick={onClose}>
      <div className="modal-dialog modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header">
            <h4 className="modal-title">Add New Stock</h4>
            <button 
              type="button" 
              className="btn-close" 
              onClick={onClose} 
              disabled={isSubmitting}
            ></button>
          </div>
          
          <div className="modal-body">
            <form onSubmit={handleSubmit}>
              <div className="mb-3 position-relative">
                <label htmlFor="symbol" className="form-label">Stock Symbol *</label>
                <input
                  id="symbol"
                  type="text"
                  className={`form-control ${errors.symbol ? 'is-invalid' : ''}`}
                  value={formData.symbol}
                  onChange={(e) => handleInputChange('symbol', e.target.value.toUpperCase())}
                  placeholder="e.g., RELIANCE, TCS, INFY"
                  maxLength={20}
                  disabled={isSubmitting}
                />
                {errors.symbol && <div className="invalid-feedback">{errors.symbol}</div>}
                
                {/* Loading indicator */}
                {isLoadingSymbols && (
                  <div className="form-text text-muted">
                    Loading available symbols...
                  </div>
                )}
                
                {/* Suggestions dropdown */}
                {suggestions.length > 0 && (
                  <div className="position-absolute w-100 bg-white border rounded shadow-sm" style={{ zIndex: 1000, top: '100%' }}>
                    {suggestions.map((symbol, index) => (
                      <div
                        key={`${symbol}-${index}`}
                        className="p-2 border-bottom cursor-pointer"
                        onClick={() => selectSuggestion(symbol)}
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={(e) => e.currentTarget.classList.add('bg-light')}
                        onMouseLeave={(e) => e.currentTarget.classList.remove('bg-light')}
                      >
                        <div className="fw-bold">{symbol}</div>
                        <small className="text-muted">NSE Symbol</small>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mb-3">
                <label htmlFor="name" className="form-label">Company Name *</label>
                <input
                  id="name"
                  type="text"
                  className={`form-control ${errors.name ? 'is-invalid' : ''}`}
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="e.g., Reliance Industries Limited"
                  disabled={isSubmitting}
                />
                {errors.name && <div className="invalid-feedback">{errors.name}</div>}
                <div className="form-text">
                  This will be updated automatically when the stock is added
                </div>
              </div>

              <div className="mb-3">
                <label htmlFor="exchange" className="form-label">Exchange *</label>
                <select
                  id="exchange"
                  className={`form-select ${errors.exchange ? 'is-invalid' : ''}`}
                  value={formData.exchange}
                  onChange={(e) => handleInputChange('exchange', e.target.value as 'NSE' | 'BSE')}
                  disabled={isSubmitting}
                >
                  <option value="NSE">NSE (National Stock Exchange)</option>
                  <option value="BSE">BSE (Bombay Stock Exchange) - Limited Support</option>
                </select>
                {errors.exchange && <div className="invalid-feedback">{errors.exchange}</div>}
                {formData.exchange === 'BSE' && (
                  <div className="form-text text-warning">
                    ⚠️ BSE support is limited. Use NSE for better data availability.
                  </div>
                )}
              </div>
            </form>
          </div>

          <div className="modal-footer">
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={onClose} 
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button 
              type="button"
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                  Adding...
                </>
              ) : (
                'Add Stock'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AddStockModal