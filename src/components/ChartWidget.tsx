import { useState, useEffect, useRef, useCallback } from 'react'
import './ChartWidget.css'

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

function ChartWidget({ symbol, className = '' }: ChartWidgetProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [chartData, setChartData] = useState<StockData[]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const yahooSymbol = symbol.endsWith('.NS') ? symbol : `${symbol}.NS`
  const yahooUrl = `https://finance.yahoo.com/quote/${yahooSymbol}/`

  // Fetch stock data from a free API
  const fetchStockData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Generate mock data for demonstration (since free APIs have limitations)
      const generateMockData = () => {
        const data: StockData[] = []
        const startPrice = Math.random() * 1000 + 500
        let currentPrice = startPrice
        
        for (let i = 30; i >= 0; i--) {
          const date = new Date()
          date.setDate(date.getDate() - i)
          
          const change = (Math.random() - 0.5) * 20
          const open = currentPrice
          const close = currentPrice + change
          const high = Math.max(open, close) + Math.random() * 10
          const low = Math.min(open, close) - Math.random() * 10
          const volume = Math.floor(Math.random() * 1000000 + 100000)
          
          data.push({
            date: date.toISOString().split('T')[0],
            open: Math.round(open * 100) / 100,
            high: Math.round(high * 100) / 100,
            low: Math.round(low * 100) / 100,
            close: Math.round(close * 100) / 100,
            volume
          })
          
          currentPrice = close
        }
        
        return data
      }

      // For demo purposes, we'll use mock data
      // In production, you'd fetch from a real API like Alpha Vantage, IEX Cloud, etc.
      const mockData = generateMockData()
      setChartData(mockData)
      setLoading(false)
      
    } catch {
      setError('Failed to fetch stock data')
      setLoading(false)
    }
  }

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
  }, [symbol])

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
    <div className={`chart-widget ${className}`}>
      <div className="chart-header">
        <h3>📈 Price Chart - {symbol}</h3>
        <div className="chart-controls">
          <button 
            className="refresh-btn"
            onClick={() => fetchStockData()}
            disabled={loading}
          >
            🔄 Refresh
          </button>
          <a 
            href={yahooUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="external-link"
          >
            Yahoo Finance →
          </a>
        </div>
      </div>
      
      <div className="chart-container">
        {loading && (
          <div className="chart-loading">
            <div className="loading-spinner"></div>
            <p>Loading chart data...</p>
          </div>
        )}
        
        <canvas 
          ref={canvasRef}
          className="chart-canvas"
          style={{ 
            display: loading ? 'none' : 'block',
            width: '100%',
            height: '400px'
          }}
        />
        
        {chartData.length > 0 && !loading && (
          <div className="chart-summary">
            <div className="price-info">
              <span className="current-price">
                ₹{chartData[chartData.length - 1]?.close.toFixed(2)}
              </span>
              <span className={`price-change ${
                chartData.length > 1 && 
                chartData[chartData.length - 1].close > chartData[chartData.length - 2].close 
                  ? 'positive' : 'negative'
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
            <div className="chart-note">
              📊 30-day price movement (Demo data)
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ChartWidget