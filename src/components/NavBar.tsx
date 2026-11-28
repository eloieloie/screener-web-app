import { useEffect, useRef, useState, type ReactNode } from 'react'
import './NavBar.css'

export type Page =
  | 'dashboard'
  | 'stocks'
  | 'bulk'
  | 'charts'
  | 'analytics'
  | 'nse-import'
  | 'test-trade'
  | 'kite'

interface NavBarProps {
  currentPage: Page
  onNavigate: (page: Page) => void
  userEmail: string | null
  kiteConnected: boolean
  onChangePassword: () => void
  onSignOut: () => void
}

const PRIMARY_LINKS: { page: Page; label: string }[] = [
  { page: 'dashboard', label: 'Dashboard' },
  { page: 'stocks', label: 'Stocks' },
  { page: 'charts', label: 'Charts' },
  { page: 'analytics', label: 'Analytics' },
  { page: 'bulk', label: 'Bulk Add' },
]

const TOOL_LINKS: { page: Page; label: string; hint: string }[] = [
  { page: 'nse-import', label: 'NSE Import', hint: 'Temporary page' },
  { page: 'test-trade', label: 'Trade Test', hint: 'Places live orders' },
]

function Dropdown({
  label,
  active,
  align = 'start',
  className = '',
  children,
}: {
  label: ReactNode
  active?: boolean
  align?: 'start' | 'end'
  className?: string
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="dropdown" ref={ref}>
      <button
        type="button"
        className={`${className} ${active ? 'active' : ''}`}
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        {label}
      </button>
      <div className={`dropdown-menu shadow-sm border-0 ${align === 'end' ? 'dropdown-menu-end' : ''} ${open ? 'show' : ''}`}>
        {children(() => setOpen(false))}
      </div>
    </div>
  )
}

export default function NavBar({
  currentPage,
  onNavigate,
  userEmail,
  kiteConnected,
  onChangePassword,
  onSignOut,
}: NavBarProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  const go = (page: Page) => {
    onNavigate(page)
    setMenuOpen(false)
  }

  const initial = (userEmail?.[0] ?? '?').toUpperCase()

  return (
    <nav className="app-navbar navbar navbar-expand-lg bg-white sticky-top">
      <div className="container-fluid px-4">
        <button type="button" className="navbar-brand app-navbar-brand border-0 bg-transparent" onClick={() => go('dashboard')}>
          Stock Screener
        </button>

        <button
          type="button"
          className="navbar-toggler"
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(o => !o)}
        >
          <span className="navbar-toggler-icon" />
        </button>

        <div className={`collapse navbar-collapse ${menuOpen ? 'show' : ''}`}>
          <ul className="navbar-nav me-auto align-items-lg-center gap-lg-1">
            {PRIMARY_LINKS.map(({ page, label }) => (
              <li className="nav-item" key={page}>
                <button
                  type="button"
                  className={`nav-link app-nav-link ${currentPage === page ? 'active' : ''}`}
                  onClick={() => go(page)}
                >
                  {label}
                </button>
              </li>
            ))}
            <li className="nav-item">
              <Dropdown
                label="Tools"
                className="nav-link app-nav-link"
                active={TOOL_LINKS.some(t => t.page === currentPage)}
              >
                {close =>
                  TOOL_LINKS.map(({ page, label, hint }) => (
                    <button
                      type="button"
                      key={page}
                      className={`dropdown-item ${currentPage === page ? 'active' : ''}`}
                      onClick={() => {
                        close()
                        go(page)
                      }}
                    >
                      <div>{label}</div>
                      <small className="app-dropdown-hint">{hint}</small>
                    </button>
                  ))
                }
              </Dropdown>
            </li>
          </ul>

          <div className="d-flex align-items-center gap-2 mt-3 mt-lg-0">
            <button
              type="button"
              className={`app-kite-pill ${currentPage === 'kite' ? 'active' : ''}`}
              onClick={() => go('kite')}
              title={kiteConnected ? 'Zerodha Kite connected' : 'Zerodha Kite not connected'}
            >
              <span className={`app-status-dot ${kiteConnected ? 'on' : 'off'}`} />
              Zerodha
            </button>

            <Dropdown
              align="end"
              className="app-avatar"
              label={initial}
            >
              {close => (
                <>
                  <div className="px-3 py-2 small text-muted text-truncate app-user-email">{userEmail}</div>
                  <div className="dropdown-divider" />
                  <button
                    type="button"
                    className="dropdown-item"
                    onClick={() => {
                      close()
                      setMenuOpen(false)
                      onChangePassword()
                    }}
                  >
                    Change password
                  </button>
                  <button
                    type="button"
                    className="dropdown-item text-danger"
                    onClick={() => {
                      close()
                      onSignOut()
                    }}
                  >
                    Sign out
                  </button>
                </>
              )}
            </Dropdown>
          </div>
        </div>
      </div>
    </nav>
  )
}
