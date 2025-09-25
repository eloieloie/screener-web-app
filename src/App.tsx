import { useState } from 'react'
import Analytics from './components/Analytics'
import AuthenticationStatus from './components/AuthenticationStatus'
import StocksPage from './pages/StocksPage'
import ChartsPage from './pages/ChartsPage'
import BulkStocksPage from './pages/BulkStocksPage'

function App() {
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'stocks' | 'bulk' | 'charts' | 'analytics'>('dashboard')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)

  const navigateToChartsWithTag = (tag: string) => {
    setSelectedTag(tag)
    setCurrentPage('charts')
  }

  const clearTagFilter = () => {
    setSelectedTag(null)
  }

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
              📊 Stocks List
            </button>
            <button 
              className={`btn ${currentPage === 'bulk' ? 'btn-primary' : 'btn-outline-primary'} me-2`}
              onClick={() => setCurrentPage('bulk')}
            >
              📦 Bulk Add
            </button>
            <button 
              className={`btn ${currentPage === 'charts' ? 'btn-primary' : 'btn-outline-primary'} me-2`}
              onClick={() => {
                clearTagFilter()
                setCurrentPage('charts')
              }}
            >
              📈 Charts
            </button>
            <button 
              className={`btn ${currentPage === 'analytics' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setCurrentPage('analytics')}
            >
              📊 Analytics
            </button>
          </div>
        </div>
      </nav>

      <div className="container-fluid mt-4">
        {currentPage === 'dashboard' ? (
          <>
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
                        📊 View Stocks List
                      </button>
                      <button 
                        className="btn btn-success"
                        onClick={() => setCurrentPage('bulk')}
                      >
                        📦 Bulk Add Stocks
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
                        📊 View Analytics
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : currentPage === 'stocks' ? (
          <StocksPage onNavigateToChartsWithTag={navigateToChartsWithTag} />
        ) : currentPage === 'bulk' ? (
          <BulkStocksPage />
        ) : currentPage === 'charts' ? (
          <ChartsPage selectedTag={selectedTag} onClearTagFilter={clearTagFilter} />
        ) : (
          <Analytics />
        )}
      </div>
    </div>
  )
}

export default App
