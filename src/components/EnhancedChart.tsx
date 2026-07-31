import { useEffect, useRef, useState, useCallback } from 'react'
import {
  createChart,
  AreaSeries,
  CrosshairMode,
  ColorType,
  type IChartApi,
  type ISeriesApi,
} from 'lightweight-charts'
import { getHistoricalData } from '../services/stockService'
import type { HistoricalDataPoint } from '../types/Stock'
import KiteConnectAPI from '../services/kiteConnectAPI'

interface EnhancedChartProps {
  symbol: string
  width?: number
  height?: number
  className?: string
  duration: '1month' | '6months' | '1year' | '3years' | '5years'
  onError?: (symbol: string, hasError: boolean, errorMessage?: string) => void
  onRefreshReady?: (symbol: string, refreshFn: () => void) => void
  liveDataEnabled?: boolean
  exchange?: 'NSE' | 'BSE'
  /** When false the chart queues itself and does not fetch data until flipped to true */
  enabled?: boolean
}

const kiteAPI = KiteConnectAPI.getInstance()

const getChartColors = (changePercent: number) => {
  // Change percent is negative for downfall, so we use absolute value
  const absChange = Math.abs(changePercent)

  if (changePercent >= 0) {
    // Positive change - green
    return {
      lineColor: '#22c55e',
      topColor: 'rgba(34, 197, 94, 0.25)',
      bottomColor: 'rgba(34, 197, 94, 0.02)',
    }
  } else if (absChange <= 25) {
    // 0-25% downfall - light orange
    return {
      lineColor: '#f59e0b',
      topColor: 'rgba(245, 158, 11, 0.25)',
      bottomColor: 'rgba(245, 158, 11, 0.02)',
    }
  } else if (absChange <= 50) {
    // 25-50% downfall - orange
    return {
      lineColor: '#ea580c',
      topColor: 'rgba(234, 88, 12, 0.25)',
      bottomColor: 'rgba(234, 88, 12, 0.02)',
    }
  } else if (absChange <= 75) {
    // 50-75% downfall - red-orange
    return {
      lineColor: '#dc2626',
      topColor: 'rgba(220, 38, 38, 0.25)',
      bottomColor: 'rgba(220, 38, 38, 0.02)',
    }
  } else {
    // 75-100% downfall - deep red
    return {
      lineColor: '#991b1b',
      topColor: 'rgba(153, 27, 27, 0.25)',
      bottomColor: 'rgba(153, 27, 27, 0.02)',
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

interface ChartStats {
  currentPrice: number
  periodHigh: number
  changeFromHighPercent: number
}

interface TooltipState {
  visible: boolean
  x: number
  y: number
  price: string
  date: string
}

// Converts whatever date format the backend gives us into lightweight-charts' 'YYYY-MM-DD'
const toBusinessDay = (dateStr: string): string => {
  const d = new Date(dateStr)
  return d.toISOString().slice(0, 10)
}

function EnhancedChart({
  symbol,
  width = 400,
  height = 250,
  className = "",
  duration,
  onError,
  onRefreshReady,
  liveDataEnabled = false,
  exchange = 'NSE',
  enabled = true
}: EnhancedChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<ChartStats | null>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  const refreshHistoricalData = useCallback(async () => {
    const container = containerRef.current
    if (!container) return

    const fetchHistoricalData = async (): Promise<HistoricalDataPoint[] | null> => {
      try {
        const historicalData = await getHistoricalData(symbol, exchange, duration, liveDataEnabled);

        if (historicalData && historicalData.length > 0) {
          console.log(`✅ CHART DATA LOADED: ${symbol} (${duration}) — ${historicalData.length} points`);
          return historicalData;
        }

        // No data in DB and API not ready — show informative state, do NOT use fake data
        console.warn(`⚠️ NO DATA for ${symbol} (${duration}) — API authentication required`);
        setError('No data — login to KiteConnect to fetch');
        if (onError) onError(symbol, true, 'Failed to load fresh data');
        return null;
      } catch (error) {
        console.error(`❌ CHART ERROR for ${symbol}:`, error);
        setError('Failed to load data');
        if (onError) onError(symbol, true, 'Failed to load fresh data');
        return null;
      }
    }

    const points = await fetchHistoricalData()

    if (!containerRef.current) return

    // null means the fetch failed or returned nothing — error state already set above, skip drawing
    if (points === null) return

    if (points.length === 0) {
      setStats(null)
      return
    }

    // Dedupe by day and sort ascending — lightweight-charts requires strictly ascending unique times
    const byDay = new Map<string, number>()
    points.forEach(p => byDay.set(toBusinessDay(p.date), p.close))
    const seriesData = Array.from(byDay.entries())
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([time, value]) => ({ time, value }))

    const lastPrice = seriesData[seriesData.length - 1].value
    const periodHigh = Math.max(...seriesData.map(d => d.value))
    const changeFromHighPercent = ((lastPrice - periodHigh) / periodHigh) * 100
    const colors = getChartColors(changeFromHighPercent)

    // Recreate the chart fresh on every redraw (symbol/duration/refresh change) —
    // mirrors the previous full-canvas-redraw model and keeps lifecycle simple.
    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
      seriesRef.current = null
    }

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#6b7280',
        attributionLogo: false,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: '#f1f5f9', style: 0 },
      },
      rightPriceScale: { visible: false },
      leftPriceScale: {
        visible: true,
        borderVisible: false,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: { visible: false },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: { color: '#9ca3af', width: 1, style: 3, labelVisible: false },
        horzLine: { visible: false, labelVisible: false },
      },
      handleScroll: false,
      handleScale: false,
    })

    const series = chart.addSeries(AreaSeries, {
      priceScaleId: 'left',
      priceFormat: { type: 'custom', formatter: (p: number) => `₹${p.toFixed(0)}`, minMove: 0.01 },
      lineColor: colors.lineColor,
      topColor: colors.topColor,
      bottomColor: colors.bottomColor,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      crosshairMarkerBorderColor: '#ffffff',
      crosshairMarkerBorderWidth: 2,
    })

    series.setData(seriesData)
    chart.timeScale().applyOptions({ rightOffset: 0 })
    chart.timeScale().fitContent()

    chart.subscribeCrosshairMove(param => {
      if (!param.time || !param.point || !containerRef.current) {
        setTooltip(prev => (prev ? { ...prev, visible: false } : null))
        return
      }
      const value = param.seriesData.get(series)
      if (!value || !('value' in value)) {
        setTooltip(prev => (prev ? { ...prev, visible: false } : null))
        return
      }
      setTooltip({
        visible: true,
        x: param.point.x,
        y: param.point.y,
        price: `₹${(value as { value: number }).value.toFixed(2)}`,
        date: String(param.time),
      })
    })

    chartRef.current = chart
    seriesRef.current = series
    setStats({ currentPrice: lastPrice, periodHigh, changeFromHighPercent })
  }, [symbol, duration, onError, exchange, liveDataEnabled])

  // Register refresh function with parent (separate effect)
  useEffect(() => {
    if (onRefreshReady) {
      onRefreshReady(symbol, refreshHistoricalData)
    }
  }, [symbol, onRefreshReady, refreshHistoricalData])

  useEffect(() => {
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

    // Only draw chart when enabled and when symbol/duration/liveDataEnabled changes
    if (enabled) {
      drawChart()
    }

    return () => {
      isMounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, duration, liveDataEnabled, enabled]) // enabled gates the initial fetch

  // Tear down the chart instance on unmount
  useEffect(() => {
    return () => {
      chartRef.current?.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [])

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

  const currentPrice = stats?.currentPrice.toFixed(2) ?? '0.00'
  const periodHigh = stats?.periodHigh.toFixed(2) ?? '0.00'
  const changeFromHighPercent = stats?.changeFromHighPercent ?? 0
  const changePercentLabel = `${changeFromHighPercent >= 0 ? '+' : ''}${changeFromHighPercent.toFixed(2)}%`

  // Generate TradingView URL
  const getTradingViewUrl = (symbol: string) => {
    const cleanSymbol = symbol.replace('.NS', '').replace('.BO', '')
    const exchange = symbol.includes('.BO') ? 'BSE' : 'NSE'
    return `https://www.tradingview.com/chart/?symbol=${exchange}%3A${cleanSymbol}&utm_source=stock-screener&utm_medium=link&utm_campaign=chart&utm_term=${exchange}%3A${cleanSymbol}`
  }

  return (
    <div className={`${className}`}>
      {/* Queued placeholder — rendered while waiting for batch activation */}
      {!enabled && (
        <div
          style={{ width, height, minHeight: height }}
          className="d-flex flex-column align-items-center justify-content-center text-muted border rounded bg-light"
        >
          <div className="spinner-grow spinner-grow-sm text-secondary mb-2" role="status">
            <span className="visually-hidden">Queued</span>
          </div>
          <small>{symbol}</small>
          <small className="text-secondary" style={{ fontSize: '11px' }}>Queued…</small>
        </div>
      )}
      {/* Normal chart content — visible once enabled */}
      <div style={{ display: enabled ? undefined : 'none' }}>
      <div className="d-flex justify-content-between align-items-center mb-1">
        <div style={{ fontSize: '13px' }}>
          <span className="fw-bold">{symbol}</span>
          <span className="text-muted ms-1">• {DURATION_CONFIG[duration].label}</span>
        </div>
        <div className="d-flex align-items-center gap-1">
          <a
            href={getTradingViewUrl(symbol)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline-secondary btn-sm p-1"
            title="View on TradingView"
            style={{ fontSize: '9px', lineHeight: '1', textDecoration: 'none' }}
          >
            📊
          </a>
          <button
            className="btn btn-outline-secondary btn-sm p-1"
            onClick={handleRefresh}
            disabled={isLoading}
            title="Refresh chart data"
            style={{ fontSize: '9px', lineHeight: '1' }}
          >
            🔄
          </button>
        </div>
      </div>

      {/* Metrics Section */}
      <div className="d-flex justify-content-between align-items-center mb-1" style={{ minHeight: '18px' }}>
        {error ? (
          <span className="text-danger" style={{ fontSize: '11px' }}>⚠️ {error}</span>
        ) : isLoading ? (
          <div className="d-flex align-items-center">
            <div className="spinner-border spinner-border-sm me-1" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <span className="text-muted" style={{ fontSize: '11px' }}>Loading...</span>
          </div>
        ) : (
          <>
            <div className="d-flex align-items-center gap-1" style={{ fontSize: '11px' }}>
              <span className="text-muted">₹{currentPrice}</span>
              <span
                className={`badge ${changeFromHighPercent >= 0 ? 'bg-success' : 'bg-danger'}`}
                style={{ fontSize: '10px', padding: '2px 5px' }}
              >
                {changePercentLabel}
              </span>
            </div>
            <div className="text-muted" style={{ fontSize: '10px' }}>
              High ₹{periodHigh}
            </div>
          </>
        )}
      </div>
      <div className="position-relative">
        <div
          ref={containerRef}
          className="border rounded bg-white w-100"
          style={{ height, minHeight: height }}
        />
        {tooltip?.visible && (
          <div
            className="position-absolute bg-dark text-white px-2 py-1 rounded"
            style={{
              fontSize: '10px',
              pointerEvents: 'none',
              top: Math.max(0, tooltip.y - 34),
              left: Math.min(Math.max(tooltip.x, 30), width - 30),
              transform: 'translateX(-50%)',
              whiteSpace: 'nowrap',
              zIndex: 2,
            }}
          >
            {tooltip.date} · {tooltip.price}
          </div>
        )}
        {/* Only show overlay when user explicitly wants live data but API is unavailable */}
        {!kiteAPI.isReady() && liveDataEnabled && (
          <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-warning bg-opacity-75 rounded">
            <div className="text-center px-2">
              <div className="fw-semibold small">⚠️ KiteConnect login required</div>
              <div className="text-muted" style={{ fontSize: '11px' }}>Authenticate to fetch live data</div>
            </div>
          </div>
        )}
        {/* Show a no-data overlay when API is not ready and no cached data exists */}
        {!kiteAPI.isReady() && !liveDataEnabled && error && (
          <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-light bg-opacity-90 rounded">
            <div className="text-center px-2">
              <div className="text-muted small">📭 No cached data</div>
              <div className="text-muted" style={{ fontSize: '11px' }}>Login to KiteConnect to fetch historical data</div>
            </div>
          </div>
        )}
      </div>
    </div> {/* end display:none wrapper */}
    </div>
  )
}

export default EnhancedChart
