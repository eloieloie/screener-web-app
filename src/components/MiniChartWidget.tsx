import { useEffect, useRef } from 'react'
import './MiniChartWidget.css'

interface MiniChartWidgetProps {
  symbol: string
  width?: string
  height?: string
  className?: string
}

function MiniChartWidget({ 
  symbol, 
  width = "100%", 
  height = "300px", 
  className = "" 
}: MiniChartWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Clear previous widget
    container.innerHTML = ''

    // Create TradingView mini widget script
    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js'
    script.async = true

    const config = {
      "symbol": `NSE:${symbol}`,
      "width": width,
      "height": height,
      "locale": "en",
      "dateRange": "12M",
      "colorTheme": "light",
      "trendLineColor": "rgba(41, 98, 255, 1)",
      "underLineColor": "rgba(41, 98, 255, 0.3)",
      "underLineBottomColor": "rgba(41, 98, 255, 0)",
      "isTransparent": true,
      "autosize": false,
      "largeChartUrl": `https://www.tradingview.com/chart/?symbol=NSE%3A${symbol}`
    }

    script.innerHTML = JSON.stringify(config)
    
    const widgetContainer = document.createElement('div')
    widgetContainer.className = 'tradingview-widget-container'
    widgetContainer.appendChild(script)
    
    container.appendChild(widgetContainer)

    return () => {
      if (container) {
        container.innerHTML = ''
      }
    }
  }, [symbol, width, height])

  return (
    <div className={`mini-chart-widget ${className}`}>
      <div className="mini-chart-header">
        <span className="chart-symbol">📈 {symbol}</span>
        <a 
          href={`https://www.tradingview.com/chart/?symbol=NSE%3A${symbol}`}
          target="_blank"
          rel="noopener noreferrer"
          className="chart-expand"
          title="Open in TradingView"
        >
          ⛶
        </a>
      </div>
      <div 
        ref={containerRef} 
        className="mini-chart-container"
        style={{ width, height }}
      />
    </div>
  )
}

export default MiniChartWidget