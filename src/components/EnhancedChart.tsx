import { useEffect, useRef, useState, useCallback } from 'react'
import KiteConnectAPI from '../services/KiteConnectAPI'

interface EnhancedChartProps {
  symbol: string
  width?: number
  height?: number
  className?: string
  duration: '1month' | '6months' | '1year' | '3years' | '5years'
  onError?: (symbol: string, hasError: boolean, errorMessage?: string) => void
  onRefreshReady?: (symbol: string, refreshFn: () => void) => void
}

const kiteAPI = KiteConnectAPI.getInstance()

const getChartColors = (changePercent: number) => {
    // Change percent is negative for downfall, so we use absolute value
    const absChange = Math.abs(changePercent)
    
    if (changePercent >= 0) {
      // Positive change - green
      return {
        lineColor: '#22c55e',
        fillColorStart: 'rgba(34, 197, 94, 0.2)',
        fillColorEnd: 'rgba(34, 197, 94, 0.05)',
        dotColor: '#22c55e'
      }
    } else if (absChange <= 25) {
      // 0-25% downfall - light orange
      return {
        lineColor: '#f59e0b',
        fillColorStart: 'rgba(245, 158, 11, 0.2)',
        fillColorEnd: 'rgba(245, 158, 11, 0.05)',
        dotColor: '#f59e0b'
      }
    } else if (absChange <= 50) {
      // 25-50% downfall - orange
      return {
        lineColor: '#ea580c',
        fillColorStart: 'rgba(234, 88, 12, 0.2)',
        fillColorEnd: 'rgba(234, 88, 12, 0.05)',
        dotColor: '#ea580c'
      }
    } else if (absChange <= 75) {
      // 50-75% downfall - red-orange
      return {
        lineColor: '#dc2626',
        fillColorStart: 'rgba(220, 38, 38, 0.2)',
        fillColorEnd: 'rgba(220, 38, 38, 0.05)',
        dotColor: '#dc2626'
      }
    } else {
      // 75-100% downfall - deep red
      return {
        lineColor: '#991b1b',
        fillColorStart: 'rgba(153, 27, 27, 0.2)',
        fillColorEnd: 'rgba(153, 27, 27, 0.05)',
        dotColor: '#991b1b'
      }
    }
  }

const DURATION_CONFIG = {
  '1month': { days: 30, label: '1M', interval: 'day' },
  '6months': { days: 180, label: '6M', interval: 'day' },
  '1year': { days: 365, label: '1Y', interval: 'day' },
  '3years': { days: 1095, label: '3Y', interval: 'day' },
  '5years': { days: 1825, label: '5Y', interval: 'day' }
} as const

