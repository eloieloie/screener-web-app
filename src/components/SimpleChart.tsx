import { useEffect, useRef, useState } from 'react'
import KiteConnectAPI from '../services/kiteConnectAPI'
import './SimpleChart.css'

interface SimpleChartProps {
  symbol: string
  width?: number
  height?: number
  className?: string
}

const kiteAPI = new KiteConnectAPI()

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
      
      if (!isMounted) return // Don't draw if component unmounted
      
      const padding = 20
      const chartWidth = width - padding * 2
      const chartHeight = height - padding * 2
      
      // Set canvas size with device pixel ratio for crisp rendering
      const devicePixelRatio = window.devicePixelRatio || 1
      canvas.width = width * devicePixelRatio
      canvas.height = height * devicePixelRatio
      canvas.style.width = width + 'px'
      canvas.style.height = height + 'px'
      ctx.scale(devicePixelRatio, devicePixelRatio)
      
      // Clear canvas
      ctx.clearRect(0, 0, width, height)
      
      // Find min/max for scaling
      const minPrice = Math.min(...data)
      const maxPrice = Math.max(...data)
      const priceRange = maxPrice - minPrice || 1 // Avoid division by zero
      
      // Draw background
      ctx.fillStyle = '#f8fafc'
      ctx.fillRect(0, 0, width, height)
      
      // Draw grid lines
      ctx.strokeStyle = '#e2e8f0'
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
      ctx.beginPath()
      
      data.forEach((price, index) => {
        const x = padding + (index * chartWidth / (data.length - 1))
        const y = padding + chartHeight - ((price - minPrice) / priceRange * chartHeight)
        
        if (index === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })
      
      ctx.stroke()
      
      // Fill area under the line
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)'
      ctx.fillStyle = 'rgba(59, 130, 246, 0.1)'
      ctx.beginPath()
      
      data.forEach((price, index) => {
        const x = padding + (index * chartWidth / (data.length - 1))
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
      const lastPrice = data[data.length - 1]
      const lastX = width - padding
      const lastY = padding + chartHeight - ((lastPrice - minPrice) / priceRange * chartHeight)
      
      ctx.fillStyle = '#3b82f6'
      ctx.beginPath()
      ctx.arc(lastX, lastY, 4, 0, Math.PI * 2)
      ctx.fill()
      
      // Draw price label with background
      const priceText = `₹${lastPrice.toFixed(2)}`
      ctx.font = '11px system-ui, -apple-system, sans-serif'
      ctx.textAlign = 'right'
      const textMetrics = ctx.measureText(priceText)
      const textWidth = textMetrics.width + 8
      const textHeight = 16
      
      // Label background
      ctx.fillStyle = '#3b82f6'
      ctx.fillRect(lastX - textWidth - 8, lastY - textHeight/2 - 2, textWidth, textHeight)
      
      // Label text
      ctx.fillStyle = 'white'
      ctx.fillText(priceText, lastX - 12, lastY + 3)
      
      // Calculate and display change percentage
      const firstPrice = data[0]
      const changePercent = ((lastPrice - firstPrice) / firstPrice * 100)
      const changeText = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`
      
      // Store change for external display
      canvas.dataset.change = changePercent.toFixed(2)
      canvas.dataset.changePercent = changeText
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
    <div className={`simple-chart ${className}`}>
      <div className="chart-title">
        <span className="symbol-name">{symbol}</span>
        {isLoading ? (
          <span className="chart-loading">Loading...</span>
        ) : (
          <span className={`chart-change ${change >= 0 ? 'positive' : 'negative'}`}>
            {changePercent}
          </span>
        )}
      </div>
      <canvas 
        ref={canvasRef}
        className="chart-canvas"
      />
    </div>
  )
}

export default SimpleChart