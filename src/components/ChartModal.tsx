import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'
import EnhancedChart from './EnhancedChart'
import type { Stock } from '../types/Stock'

export type ChartDuration = '1month' | '3months' | '6months' | '1year' | '3years' | '5years'

interface ChartModalProps {
  stock: Stock
  initialDuration?: ChartDuration
  liveDataEnabled?: boolean
  onClose: () => void
}

const durationOptions: { value: ChartDuration; label: string }[] = [
  { value: '1month', label: '1M' },
  { value: '3months', label: '3M' },
  { value: '6months', label: '6M' },
  { value: '1year', label: '1Y' },
  { value: '3years', label: '3Y' },
  { value: '5years', label: '5Y' }
]

export default function ChartModal({ stock, initialDuration = '6months', liveDataEnabled = false, onClose }: ChartModalProps) {
  const [duration, setDuration] = useState<ChartDuration>(initialDuration)

  // Close on Escape, and lock background scroll while the modal is open.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  const isPositive = (stock.changePercent ?? 0) >= 0

  const modal = (
    <AnimatePresence>
      <motion.div
        className="d-flex align-items-center justify-content-center"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(2px)',
          zIndex: 1050,
          padding: '1.5rem'
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-white shadow-lg"
          style={{
            width: '95vw',
            maxWidth: '1600px',
            height: '90vh',
            borderRadius: '16px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.96 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="d-flex align-items-start justify-content-between px-4 py-3"
            style={{ borderBottom: '1px solid #eef0f3' }}
          >
            <div>
              <div className="d-flex align-items-center gap-2">
                <h5 className="fw-bold mb-0">{stock.symbol}</h5>
                <span className="badge bg-light text-secondary border" style={{ fontWeight: 500 }}>
                  {stock.exchange}
                </span>
              </div>
              {stock.name && <div className="text-muted small mt-1">{stock.name}</div>}
              <div className="d-flex align-items-baseline gap-2 mt-2">
                {typeof stock.price === 'number' && (
                  <span className="fs-4 fw-bold">₹{stock.price.toFixed(2)}</span>
                )}
                {typeof stock.changePercent === 'number' && (
                  <span className={`badge ${isPositive ? 'bg-success' : 'bg-danger'}`}>
                    {isPositive ? '+' : ''}{stock.changePercent.toFixed(2)}%
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              className="btn-close"
              aria-label="Close"
              onClick={onClose}
            />
          </div>

          {/* Duration selector */}
          <div className="px-4 pt-3 pb-2">
            <div className="btn-group" role="group" aria-label="Duration selector">
              {durationOptions.map(option => (
                <button
                  key={option.value}
                  type="button"
                  className={`btn btn-sm px-3 ${duration === option.value ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setDuration(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Chart */}
          <div className="flex-grow-1 px-4 pb-4" style={{ minHeight: 0 }}>
            <div className="h-100 w-100">
              <EnhancedChart
                key={`${stock.symbol}-${duration}`}
                symbol={stock.symbol}
                duration={duration}
                width={1400}
                height={600}
                className="w-100 h-100"
                liveDataEnabled={liveDataEnabled}
                exchange={stock.exchange}
                enabled
              />
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )

  return createPortal(modal, document.body)
}
