import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'

export interface SimpleCaptchaHandle {
  /** Validates the given user input against the current captcha code. */
  verify: (input: string) => boolean
  /** Generates a new captcha code and redraws the canvas. */
  refresh: () => void
}

interface SimpleCaptchaProps {
  className?: string
}

function randomCode(length = 6): string {
  // Avoid visually ambiguous characters (0/O, 1/I/l)
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

/**
 * A lightweight, self-contained captcha widget that draws a distorted code
 * onto a canvas. Doesn't require any external service, API key, or network
 * call, so it works fully offline / in personal projects.
 */
const SimpleCaptcha = forwardRef<SimpleCaptchaHandle, SimpleCaptchaProps>(function SimpleCaptcha(
  { className },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const codeRef = useRef<string>('')

  const draw = useCallback((code: string) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height } = canvas
    ctx.clearRect(0, 0, width, height)

    // Background
    ctx.fillStyle = '#f1f3f5'
    ctx.fillRect(0, 0, width, height)

    // Noise lines
    for (let i = 0; i < 6; i++) {
      ctx.strokeStyle = `rgba(${Math.random() * 180},${Math.random() * 180},${Math.random() * 180},0.5)`
      ctx.beginPath()
      ctx.moveTo(Math.random() * width, Math.random() * height)
      ctx.lineTo(Math.random() * width, Math.random() * height)
      ctx.stroke()
    }

    // Noise dots
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(${Math.random() * 150},${Math.random() * 150},${Math.random() * 150},0.6)`
      ctx.beginPath()
      ctx.arc(Math.random() * width, Math.random() * height, 1.2, 0, Math.PI * 2)
      ctx.fill()
    }

    // Characters, each with random rotation/offset
    const charWidth = width / code.length
    for (let i = 0; i < code.length; i++) {
      const x = charWidth * i + charWidth / 2
      const y = height / 2 + (Math.random() * 8 - 4)
      const angle = (Math.random() * 30 - 15) * (Math.PI / 180)
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(angle)
      ctx.font = `bold ${Math.floor(height * 0.55)}px monospace`
      ctx.fillStyle = `rgb(${20 + Math.random() * 60},${20 + Math.random() * 60},${80 + Math.random() * 80})`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(code[i], 0, 0)
      ctx.restore()
    }
  }, [])

  const refresh = useCallback(() => {
    const code = randomCode()
    codeRef.current = code
    draw(code)
  }, [draw])

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useImperativeHandle(ref, () => ({
    verify: (input: string) => input.trim().toUpperCase() === codeRef.current,
    refresh,
  }), [refresh])

  return (
    <div className={`d-flex align-items-center gap-2 ${className ?? ''}`}>
      <canvas
        ref={canvasRef}
        width={160}
        height={50}
        style={{ borderRadius: 6, border: '1px solid #dee2e6', userSelect: 'none' }}
      />
      <button
        type="button"
        className="btn btn-outline-secondary btn-sm"
        onClick={refresh}
        title="Get a new code"
        aria-label="Refresh captcha"
      >
        ↻
      </button>
    </div>
  )
})

export default SimpleCaptcha
