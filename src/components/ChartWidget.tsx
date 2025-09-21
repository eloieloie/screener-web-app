import { useEffect, useState, useRef, useCallback } from 'react'
import KiteConnectAPI from '../services/KiteConnectAPI'

interface ChartWidgetProps {
  symbol: string
  className?: string
}

interface StockData {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

const kiteAPI = KiteConnectAPI.getInstance()

function ChartWidget({ symbol, className = '' }: ChartWidgetProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [chartData, setChartData] = useState<StockData[]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const yahooSymbol = symbol.endsWith('.NS') ? symbol : `${symbol}.NS`
  const yahooUrl = `https://finance.yahoo.com/quote/${yahooSymbol}/`

  // Fetch stock data from KiteConnect API
  const fetchStockData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch historical data from KiteConnect API
      const toDate = new Date()
      const fromDate = new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
      
      const historicalData = await kiteAPI.getHistoricalData(symbol, fromDate, toDate, 'day')
      
      if (historicalData && historicalData.length > 0) {
        // Convert KiteConnect data to our format
        const chartData = historicalData.map(point => ({
          date: point.date,
          open: point.open,
          high: point.high,
          low: point.low,
          close: point.close,
          volume: point.volume
        }))
        setChartData(chartData)
      } else {
        throw new Error('No historical data available')
      }
      
      setLoading(false)
      
    } catch (error) {
      console.error('Failed to fetch historical data:', error)
      setError('Chart data unavailable - Backend server required for live data')
      setChartData([])
      setLoading(false)
    }
  }, [symbol])



  // Create chart using HTML5 Canvas
  const createChart = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || chartData.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * window.devicePixelRatio
    canvas.height = rect.height * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

    const width = rect.width
    const height = rect.height
    const padding = 40

    // Clear canvas
    ctx.clearRect(0, 0, width, height)
    
    // Calculate price range
    const prices = chartData.map(d => [d.high, d.low, d.open, d.close]).flat()
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)
    const priceRange = maxPrice - minPrice

    // Helper functions
    const getX = (index: number) => padding + (index / (chartData.length - 1)) * (width - 2 * padding)
    const getY = (price: number) => padding + (1 - (price - minPrice) / priceRange) * (height - 2 * padding)

    // Draw grid
    ctx.strokeStyle = '#f0f0f0'
    ctx.lineWidth = 1
    
    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
      const y = padding + (i / 5) * (height - 2 * padding)
      ctx.beginPath()
      ctx.moveTo(padding, y)
      ctx.lineTo(width - padding, y)
      ctx.stroke()
      
      // Price labels
      const price = maxPrice - (i / 5) * priceRange
      ctx.fillStyle = '#666'
      ctx.font = '12px Arial'
      ctx.textAlign = 'right'
      ctx.fillText(`₹${price.toFixed(2)}`, padding - 5, y + 4)
    }

    // Vertical grid lines
    for (let i = 0; i < chartData.length; i += Math.ceil(chartData.length / 6)) {
      const x = getX(i)
      ctx.beginPath()
      ctx.moveTo(x, padding)
      ctx.lineTo(x, height - padding)
      ctx.stroke()
      
      // Date labels
      ctx.fillStyle = '#666'
      ctx.font = '12px Arial'
      ctx.textAlign = 'center'
      const date = new Date(chartData[i].date)
      ctx.fillText(
        date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }), 
        x, 
        height - padding + 15
      )
    }

    // Draw candlesticks
    chartData.forEach((data, index) => {
      const x = getX(index)
      const openY = getY(data.open)
      const closeY = getY(data.close)
      const highY = getY(data.high)
      const lowY = getY(data.low)
      
      const isGreen = data.close > data.open
      const candleWidth = Math.max(2, (width - 2 * padding) / chartData.length * 0.6)
      
      // Draw wick
      ctx.strokeStyle = isGreen ? '#10b981' : '#ef4444'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, highY)
      ctx.lineTo(x, lowY)
      ctx.stroke()
      
      // Draw body
      ctx.fillStyle = isGreen ? '#10b981' : '#ef4444'
      const bodyTop = Math.min(openY, closeY)
      const bodyHeight = Math.abs(openY - closeY) || 1
      ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight)
    })

    // Draw price line (close prices)
    ctx.strokeStyle = '#2563eb'
    ctx.lineWidth = 2
    ctx.beginPath()
    chartData.forEach((data, index) => {
      const x = getX(index)
      const y = getY(data.close)
      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })
    ctx.stroke()

    // Current price indicator
    if (chartData.length > 0) {
      const lastData = chartData[chartData.length - 1]
      const lastX = getX(chartData.length - 1)
      const lastY = getY(lastData.close)
      
      ctx.fillStyle = '#2563eb'
      ctx.beginPath()
      ctx.arc(lastX, lastY, 4, 0, 2 * Math.PI)
      ctx.fill()
      
      // Price label
      ctx.fillStyle = '#fff'
      ctx.fillRect(lastX + 10, lastY - 10, 60, 20)
      ctx.strokeStyle = '#2563eb'
      ctx.strokeRect(lastX + 10, lastY - 10, 60, 20)
      ctx.fillStyle = '#2563eb'
      ctx.font = 'bold 12px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(`₹${lastData.close.toFixed(2)}`, lastX + 40, lastY + 3)
    }
  }, [chartData])

  useEffect(() => {
    fetchStockData()
  }, [symbol, fetchStockData]) // Include all dependencies

  useEffect(() => {
    if (chartData.length > 0) {
      createChart()
    }
  }, [chartData, createChart])

  useEffect(() => {
    const handleResize = () => {
      if (chartData.length > 0) {
        setTimeout(createChart, 100)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [chartData, createChart])

  if (error) {
    return (
      <div className={`chart-widget error ${className}`}>
        <div className="chart-error">
          <div className="error-icon">📊</div>
          <h3>Chart Unavailable</h3>
          <p>{error}</p>
          <a 
            href={yahooUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="external-link"
          >
            View on Yahoo Finance →
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className={`${className}`}>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">📈 Price Chart - {symbol}</h5>
        <div className="d-flex gap-2">
          <button 
            className="btn btn-outline-primary btn-sm"
            onClick={() => fetchStockData()}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-1"></span>
                Loading...
              </>
            ) : (
              <>🔄 Refresh</>
            )}
          </button>
          <a 
            href={yahooUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="btn btn-outline-secondary btn-sm"
          >
            Yahoo Finance →
          </a>
        </div>
      </div>
      
      <div className="position-relative">
        {loading && (
          <div className="position-absolute top-50 start-50 translate-middle text-center">
            <div className="spinner-border text-primary mb-2"></div>
            <p className="text-muted">Loading chart data...</p>
          </div>
        )}
        
        <canvas 
          ref={canvasRef}
          className="w-100 border rounded"
          style={{ 
            display: loading ? 'none' : 'block',
            height: '400px'
          }}
        />
        
        {chartData.length > 0 && !loading && (
          <div className="mt-3 p-3 bg-light rounded">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <span className="h5 me-3">
                  ₹{chartData[chartData.length - 1]?.close.toFixed(2)}
                </span>
                <span className={`badge ${
                  chartData.length > 1 && 
                  chartData[chartData.length - 1].close > chartData[chartData.length - 2].close 
                    ? 'bg-success' : 'bg-danger'
                }`}>
                  {chartData.length > 1 && (
                    <>
                      {chartData[chartData.length - 1].close > chartData[chartData.length - 2].close ? '+' : ''}
                      {(chartData[chartData.length - 1].close - chartData[chartData.length - 2].close).toFixed(2)}
                      ({(((chartData[chartData.length - 1].close - chartData[chartData.length - 2].close) / chartData[chartData.length - 2].close) * 100).toFixed(2)}%)
                    </>
                  )}
                </span>
              </div>
              <small className="text-muted">
                📊 30-day price movement (Requires backend for live data)
              </small>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ChartWidget