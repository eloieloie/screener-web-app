import { useState } from 'react'
import Analytics from './components/Analytics'
import AuthenticationStatus from './components/AuthenticationStatus'
import StocksPage from './pages/StocksPage'
import ChartsPage from './pages/ChartsPage'

function App() {
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'stocks' | 'charts' | 'analytics'>('dashboard')

  return (
    <div className="min-vh-100 bg-light">
      {/* Bootstrap Navigation */}
      <nav className="navbar navbar-expand-lg navbar-light bg-white shadow-sm">
        <div className="container">
          <span className="navbar-brand h1 mb-0">📊 Stock Screener</span>
          <div className="navbar-nav ms-auto">
            <button 
              className={`btn ${currentPage === 'dashboard' ? 'btn-primary' : 'btn-outline-primary'} me-2`}
              onClick={() => setCurrentPage('dashboard')}
            >
              🏠 Dashboard
            </button>
            <button 
              className={`btn ${currentPage === 'stocks' ? 'btn-primary' : 'btn-outline-primary'} me-2`}
              onClick={() => setCurrentPage('stocks')}
            >
              📊 My Stocks
            </button>
            <button 
              className={`btn ${currentPage === 'charts' ? 'btn-primary' : 'btn-outline-primary'} me-2`}
              onClick={() => setCurrentPage('charts')}
            >
              📈 Charts
            </button>
            <button 
              className={`btn ${currentPage === 'analytics' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setCurrentPage('analytics')}
            >
              � Analytics
            </button>
          </div>
        </div>
      </nav>

      <div className="container mt-4">
        {currentPage === 'dashboard' ? (
          <>
            {/* Welcome Section */}
            <div className="row mb-4">
              <div className="col-12">
                <div className="card border-0 shadow-sm">
                  <div className="card-body text-center py-5">
                    <div className="display-1 mb-3">📊</div>
                    <h1 className="h2 mb-3">Welcome to Stock Screener</h1>
                    <p className="lead text-muted mb-4">
                      Track your portfolio, analyze market trends, and make informed investment decisions.
                    </p>
                    <div className="row g-3 mt-4">
                      <div className="col-md-4">
                        <div className="card h-100 border-0 bg-light">
                          <div className="card-body text-center">
                            <div className="h2 mb-2">📈</div>
                            <h5>Real-time Data</h5>
                            <p className="small text-muted">Get live stock prices and market updates</p>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="card h-100 border-0 bg-light">
                          <div className="card-body text-center">
                            <div className="h2 mb-2">💼</div>
                            <h5>Portfolio Tracking</h5>
                            <p className="small text-muted">Monitor your investments and performance</p>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="card h-100 border-0 bg-light">
                          <div className="card-body text-center">
                            <div className="h2 mb-2">📊</div>
                            <h5>Analytics</h5>
                            <p className="small text-muted">Advanced charts and market analysis</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Authentication Status */}
            <AuthenticationStatus />

            {/* Quick Actions */}
            <div className="row">
              <div className="col-12">
                <div className="card border-0 shadow-sm">
                  <div className="card-body">
                    <h5 className="card-title">🚀 Quick Actions</h5>
                    <div className="d-flex gap-2 flex-wrap">
                      <button 
                        className="btn btn-primary"
                        onClick={() => setCurrentPage('stocks')}
                      >
                        📊 View My Stocks
                      </button>
                      <button 
                        className="btn btn-outline-primary"
                        onClick={() => setCurrentPage('charts')}
                      >
                        📈 View Charts
                      </button>
                      <button 
                        className="btn btn-outline-primary"
                        onClick={() => setCurrentPage('analytics')}
                      >
                        � View Analytics
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : currentPage === 'stocks' ? (
          <StocksPage />
        ) : currentPage === 'charts' ? (
          <ChartsPage />
        ) : (
          <Analytics />
        )}
      </div>
    </div>
  )
}

export default App
