import { useState } from 'react'
import type { AddStockForm } from '../types/Stock'
import { addStock as addStockToFirebase } from '../services/stockService'

interface BulkStockEntry {
  id: string
  symbol: string
  name: string
  exchange: 'NSE' | 'BSE'
  tags: string[]
  status: 'pending' | 'adding' | 'success' | 'updated' | 'error'
  error?: string
}

interface LookupResult {
  lineNumber: number
  companyName: string
  symbol?: string
  exchange?: 'NSE' | 'BSE'
  status: 'pending' | 'found' | 'not-found' | 'multiple' | 'both-exchanges'
  candidates?: Array<{ symbol: string, exchange: 'NSE' | 'BSE', name: string }>
  nseSymbol?: string
  bseSymbol?: string
}

const BulkStocksPage = () => {
  const [bulkText, setBulkText] = useState('')
  const [bulkTags, setBulkTags] = useState('')
  const [stocks, setStocks] = useState<BulkStockEntry[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedExchange, setSelectedExchange] = useState<'NSE' | 'BSE'>('NSE')
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvProcessing, setCsvProcessing] = useState(false)
  const [lookupResults, setLookupResults] = useState<LookupResult[]>([])
  const [showLookupResults, setShowLookupResults] = useState(false)
  const [csvDelimiter, setCsvDelimiter] = useState(',')
  const [csvColumnNumber, setCsvColumnNumber] = useState(2) // Default to column 2 (company name)
  const [csvMode, setCsvMode] = useState<'lookup' | 'direct'>('lookup') // New mode for CSV processing
  const [csvNameColumn, setCsvNameColumn] = useState(1) // Column containing company names in direct mode
  const [failedSymbols, setFailedSymbols] = useState<Array<{symbol: string, name: string, error: string}>>([])
  const [showFailedSymbols, setShowFailedSymbols] = useState(false)

  // Company name to stock symbol mapping for lookup
  const companySymbolMap = [
    // Popular NSE stocks
    { symbol: 'RELIANCE', exchange: 'NSE' as const, name: 'Reliance Industries', aliases: ['Reliance Industries Ltd', 'Reliance Industries Limited', 'RIL'] },
    { symbol: 'TCS', exchange: 'NSE' as const, name: 'Tata Consultancy Services', aliases: ['Tata Consultancy Services Ltd', 'TCS Limited'] },
    { symbol: 'HDFCBANK', exchange: 'NSE' as const, name: 'HDFC Bank', aliases: ['HDFC Bank Ltd', 'HDFC Bank Limited'] },
    { symbol: 'INFY', exchange: 'NSE' as const, name: 'Infosys', aliases: ['Infosys Ltd', 'Infosys Limited'] },
    { symbol: 'ICICIBANK', exchange: 'NSE' as const, name: 'ICICI Bank', aliases: ['ICICI Bank Ltd', 'ICICI Bank Limited'] },
    { symbol: 'HINDUNILVR', exchange: 'NSE' as const, name: 'Hindustan Unilever', aliases: ['Hindustan Unilever Ltd', 'HUL'] },
    { symbol: 'ITC', exchange: 'NSE' as const, name: 'ITC', aliases: ['ITC Ltd', 'ITC Limited'] },
    { symbol: 'SBIN', exchange: 'NSE' as const, name: 'State Bank of India', aliases: ['SBI', 'State Bank Of India'] },
    { symbol: 'BHARTIARTL', exchange: 'NSE' as const, name: 'Bharti Airtel', aliases: ['Bharti Airtel Ltd', 'Airtel'] },
    { symbol: 'KOTAKBANK', exchange: 'NSE' as const, name: 'Kotak Mahindra Bank', aliases: ['Kotak Bank', 'Kotak Mahindra Bank Ltd'] },
    { symbol: 'LT', exchange: 'NSE' as const, name: 'Larsen & Toubro', aliases: ['L&T', 'Larsen And Toubro Ltd'] },
    { symbol: 'HCLTECH', exchange: 'NSE' as const, name: 'HCL Technologies', aliases: ['HCL Tech', 'HCL Technologies Ltd'] },
    { symbol: 'AXISBANK', exchange: 'NSE' as const, name: 'Axis Bank', aliases: ['Axis Bank Ltd', 'Axis Bank Limited'] },
    { symbol: 'ASIANPAINT', exchange: 'NSE' as const, name: 'Asian Paints', aliases: ['Asian Paints Ltd', 'Asian Paints Limited'] },
    { symbol: 'MARUTI', exchange: 'NSE' as const, name: 'Maruti Suzuki', aliases: ['Maruti Suzuki India Ltd', 'MSIL'] },
    { symbol: 'NESTLEIND', exchange: 'NSE' as const, name: 'Nestle India', aliases: ['Nestle India Ltd', 'Nestle'] },
    { symbol: 'ULTRACEMCO', exchange: 'NSE' as const, name: 'UltraTech Cement', aliases: ['UltraTech Cement Ltd', 'Ultratech'] },
    { symbol: 'TITAN', exchange: 'NSE' as const, name: 'Titan Company', aliases: ['Titan', 'Titan Company Ltd'] },
    { symbol: 'WIPRO', exchange: 'NSE' as const, name: 'Wipro', aliases: ['Wipro Ltd', 'Wipro Limited'] },
    { symbol: 'NTPC', exchange: 'NSE' as const, name: 'NTPC', aliases: ['NTPC Ltd', 'National Thermal Power Corporation'] },
    
    // BSE equivalents
    { symbol: '500325', exchange: 'BSE' as const, name: 'Reliance Industries', aliases: ['Reliance Industries Ltd', 'RIL'] },
    { symbol: '532540', exchange: 'BSE' as const, name: 'Tata Consultancy Services', aliases: ['TCS', 'TCS Ltd'] },
    { symbol: '500180', exchange: 'BSE' as const, name: 'HDFC Bank', aliases: ['HDFC Bank Ltd'] },
    { symbol: '500209', exchange: 'BSE' as const, name: 'Infosys', aliases: ['Infosys Ltd'] },
    { symbol: '532174', exchange: 'BSE' as const, name: 'ICICI Bank', aliases: ['ICICI Bank Ltd'] },
    { symbol: '500696', exchange: 'BSE' as const, name: 'Hindustan Unilever', aliases: ['HUL'] },
    { symbol: '500875', exchange: 'BSE' as const, name: 'ITC', aliases: ['ITC Ltd'] },
    { symbol: '500112', exchange: 'BSE' as const, name: 'State Bank of India', aliases: ['SBI'] },
    { symbol: '532454', exchange: 'BSE' as const, name: 'Bharti Airtel', aliases: ['Airtel'] },
    { symbol: '500247', exchange: 'BSE' as const, name: 'Kotak Mahindra Bank', aliases: ['Kotak Bank'] }
  ]

  // Popular Indian stocks for quick add (NSE symbols)
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
    
    // Parse tags from bulkTags input
    const tags = bulkTags.trim() 
      ? bulkTags.split(',').map(tag => tag.trim()).filter(tag => tag)
      : []

        lines.forEach((line, index) => {
      const parts = line.trim().split(/[,\t]/).map(part => part.trim())
      
      if (parts.length >= 1) {
        let symbol = parts[0].toUpperCase()
        let detectedExchange = selectedExchange // Use selected exchange as default
        
        // Detect exchange from suffix and clean symbol
        if (symbol.endsWith('.NS') || symbol.includes('NSE:')) {
          detectedExchange = 'NSE'
          symbol = symbol.replace(/\.(NS)\.?$/i, '').replace(/^NSE:/i, '')
        } else if (symbol.endsWith('.BO') || symbol.endsWith('.BSE') || symbol.includes('BSE:')) {
          detectedExchange = 'BSE'
          symbol = symbol.replace(/\.(BO|BSE)\.?$/i, '').replace(/^BSE:/i, '')
        }
        
        // Remove any remaining dots
        symbol = symbol.replace(/\.+$/, '')
        
        const name = parts[1] || `${symbol} Company` // Default name if not provided
        
        newStocks.push({
          id: `bulk-${Date.now()}-${index}`,
          symbol,
          name,
          exchange: detectedExchange,
          tags: tags, // Apply the parsed tags to all stocks
          status: 'pending'
        })
      }
    })

    setStocks(newStocks)
  }

  const addPopularStocks = () => {
    // Parse tags from bulkTags input for popular stocks too
    const tags = bulkTags.trim() 
      ? bulkTags.split(',').map(tag => tag.trim()).filter(tag => tag)
      : ['popular', 'blue-chip'] // Default tags for popular stocks
      
    const newStocks: BulkStockEntry[] = popularStocks.map((stock, index) => ({
      id: `popular-${Date.now()}-${index}`,
      symbol: stock.symbol,
      name: stock.name,
      exchange: selectedExchange,
      tags: tags,
      status: 'pending'
    }))

    setStocks(prev => [...prev, ...newStocks])
  }

  const lookupStockSymbol = (companyName: string, preferredExchange?: 'NSE' | 'BSE') => {
    const searchTerm = companyName.toLowerCase().trim()
    const matches = companySymbolMap.filter(stock => {
      const nameMatch = stock.name.toLowerCase().includes(searchTerm) ||
                       searchTerm.includes(stock.name.toLowerCase())
      const aliasMatch = stock.aliases.some(alias => 
        alias.toLowerCase().includes(searchTerm) ||
        searchTerm.includes(alias.toLowerCase())
      )
      return nameMatch || aliasMatch
    })

    if (matches.length === 0) {
      return { status: 'not-found' as const, candidates: [] }
    }

    // Check if we have both NSE and BSE matches for the same company
    const nseMatches = matches.filter(m => m.exchange === 'NSE')
    const bseMatches = matches.filter(m => m.exchange === 'BSE')

    // If we have both NSE and BSE, return both
    if (nseMatches.length > 0 && bseMatches.length > 0) {
      return {
        status: 'both-exchanges' as const,
        candidates: matches,
        nseMatch: nseMatches[0],
        bseMatch: bseMatches[0]
      }
    }

    // If preferred exchange is specified, prioritize it
    if (preferredExchange) {
      const preferredMatch = matches.find(m => m.exchange === preferredExchange)
      if (preferredMatch) {
        return {
          status: 'found' as const,
          symbol: preferredMatch.symbol,
          exchange: preferredMatch.exchange,
          candidates: matches
        }
      }
    }

    // If only one match, return it
    if (matches.length === 1) {
      return {
        status: 'found' as const,
        symbol: matches[0].symbol,
        exchange: matches[0].exchange,
        candidates: matches
      }
    }

    // Multiple matches found
    return {
      status: 'multiple' as const,
      candidates: matches
    }
  }

  const handleCsvFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type === 'text/csv') {
      setCsvFile(file)
    } else {
      setCsvFile(null)
      if (file) {
        alert('Please select a valid CSV file.')
      }
    }
  }

  const processCsvFile = async () => {
    if (!csvFile) return

    setCsvProcessing(true)
    
    try {
      const text = await csvFile.text()
      const lines = text.split('\n').filter(line => line.trim())
      
      // Parse tags from bulkTags input for CSV stocks
      const tags = bulkTags.trim() 
        ? bulkTags.split(',').map(tag => tag.trim()).filter(tag => tag)
        : ['csv-import'] // Default tag for CSV imports

      const lookupResults: LookupResult[] = []
      const newStocks: BulkStockEntry[] = []

      lines.forEach((line, index) => {
        if (index === 0 && (line.toLowerCase().includes('line') || line.toLowerCase().includes('number') || line.toLowerCase().includes('company') || line.toLowerCase().includes('symbol') || line.toLowerCase().includes('name'))) {
          // Skip header row
          return
        }

        // Split by the selected delimiter and clean up quotes
        const parts = line.trim().split(csvDelimiter).map(part => part.trim().replace(/^["']|["']$/g, ''))
        
        if (csvMode === 'direct') {
          // Direct mode: Get symbol and name from specified columns
          const symbolColumnIndex = csvColumnNumber - 1
          const nameColumnIndex = csvNameColumn - 1
          
          if (parts.length > Math.max(symbolColumnIndex, nameColumnIndex)) {
            const symbol = parts[symbolColumnIndex]?.trim()
            const companyName = parts[nameColumnIndex]?.trim()
            
            if (symbol && companyName) {
              // Add directly to stocks list without lookup
              newStocks.push({
                id: `csv-${Date.now()}-${index}`,
                symbol: symbol.toUpperCase(),
                name: companyName,
                exchange: selectedExchange,
                tags: tags,
                status: 'pending'
              })
              
              // Add to lookup results for display
              lookupResults.push({
                lineNumber: index + 1,
                companyName,
                symbol: symbol.toUpperCase(),
                exchange: selectedExchange,
                status: 'found',
                candidates: []
              })
            }
          }
        } else {
          // Lookup mode: Use the specified column number (1-based index, so subtract 1)
          const targetColumnIndex = csvColumnNumber - 1
          
          if (parts.length > targetColumnIndex && parts[targetColumnIndex]) {
            const companyName = parts[targetColumnIndex].trim()
            
            if (companyName) {
              // Try to lookup the stock symbol
              const lookupResult = lookupStockSymbol(companyName, selectedExchange)
              
              const resultEntry: LookupResult = {
                lineNumber: index + 1,
                companyName,
                status: lookupResult.status,
                candidates: lookupResult.candidates
              }

              if (lookupResult.status === 'found') {
                resultEntry.symbol = lookupResult.symbol
                resultEntry.exchange = lookupResult.exchange
                
                // Add to stocks list if found
                newStocks.push({
                  id: `csv-${Date.now()}-${index}`,
                  symbol: lookupResult.symbol!,
                  name: companyName,
                  exchange: lookupResult.exchange!,
                  tags: tags,
                  status: 'pending'
                })
              } else if (lookupResult.status === 'both-exchanges' && 'nseMatch' in lookupResult && 'bseMatch' in lookupResult) {
                // Handle both exchanges found
                resultEntry.nseSymbol = lookupResult.nseMatch.symbol
                resultEntry.bseSymbol = lookupResult.bseMatch.symbol
                
                // Add both NSE and BSE stocks to the list
                newStocks.push({
                  id: `csv-nse-${Date.now()}-${index}`,
                  symbol: lookupResult.nseMatch.symbol,
                  name: companyName,
                  exchange: 'NSE',
                  tags: [...tags, 'nse'],
                  status: 'pending'
                })
                
                newStocks.push({
                  id: `csv-bse-${Date.now()}-${index}`,
                  symbol: lookupResult.bseMatch.symbol,
                  name: companyName,
                  exchange: 'BSE',
                  tags: [...tags, 'bse'],
                  status: 'pending'
                })
              }
              
              lookupResults.push(resultEntry)
            }
          }
        }
      })

      // Set lookup results and show them
      setLookupResults(lookupResults)
      setShowLookupResults(true)
      
      // Add successfully found stocks to the queue
      if (newStocks.length > 0) {
        setStocks(prev => [...prev, ...newStocks])
      }
      
      // Clear the file input
      setCsvFile(null)
      const fileInput = document.getElementById('csvFileInput') as HTMLInputElement
      if (fileInput) fileInput.value = ''

    } catch (error) {
      console.error('Error processing CSV file:', error)
      alert('Error processing CSV file. Please check the file format.')
    } finally {
      setCsvProcessing(false)
    }
  }

  const addLookupResult = (result: LookupResult, symbol: string, exchange: 'NSE' | 'BSE') => {
    // Parse tags from bulkTags input
    const tags = bulkTags.trim() 
      ? bulkTags.split(',').map(tag => tag.trim()).filter(tag => tag)
      : ['csv-import']

    const newStock: BulkStockEntry = {
      id: `lookup-${Date.now()}-${result.lineNumber}`,
      symbol,
      name: result.companyName,
      exchange,
      tags,
      status: 'pending'
    }

    setStocks(prev => [...prev, newStock])
    
    // Update the lookup result status
    setLookupResults(prev => prev.map(r => 
      r.lineNumber === result.lineNumber ? { ...r, status: 'found' as const, symbol, exchange } : r
    ))
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
    setFailedSymbols([]) // Reset failed symbols list
    const tempFailedSymbols: Array<{symbol: string, name: string, error: string}> = []
    
    for (const stock of stocks) {
      if (stock.status === 'success') continue // Skip already successful ones
      
      updateStock(stock.id, { status: 'adding' })
      
      try {
        const stockData: AddStockForm = {
          symbol: stock.symbol,
          name: stock.name,
          exchange: stock.exchange,
          tags: stock.tags
        }
        
        await addStockToFirebase(stockData)
        updateStock(stock.id, { status: 'success' })
        
        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 200))
        
      } catch (error) {
        console.error(`Error adding ${stock.symbol} on ${stock.exchange}:`, error)
        const originalError = error instanceof Error ? error.message : 'Failed to add stock'
        
        // For CSV uploads, try fallback exchange on any failure since symbols might exist on either exchange
        const shouldTryFallback = true // Always try fallback for CSV imports to maximize success rate
        
        console.log(`🔄 Will try fallback for ${stock.symbol}: ${shouldTryFallback}`)
        
        // Try the other exchange if the stock was not found
        if (shouldTryFallback) {
          const alternativeExchange = stock.exchange === 'NSE' ? 'BSE' : 'NSE'
          
          try {
            console.log(`Trying ${stock.symbol} on alternative exchange: ${alternativeExchange}`)
            
            const alternativeStockData: AddStockForm = {
              symbol: stock.symbol,
              name: stock.name,
              exchange: alternativeExchange,
              tags: [...stock.tags, `fallback-${alternativeExchange.toLowerCase()}`]
            }
            
            await addStockToFirebase(alternativeStockData)
            
            // Update the stock with the successful exchange
            updateStock(stock.id, { 
              status: 'success', 
              exchange: alternativeExchange,
              tags: alternativeStockData.tags
            })
            
            console.log(`✅ Successfully added ${stock.symbol} on ${alternativeExchange} (fallback)`)
            
          } catch (alternativeError) {
            console.error(`Error adding ${stock.symbol} on ${alternativeExchange}:`, alternativeError)
            
            // Both exchanges failed
            const errorMessage = `Stock ${stock.symbol} not found on both NSE and BSE. Verify the symbol is correct and currently trading.`
            updateStock(stock.id, { 
              status: 'error', 
              error: errorMessage
            })
            
            // Add to failed symbols list
            tempFailedSymbols.push({
              symbol: stock.symbol,
              name: stock.name,
              error: errorMessage
            })
          }
        } else {
          // Other type of error (not "not found")
          let finalErrorMessage = originalError
          if (stock.exchange === 'BSE' && originalError.includes('404')) {
            finalErrorMessage = `BSE stock ${stock.symbol}: Live data unavailable (KiteConnect limitation). Added as metadata only.`
          }
          
          updateStock(stock.id, { 
            status: 'error', 
            error: finalErrorMessage
          })
          
          // Add to failed symbols list
          tempFailedSymbols.push({
            symbol: stock.symbol,
            name: stock.name,
            error: finalErrorMessage
          })
        }
      }
    }
    
    setIsProcessing(false)
    
    // Show failed symbols if any
    if (tempFailedSymbols.length > 0) {
      setFailedSymbols(tempFailedSymbols)
      setShowFailedSymbols(true)
    }
  }

  const clearAll = () => {
    setStocks([])
    setBulkText('')
    setBulkTags('')
    setFailedSymbols([])
    setShowFailedSymbols(false)
  }

  const getStatusIcon = (status: BulkStockEntry['status']) => {
    switch (status) {
      case 'pending': return '⏳'
      case 'adding': return '🔄'
      case 'success': return '✅'
      case 'updated': return '🔄'
      case 'error': return '❌'
      default: return '⏳'
    }
  }

  const getStatusColor = (status: BulkStockEntry['status']) => {
    switch (status) {
      case 'pending': return 'text-warning'
      case 'adding': return 'text-primary'
      case 'success': return 'text-success'
      case 'updated': return 'text-info'
      case 'error': return 'text-danger'
      default: return 'text-muted'
    }
  }

  const successCount = stocks.filter(s => s.status === 'success' || s.status === 'updated').length
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

      {/* BSE Stock Requirements Warning */}
      <div className="row mb-3">
        <div className="col-12">
          <div className="alert alert-info d-flex align-items-center" role="alert">
            <i className="bi bi-info-circle-fill me-2"></i>
            <div>
              <strong>BSE Stocks:</strong> BSE stocks are supported but require valid instrument tokens or exact trading symbols from KiteConnect. 
              Use the trading symbol exactly as it appears on BSE (e.g., "500325" for Reliance Industries on BSE).
            </div>
          </div>
        </div>
      </div>

      {/* Input Methods */}
      <div className="row g-4 mb-4">
        {/* Manual Input */}
        <div className="col-lg-4">
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
                <label htmlFor="bulkTags" className="form-label">Tags (Optional)</label>
                <input
                  id="bulkTags"
                  type="text"
                  className="form-control"
                  placeholder="Enter tags separated by commas (e.g., tech, banking, blue-chip)"
                  value={bulkTags}
                  onChange={(e) => setBulkTags(e.target.value)}
                />
                <small className="form-text text-muted">
                  Tags help organize and filter your stocks. They will be applied to all stocks in this batch.
                </small>
              </div>
              
              <div className="mb-3">
                <label htmlFor="bulkInput" className="form-label">Stock List</label>
                <textarea
                  id="bulkInput"
                  className="form-control"
                  rows={8}
                  placeholder="Enter stocks (one per line):&#10;RELIANCE, Reliance Industries Ltd&#10;TCS, Tata Consultancy Services&#10;INFY.NS, Infosys (NSE)&#10;HDFCBANK, HDFC Bank&#10;&#10;BSE stocks (use exact symbols):&#10;BSE:500325, Reliance Industries (BSE)&#10;500180.BO, HDFC Bank (BSE)&#10;&#10;Format: SYMBOL, Company Name (optional)&#10;Supports NSE/BSE prefixes and .NS/.BO suffixes&#10;You can also use comma or tab separated values&#10;&#10;💡 Tip: BSE stocks need exact trading symbols from KiteConnect"
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

        {/* CSV Upload */}
        <div className="col-lg-4">
          <div className="card h-100">
            <div className="card-header">
              <h5 className="card-title mb-0">📁 CSV File Upload</h5>
            </div>
            <div className="card-body">
              <p className="text-muted mb-3">Upload a CSV file with stock data - choose to lookup symbols from company names or use symbols directly from your CSV</p>
              
              <div className="mb-3">
                <label htmlFor="csvFileInput" className="form-label">Select CSV File</label>
                <input
                  id="csvFileInput"
                  type="file"
                  className="form-control"
                  accept=".csv"
                  onChange={handleCsvFileChange}
                />
                <small className="form-text text-muted">
                  Upload CSV files with company names or stock symbols
                </small>
              </div>
              
              <div className="mb-3">
                <label className="form-label">CSV Processing Mode</label>
                <div className="d-flex gap-3">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="radio"
                      name="csvMode"
                      id="csvModeLookup"
                      value="lookup"
                      checked={csvMode === 'lookup'}
                      onChange={(e) => setCsvMode(e.target.value as 'lookup' | 'direct')}
                    />
                    <label className="form-check-label" htmlFor="csvModeLookup">
                      🔍 Lookup symbols from company names
                    </label>
                  </div>
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="radio"
                      name="csvMode"
                      id="csvModeDirect"
                      value="direct"
                      checked={csvMode === 'direct'}
                      onChange={(e) => setCsvMode(e.target.value as 'lookup' | 'direct')}
                    />
                    <label className="form-check-label" htmlFor="csvModeDirect">
                      📋 Use symbols directly from CSV
                    </label>
                  </div>
                </div>
              </div>
              
              <div className="row mb-3">
                <div className="col-6">
                  <label htmlFor="csvDelimiter" className="form-label">Delimiter</label>
                  <select 
                    id="csvDelimiter"
                    className="form-select"
                    value={csvDelimiter}
                    onChange={(e) => setCsvDelimiter(e.target.value)}
                  >
                    <option value=",">Comma (,)</option>
                    <option value=";">Semicolon (;)</option>
                    <option value="\t">Tab</option>
                    <option value="|">Pipe (|)</option>
                  </select>
                </div>
                <div className="col-6">
                  <label htmlFor="csvColumn" className="form-label">
                    {csvMode === 'lookup' ? 'Company Name Column' : 'Symbol Column'}
                  </label>
                  <select 
                    id="csvColumn"
                    className="form-select"
                    value={csvColumnNumber}
                    onChange={(e) => setCsvColumnNumber(parseInt(e.target.value))}
                  >
                    <option value={1}>Column 1</option>
                    <option value={2}>Column 2</option>
                    <option value={3}>Column 3</option>
                    <option value={4}>Column 4</option>
                    <option value={5}>Column 5</option>
                  </select>
                </div>
              </div>
              
              {csvMode === 'direct' && (
                <div className="row mb-3">
                  <div className="col-6">
                    <label htmlFor="csvNameColumn" className="form-label">Company Name Column</label>
                    <select 
                      id="csvNameColumn"
                      className="form-select"
                      value={csvNameColumn}
                      onChange={(e) => setCsvNameColumn(parseInt(e.target.value))}
                    >
                      <option value={1}>Column 1</option>
                      <option value={2}>Column 2</option>
                      <option value={3}>Column 3</option>
                      <option value={4}>Column 4</option>
                      <option value={5}>Column 5</option>
                    </select>
                  </div>
                  <div className="col-6">
                    <small className="text-muted">
                      <strong>Direct Mode:</strong><br/>
                      • Symbol Column: Column {csvColumnNumber}<br/>
                      • Name Column: Column {csvNameColumn}<br/>
                      No symbol lookup will be performed
                    </small>
                  </div>
                </div>
              )}
              
              {csvFile && (
                <div className="mb-3">
                  <div className="alert alert-info py-2">
                    <small>
                      <strong>📄 Selected:</strong> {csvFile.name}<br/>
                      <strong>📊 Size:</strong> {(csvFile.size / 1024).toFixed(1)} KB
                    </small>
                  </div>
                </div>
              )}
              
              <div className="mb-3">
                <label className="form-label">Exchange for CSV Stocks</label>
                <select 
                  className="form-select"
                  value={selectedExchange}
                  onChange={(e) => setSelectedExchange(e.target.value as 'NSE' | 'BSE')}
                >
                  <option value="NSE">NSE</option>
                  <option value="BSE">BSE</option>
                </select>
              </div>
              
              <div className="mb-3">
                <label className="form-label">CSV Tags (Optional)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Enter tags separated by commas (e.g., csv-batch, portfolio-2024)"
                  value={bulkTags}
                  onChange={(e) => setBulkTags(e.target.value)}
                />
                <small className="form-text text-muted">
                  These tags will be applied to all stocks from the CSV file
                </small>
              </div>
              
              <button 
                className="btn btn-primary w-100"
                onClick={processCsvFile}
                disabled={!csvFile || csvProcessing}
              >
                {csvProcessing ? (
                  <>
                    <div className="spinner-border spinner-border-sm me-2" role="status">
                      <span className="visually-hidden">Processing...</span>
                    </div>
                    Processing CSV...
                  </>
                ) : (
                  '📁 Process CSV File'
                )}
              </button>
              
              <div className="mt-3">
                <small className="text-muted">
                  <strong>Flexible CSV Format:</strong><br/>
                  • Choose your delimiter: comma, semicolon, tab, or pipe<br/>
                  • Select processing mode: lookup or direct<br/>
                  • Header rows are automatically skipped<br/>
                  <br/>
                  <strong>Examples:</strong><br/>
                  <em>Lookup Mode:</em> Company Name Column → Symbol Lookup<br/>
                  <em>Direct Mode:</em> Elegant Floricul,ELEFLOR (Name, Symbol)<br/>
                  <em>Direct Mode:</em> INTECCAP,Intec Capital (Symbol, Name)
                </small>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Add */}
        <div className="col-lg-4">
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

      {/* Lookup Results */}
      {showLookupResults && lookupResults.length > 0 && (
        <div className="card mb-4">
          <div className="card-header d-flex justify-content-between align-items-center">
            <h5 className="card-title mb-0">🔍 Stock Symbol Lookup Results</h5>
            <button 
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setShowLookupResults(false)}
            >
              ✕ Close
            </button>
          </div>
          <div className="card-body">
            <div className="table-responsive">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Line #</th>
                    <th>Company Name</th>
                    <th>Status</th>
                    <th>Found Symbol</th>
                    <th>Exchange</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {lookupResults.map((result, index) => (
                    <tr key={index} className={
                      result.status === 'found' ? 'table-success' :
                      result.status === 'not-found' ? 'table-warning' :
                      result.status === 'multiple' ? 'table-info' : ''
                    }>
                      <td>{result.lineNumber}</td>
                      <td>{result.companyName}</td>
                      <td>
                        {result.status === 'found' && <span className="badge bg-success">✅ Found</span>}
                        {result.status === 'not-found' && <span className="badge bg-warning">⚠️ Not Found</span>}
                        {result.status === 'multiple' && <span className="badge bg-info">🔢 Multiple Matches</span>}
                        {result.status === 'both-exchanges' && <span className="badge bg-success">✅ Both NSE & BSE</span>}
                      </td>
                      <td>
                        {result.status === 'both-exchanges' ? (
                          <div>
                            <small><strong>NSE:</strong> {result.nseSymbol}</small><br/>
                            <small><strong>BSE:</strong> {result.bseSymbol}</small>
                          </div>
                        ) : (
                          result.symbol || '-'
                        )}
                      </td>
                      <td>
                        {result.status === 'both-exchanges' ? (
                          <div>
                            <span className="badge bg-primary me-1">NSE</span>
                            <span className="badge bg-warning">BSE</span>
                          </div>
                        ) : result.exchange ? (
                          <span className={`badge ${result.exchange === 'NSE' ? 'bg-primary' : 'bg-warning'}`}>
                            {result.exchange}
                          </span>
                        ) : '-'}
                      </td>
                      <td>
                        {result.status === 'multiple' && result.candidates && (
                          <div className="dropdown">
                            <button className="btn btn-sm btn-outline-primary dropdown-toggle" type="button" data-bs-toggle="dropdown">
                              Select Symbol
                            </button>
                            <ul className="dropdown-menu">
                              {result.candidates.map((candidate, cidx) => (
                                <li key={cidx}>
                                  <button 
                                    className="dropdown-item"
                                    onClick={() => addLookupResult(result, candidate.symbol, candidate.exchange)}
                                  >
                                    <strong>{candidate.symbol}</strong> ({candidate.exchange}) - {candidate.name}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {result.status === 'found' && (
                          <small className="text-success">✅ Added to queue</small>
                        )}
                        {result.status === 'both-exchanges' && (
                          <small className="text-success">✅ Both NSE & BSE added to queue</small>
                        )}
                        {result.status === 'not-found' && (
                          <small className="text-muted">Manual entry required</small>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="mt-3">
              <div className="row">
                <div className="col-md-3">
                  <div className="card border-success">
                    <div className="card-body text-center py-2">
                      <span className="text-success">✅ Found: {lookupResults.filter(r => r.status === 'found').length}</span>
                    </div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="card border-success">
                    <div className="card-body text-center py-2">
                      <span className="text-success">✅ Both NSE & BSE: {lookupResults.filter(r => r.status === 'both-exchanges').length}</span>
                    </div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="card border-info">
                    <div className="card-body text-center py-2">
                      <span className="text-info">🔢 Multiple: {lookupResults.filter(r => r.status === 'multiple').length}</span>
                    </div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="card border-warning">
                    <div className="card-body text-center py-2">
                      <span className="text-warning">⚠️ Not Found: {lookupResults.filter(r => r.status === 'not-found').length}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Failed Symbols Summary */}
      {showFailedSymbols && failedSymbols.length > 0 && (
        <div className="card mb-4 border-danger">
          <div className="card-header bg-danger text-white d-flex justify-content-between align-items-center">
            <h5 className="card-title mb-0">❌ Failed Symbols ({failedSymbols.length})</h5>
            <button 
              className="btn btn-sm btn-outline-light"
              onClick={() => setShowFailedSymbols(false)}
            >
              ✕ Close
            </button>
          </div>
          <div className="card-body">
            <p className="text-muted mb-3">
              The following symbols could not be added after trying both NSE and BSE exchanges:
            </p>
            
            <div className="table-responsive">
              <table className="table table-sm table-striped">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Company Name</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {failedSymbols.map((failed, index) => (
                    <tr key={index}>
                      <td>
                        <span className="badge bg-danger">{failed.symbol}</span>
                      </td>
                      <td>{failed.name}</td>
                      <td>
                        <small className="text-muted">{failed.error}</small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="mt-3 d-flex gap-3">
              <div className="flex-grow-1">
                <div className="alert alert-warning mb-0">
                  <strong>💡 Suggestions for failed symbols:</strong>
                  <ul className="mb-0 mt-2">
                    <li>Check if the symbol names are correct and currently trading</li>
                    <li>Some symbols might use different formats (e.g., numerical codes for BSE)</li>
                    <li>Try manually searching for these companies on NSE/BSE websites</li>
                    <li>Consider if these might be delisted or merged companies</li>
                  </ul>
                </div>
              </div>
              <div className="d-flex flex-column gap-2">
                <button 
                  className="btn btn-outline-primary btn-sm"
                  onClick={() => {
                    // Convert failed symbols back to bulk text format for manual editing
                    const failedText = failedSymbols.map(f => `${f.name},${f.symbol}`).join('\n')
                    setBulkText(failedText)
                    setShowFailedSymbols(false)
                  }}
                >
                  📝 Edit Failed Symbols
                </button>
                <button 
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => {
                    const failedList = failedSymbols.map(f => f.symbol).join(', ')
                    navigator.clipboard.writeText(failedList)
                    alert('Failed symbols copied to clipboard!')
                  }}
                >
                  📋 Copy Symbols
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                          <p className="card-text small text-muted mb-1">{stock.name}</p>
                          {stock.tags && stock.tags.length > 0 && (
                            <div className="mb-0">
                              {stock.tags.map((tag, index) => (
                                <span key={index} className="badge bg-light text-dark me-1 mb-1" style={{ fontSize: '0.7em' }}>
                                  🏷️ {tag}
                                </span>
                              ))}
                            </div>
                          )}
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
                          <small className="text-success">
                            ✅ Successfully added!
                            {stock.tags?.some(tag => tag.startsWith('fallback-')) && (
                              <span className="badge bg-info ms-1 text-dark" style={{ fontSize: '0.7em' }}>
                                📋 Fallback Exchange
                              </span>
                            )}
                          </small>
                        </div>
                      )}
                      
                      {stock.status === 'updated' && (
                        <div className="mt-2">
                          <small className="text-info">🔄 Tags updated (stock already exists)</small>
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
                    <li><strong>NSE stocks:</strong> RELIANCE or RELIANCE.NS</li>
                    <li><strong>BSE stocks:</strong> 500325.BO or BSE:500325 (Reliance) <small className="text-muted">Use exact BSE trading symbols</small></li>
                    <li><strong>With name:</strong> RELIANCE, Reliance Industries Ltd</li>
                    <li><strong>Multiple formats:</strong> Tab or comma separated</li>
                    <li>One stock per line</li>
                  </ul>
                  
                  <h6>📁 CSV File Upload (Two Modes):</h6>
                  <ul className="small">
                    <li><strong>Flexible delimiters:</strong> Comma, semicolon, tab, or pipe</li>
                    <li><strong>Header row:</strong> Automatically detected and skipped</li>
                  </ul>
                  
                  <h6>🔍 Lookup Mode:</h6>
                  <ul className="small">
                    <li><strong>Column selection:</strong> Choose which column contains company names</li>
                    <li><strong>Smart lookup:</strong> Automatically finds stock symbols for company names</li>
                    <li><strong>Both exchanges:</strong> Automatically adds both NSE and BSE symbols when available</li>
                    <li><strong>Multiple matches:</strong> Shows dropdown to select correct symbol</li>
                    <li><strong>Examples:</strong> 1,Reliance Industries | Tata Consultancy Services</li>
                  </ul>
                  
                  <h6>📋 Direct Mode:</h6>
                  <ul className="small">
                    <li><strong>Symbol column:</strong> Column containing stock symbols (e.g., ELEFLOR, INTECCAP)</li>
                    <li><strong>Name column:</strong> Column containing company names</li>
                    <li><strong>No lookup:</strong> Uses symbols directly from your CSV file</li>
                    <li><strong>Auto fallback:</strong> If NSE fails, automatically tries BSE (and vice versa)</li>
                    <li><strong>Examples:</strong> Elegant Floricul,ELEFLOR | INTECCAP,Intec Capital</li>
                  </ul>
                  
                  <h6>🏢 Common BSE Stock Symbols:</h6>
                  <ul className="small text-muted">
                    <li>500325 - Reliance Industries</li>
                    <li>500180 - HDFC Bank</li>
                    <li>532540 - TCS</li>
                    <li>500875 - ITC</li>
                    <li>500209 - Infosys</li>
                  </ul>
                  
                  <h6>🏷️ Tag Management:</h6>
                  <ul className="small">
                    <li>Add tags to organize your stocks</li>
                    <li>Separate multiple tags with commas</li>
                    <li>Tags apply to all stocks in the batch</li>
                    <li>Examples: "tech, growth" or "banking, blue-chip"</li>
                  </ul>
                  
                  <h6>🔄 Exchange Detection:</h6>
                  <ul className="small">
                    <li><strong>Auto-detect:</strong> .NS/.BO suffixes detected automatically</li>
                    <li><strong>Prefix format:</strong> NSE: or BSE: prefixes supported</li>
                    <li><strong>Default exchange:</strong> Uses selected exchange if no suffix</li>
                    <li><strong>BSE symbols:</strong> Use exact trading symbols (e.g., 500325 for Reliance, 500180 for HDFC Bank)</li>
                    <li><strong>Full support:</strong> Both NSE and BSE stocks verified through KiteConnect API</li>
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
                  
                  <h6>🔄 Smart Duplicate Handling:</h6>
                  <ul className="small">
                    <li><strong>New stocks:</strong> Added to your portfolio</li>
                    <li><strong>Existing stocks:</strong> Only new tags are added</li>
                    <li><strong>No duplicates:</strong> Same stock won't be added twice</li>
                    <li><strong>Tag merging:</strong> Existing tags are preserved</li>
                  </ul>
                  
                  <h6>🔄 Auto Exchange Fallback:</h6>
                  <ul className="small">
                    <li><strong>Smart retry:</strong> If NSE fails, automatically tries BSE</li>
                    <li><strong>Maximized success:</strong> Works for symbols that exist on either exchange</li>
                    <li><strong>Visual indicator:</strong> Shows "Fallback Exchange" badge when used</li>
                    <li><strong>Automatic tagging:</strong> Adds fallback tag to distinguish the source</li>
                  </ul>
                </div>
              </div>
              <div className="mt-3">
                <h6>🚀 Processing Status Icons:</h6>
                <div className="row">
                  <div className="col-md-6">
                    <ul className="small mb-0">
                      <li>⏳ <strong>Pending:</strong> Waiting to be processed</li>
                      <li>🔄 <strong>Adding:</strong> Currently being processed</li>
                      <li>✅ <strong>Success:</strong> New stock added successfully</li>
                    </ul>
                  </div>
                  <div className="col-md-6">
                    <ul className="small mb-0">
                      <li>🔄 <strong>Updated:</strong> Tags added to existing stock</li>
                      <li>❌ <strong>Error:</strong> Failed to add (check symbol)</li>
                    </ul>
                  </div>
                </div>
                <p className="small mt-2 mb-0">
                  <strong>💡 Tip:</strong> If a stock already exists in your portfolio, only the new tags you specify will be added. 
                  This prevents duplicates while allowing you to organize existing stocks with additional tags.
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