function EnhancedChart({ symbol, width = 400, height = 250, className = "", duration, onError, onRefreshReady }: EnhancedChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshHistoricalData = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const config = DURATION_CONFIG[duration]

    // Generate sample data based on duration
    const generateSampleData = () => {
      const dataPoints = Math.min(config.days, 100) // Limit data points for performance
      const data = []
      let price = 1000 + Math.random() * 500
      
      for (let i = 0; i < dataPoints; i++) {
        // Add some trend and volatility based on duration
        const trendFactor = duration === '5years' ? 0.02 : duration === '3years' ? 0.015 : 0.01
        const volatility = duration === '1month' ? 10 : duration === '6months' ? 15 : 20
        
        price += (Math.random() - 0.48) * volatility + trendFactor // Slight upward trend
        data.push(Math.max(price, 50)) // Prevent negative prices
      }
      return data
    }

    const fetchHistoricalData = async () => {
      try {
        if (!kiteAPI.isReady()) {
          console.warn('Authentication required for historical data, using sample data')
          return generateSampleData()
        }
        
        const toDate = new Date()
        const fromDate = new Date(toDate.getTime() - config.days * 24 * 60 * 60 * 1000)
        
        console.log(`Fetching historical data for ${symbol} (${duration})...`)
        const historicalData = await kiteAPI.getHistoricalData(symbol, fromDate, toDate, 'day')
        
        if (historicalData && historicalData.length > 0) {
          console.log(`Successfully fetched ${historicalData.length} data points for ${symbol}`)
          return historicalData.map(point => point.close)
        } else {
          console.warn(`No historical data available for ${symbol}, using sample data`)
          return generateSampleData()
        }
      } catch (error) {
        console.error(`Failed to fetch historical data for ${symbol}:`, error)
        setError('Failed to load fresh data')
        
        // Notify parent about specific error
        if (onError) {
          onError(symbol, true, 'Failed to load fresh data')
        }
        return generateSampleData()
      }
    }

    const data = await fetchHistoricalData()
    
    if (!canvas) return
    
    const padding = 30
    const chartWidth = width - padding * 2
    const chartHeight = height - padding * 2
    
    // Set canvas size with device pixel ratio for crisp rendering
    const devicePixelRatio = window.devicePixelRatio || 1
    canvas.width = width * devicePixelRatio
    canvas.height = height * devicePixelRatio
    canvas.style.width = width + 'px'
    canvas.style.height = height + 'px'
    
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(devicePixelRatio, devicePixelRatio)
    
    // Clear canvas with white background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    
    if (data.length === 0) {
      ctx.fillStyle = '#6b7280'
      ctx.font = '14px system-ui, -apple-system, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('No chart data available', width / 2, height / 2)
      return
    }
    
    // Find min/max for scaling
    const minPrice = Math.min(...data)
    const maxPrice = Math.max(...data)
    const priceRange = maxPrice - minPrice || 1
    
    // Draw background grid
    ctx.strokeStyle = '#f1f5f9'
    ctx.lineWidth = 1
    
    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
      const y = padding + (i * chartHeight / 5)
      ctx.beginPath()
      ctx.moveTo(padding, y)
      ctx.lineTo(width - padding, y)
      ctx.stroke()
    }
    
    // Vertical grid lines
    for (let i = 0; i <= 4; i++) {
      const x = padding + (i * chartWidth / 4)
      ctx.beginPath()
      ctx.moveTo(x, padding)
      ctx.lineTo(x, height - padding)
      ctx.stroke()
    }
    
    // Draw price labels on Y-axis
    ctx.fillStyle = '#6b7280'
    ctx.font = '11px system-ui, -apple-system, sans-serif'
    ctx.textAlign = 'right'
    
    for (let i = 0; i <= 5; i++) {
      const y = padding + (i * chartHeight / 5)
      const price = maxPrice - (i * priceRange / 5)
      ctx.fillText(`₹${price.toFixed(0)}`, padding - 5, y + 4)
    }
    
    // Draw time labels on X-axis
    ctx.textAlign = 'center'
    const timeLabels = getTimeLabels(duration)
    timeLabels.forEach((label, index) => {
      const x = padding + (index * chartWidth / (timeLabels.length - 1))
      ctx.fillText(label, x, height - 5)
    })
    
    // Calculate performance
    const lastPrice = data[data.length - 1]
    const periodHigh = Math.max(...data)
    const changeFromHighPercent = ((lastPrice - periodHigh) / periodHigh * 100)
    
    // Get colors based on performance
    const colors = getChartColors(changeFromHighPercent)
    
    // Draw price line with dynamic color
    ctx.strokeStyle = colors.lineColor
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    
    data.forEach((price: number, index: number) => {
      const x = padding + (index * chartWidth / Math.max(data.length - 1, 1))
      const y = padding + chartHeight - ((price - minPrice) / priceRange * chartHeight)
      
      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })
    
    ctx.stroke()
    
    // Fill area under the line with dynamic gradient
    const gradient = ctx.createLinearGradient(0, padding, 0, padding + chartHeight)
    gradient.addColorStop(0, colors.fillColorStart)
    gradient.addColorStop(1, colors.fillColorEnd)
    
    ctx.fillStyle = gradient
    ctx.beginPath()
    
    data.forEach((price: number, index: number) => {
      const x = padding + (index * chartWidth / Math.max(data.length - 1, 1))
      const y = padding + chartHeight - ((price - minPrice) / priceRange * chartHeight)
      
      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })
    
    const endX = padding + chartWidth
    const bottomY = padding + chartHeight
    ctx.lineTo(endX, bottomY)
    ctx.lineTo(padding, bottomY)
    ctx.closePath()
    ctx.fill()
    
    // Draw current price dot with dynamic color
    if (data.length > 0) {
      const lastX = padding + chartWidth
      const lastY = padding + chartHeight - ((lastPrice - minPrice) / priceRange * chartHeight)
      
      ctx.fillStyle = colors.dotColor
      ctx.beginPath()
      ctx.arc(lastX, lastY, 4, 0, Math.PI * 2)
      ctx.fill()
      
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.stroke()
      
      canvas.dataset.change = changeFromHighPercent.toFixed(2)
      canvas.dataset.changePercent = `${changeFromHighPercent >= 0 ? '+' : ''}${changeFromHighPercent.toFixed(2)}%`
      canvas.dataset.currentPrice = lastPrice.toFixed(2)
      canvas.dataset.periodHigh = periodHigh.toFixed(2)
      canvas.dataset.changeFromHighPercent = `${changeFromHighPercent.toFixed(2)}%`
    }
  }, [symbol, width, height, duration, onError])

  // Register refresh function with parent (separate effect)
  useEffect(() => {
    if (onRefreshReady) {
      onRefreshReady(symbol, refreshHistoricalData)
    }
  }, [symbol, onRefreshReady, refreshHistoricalData])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let isMounted = true

    const drawChart = async () => {
      setIsLoading(true)
      setError(null)
      
      // Clear any previous error state with parent
      if (onError) {
        onError(symbol, false)
      }
      
      try {
        await refreshHistoricalData()
      } catch (error) {
        console.error('Failed to draw chart:', error)
        const errorMessage = 'Failed to load chart'
        setError(errorMessage)
        
        // Notify parent about error
        if (onError) {
          onError(symbol, true, errorMessage)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    // Only draw chart on initial mount or when symbol/duration changes
    drawChart()
    
    return () => {
      isMounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, duration]) // Only these dependencies to prevent auto-refresh

  const handleRefresh = async () => {
    setIsLoading(true)
    setError(null)

    // Notify parent that error state is cleared
    if (onError) {
      onError(symbol, false)
    }

    try {
      // Force refresh of historical data
      await refreshHistoricalData()
    } catch (error) {
      console.error('Failed to refresh chart data:', error)
      const errorMessage = 'Refresh failed'
      setError(errorMessage)
      
      // Notify parent about error
      if (onError) {
        onError(symbol, true, errorMessage)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const getTimeLabels = (duration: string) => {
    switch (duration) {
      case '1month':
        return ['4w ago', '3w ago', '2w ago', '1w ago', 'Now']
      case '6months':
        return ['6M ago', '4M ago', '2M ago', 'Now']
      case '1year':
        return ['1Y ago', '9M ago', '6M ago', '3M ago', 'Now']
      case '3years':
        return ['3Y ago', '2Y ago', '1Y ago', 'Now']
      case '5years':
        return ['5Y ago', '3Y ago', '1Y ago', 'Now']
      default:
        return ['Start', 'Now']
    }
  }

  const canvas = canvasRef.current
  const changePercent = canvas?.dataset.changePercent || '+0.00%'
  const change = parseFloat(canvas?.dataset.change || '0')
  const currentPrice = canvas?.dataset.currentPrice || '0'
  const periodHigh = canvas?.dataset.periodHigh || '0'

  // Generate TradingView URL
  const getTradingViewUrl = (symbol: string) => {
    const cleanSymbol = symbol.replace('.NS', '').replace('.BO', '')
    const exchange = symbol.includes('.BO') ? 'BSE' : 'NSE'
    return `https://www.tradingview.com/chart/?symbol=${exchange}%3A${cleanSymbol}&utm_source=stock-screener&utm_medium=link&utm_campaign=chart&utm_term=${exchange}%3A${cleanSymbol}`
  }

  return (
    <div className={`${className}`}>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div>
          <span className="fw-bold">{symbol}</span>
          <span className="text-muted ms-2">• {DURATION_CONFIG[duration].label}</span>
        </div>
        <div className="d-flex align-items-center gap-1">
          <a 
            href={getTradingViewUrl(symbol)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline-secondary btn-sm p-1"
            title="View on TradingView"
            style={{ fontSize: '10px', lineHeight: '1', textDecoration: 'none' }}
          >
            📊
          </a>
          <button 
            className="btn btn-outline-secondary btn-sm p-1"
            onClick={handleRefresh}
            disabled={isLoading}
            title="Refresh chart data"
            style={{ fontSize: '10px', lineHeight: '1' }}
          >
            🔄
          </button>
        </div>
      </div>
      
      {/* Metrics Section */}
      <div className="d-flex justify-content-end mb-2">
        {error ? (
          <span className="text-danger small">⚠️ {error}</span>
        ) : isLoading ? (
          <div className="d-flex align-items-center">
            <div className="spinner-border spinner-border-sm me-1" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <span className="text-muted small">Loading...</span>
          </div>
        ) : (
          <div className="text-end">
            <div className="d-flex align-items-center gap-1 justify-content-end">
              <span className="text-muted small">Current:</span>
              <span className="small fw-bold">₹{currentPrice}</span>
              <span className={`badge ${change >= 0 ? 'bg-success' : 'bg-danger'}`}>
                {changePercent}
              </span>
            </div>
            <div className="d-flex align-items-center gap-1 justify-content-end">
              <span className="text-muted small">Period High:</span>
              <span className="small">₹{periodHigh}</span>
            </div>
          </div>
        )}
      </div>
      <div className="position-relative">
        <canvas 
          ref={canvasRef}
          className="border rounded bg-white w-100"
          style={{ 
            width: '100%', 
            height: 'auto',
            maxWidth: `${width}px`,
            aspectRatio: `${width}/${height}`
          }}
        />
        {!kiteAPI.isReady() && (
          <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-light bg-opacity-75 rounded">
            <div className="text-center">
              <div className="text-muted small">📊 Sample Chart Data</div>
              <div className="text-muted small">Login for live historical data</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default EnhancedChart