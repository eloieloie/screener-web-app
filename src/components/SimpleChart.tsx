import { useEffect, useRef, useState } from 'react'
import KiteConnectAPI from '../services/KiteConnectAPI'

interface SimpleChartProps {
  symbol: string
  width?: number
  height?: number
  className?: string
}

const kiteAPI = KiteConnectAPI.getInstance()

function SimpleChart({ symbol, width = 300, height = 150, className = "" }: SimpleChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let isMounted = true // Track if component is still mounted

    // Generate sample data (fallback) or fetch real data
    const generateSampleData = () => {
      const data = []
      let price = 1000 + Math.random() * 500
      
      for (let i = 0; i < 30; i++) {
        price += (Math.random() - 0.5) * 20
        data.push(price)
      }
      return data
    }

    const fetchHistoricalData = async () => {
      if (!isMounted) return generateSampleData()
      
      setIsLoading(true)
      try {
        // Check authentication before making API calls
        if (!kiteAPI.isReady()) {
          console.warn('Authentication required for historical data, using sample data')
          return generateSampleData()
        }
        
        const toDate = new Date()
        const fromDate = new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
        
        const historicalData = await kiteAPI.getHistoricalData(symbol, fromDate, toDate, 'day')
        
        if (historicalData && historicalData.length > 0) {
          return historicalData.map(point => point.close)
        } else {
          // Fallback to sample data
          return generateSampleData()
        }
      } catch (error) {
        console.warn('Failed to fetch historical data, using sample data:', error)
        return generateSampleData()
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    const drawChart = async () => {
      const data = await fetchHistoricalData()
      
      if (!isMounted || !canvas) return // Don't draw if component unmounted or canvas missing
      
      const padding = 20
      const chartWidth = width - padding * 2
      const chartHeight = height - padding * 2
      
      // Set canvas size with device pixel ratio for crisp rendering
      const devicePixelRatio = window.devicePixelRatio || 1
      canvas.width = width * devicePixelRatio
      canvas.height = height * devicePixelRatio
      canvas.style.width = width + 'px'
      canvas.style.height = height + 'px'
      
      // Reset transform and scale
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.scale(devicePixelRatio, devicePixelRatio)
      
      // Clear canvas with white background
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
      
      if (data.length === 0) {
        // Show "No data" message
        ctx.fillStyle = '#6b7280'
        ctx.font = '14px system-ui, -apple-system, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('No chart data available', width / 2, height / 2)
        return
      }
      
      // Find min/max for scaling
      const minPrice = Math.min(...data)
      const maxPrice = Math.max(...data)
      const priceRange = maxPrice - minPrice || 1 // Avoid division by zero
      
      // Draw grid lines
      ctx.strokeStyle = '#f1f5f9'
      ctx.lineWidth = 1
      
      for (let i = 0; i <= 4; i++) {
        const y = padding + (i * chartHeight / 4)
        ctx.beginPath()
        ctx.moveTo(padding, y)
        ctx.lineTo(width - padding, y)
        ctx.stroke()
      }
      
      // Draw price line
      ctx.strokeStyle = '#3b82f6'
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      
      data.forEach((price, index) => {
        const x = padding + (index * chartWidth / Math.max(data.length - 1, 1))
        const y = padding + chartHeight - ((price - minPrice) / priceRange * chartHeight)
        
        if (index === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })
      
      ctx.stroke()
      
      // Fill area under the line with gradient
      const gradient = ctx.createLinearGradient(0, padding, 0, padding + chartHeight)
      gradient.addColorStop(0, 'rgba(59, 130, 246, 0.2)')
      gradient.addColorStop(1, 'rgba(59, 130, 246, 0.05)')
      
      ctx.fillStyle = gradient
      ctx.beginPath()
      
      data.forEach((price, index) => {
        const x = padding + (index * chartWidth / Math.max(data.length - 1, 1))
        const y = padding + chartHeight - ((price - minPrice) / priceRange * chartHeight)
        
        if (index === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })
      
      // Close the path to the bottom
      const endX = padding + chartWidth
      const bottomY = padding + chartHeight
      ctx.lineTo(endX, bottomY)
      ctx.lineTo(padding, bottomY)
      ctx.closePath()
      ctx.fill()
      
      // Draw current price dot
      if (data.length > 0) {
        const lastPrice = data[data.length - 1]
        const lastX = padding + chartWidth
        const lastY = padding + chartHeight - ((lastPrice - minPrice) / priceRange * chartHeight)
        
        ctx.fillStyle = '#3b82f6'
        ctx.beginPath()
        ctx.arc(lastX, lastY, 4, 0, Math.PI * 2)
        ctx.fill()
        
        // White border around dot
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 2
        ctx.stroke()
        
        // Store change for external display
        const firstPrice = data[0]
        const changePercent = ((lastPrice - firstPrice) / firstPrice * 100)
        canvas.dataset.change = changePercent.toFixed(2)
        canvas.dataset.changePercent = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`
      }
    }

    drawChart()
    
    return () => {
      isMounted = false // Mark component as unmounted
    }
  }, [symbol, width, height])

  // Get change data from canvas
  const canvas = canvasRef.current
  const changePercent = canvas?.dataset.changePercent || '+0.00%'
  const change = parseFloat(canvas?.dataset.change || '0')

  return (
    <div className={`d-flex flex-column ${className}`}>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <span className="fw-bold small text-muted">{symbol} • 30D Chart</span>
        {isLoading ? (
          <div className="d-flex align-items-center">
            <div className="spinner-border spinner-border-sm me-1" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <span className="text-muted small">Loading...</span>
          </div>
        ) : (
          <span className={`badge ${change >= 0 ? 'bg-success' : 'bg-danger'}`}>
            {changePercent}
          </span>
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

export default SimpleChart