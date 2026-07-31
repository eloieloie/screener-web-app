import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { onAuthStateChanged, signOut, type User } from 'firebase/auth'
import { auth } from './config/firebase'
import Analytics from './components/Analytics'
import AuthenticationStatus from './components/AuthenticationStatus'
import StocksPage from './pages/StocksPage'
import ChartsPage from './pages/ChartsPage'
import BulkStocksPage from './pages/BulkStocksPage'
import TempNseImportPage from './pages/TempNseImportPage'
import LoginPage from './pages/LoginPage'

function App() {
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'stocks' | 'bulk' | 'charts' | 'analytics' | 'nse-import'>('dashboard')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [user, setUser] = useState<User | null | undefined>(undefined)

  useEffect(() => {
    return onAuthStateChanged(auth, u => setUser(u))
  }, [])

  if (user === undefined) {
    return (
      <motion.div
        className="min-vh-100 bg-light d-flex align-items-center justify-content-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </motion.div>
    )
  }

  if (user === null) {
    return <LoginPage />
  }

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
          <motion.span
            className="navbar-brand h1 mb-0"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            📊 Stock Screener
          </motion.span>
          <div className="navbar-nav ms-auto">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`btn ${currentPage === 'dashboard' ? 'btn-primary' : 'btn-outline-primary'} me-2`}
              onClick={() => setCurrentPage('dashboard')}
            >
              🏠 Dashboard
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`btn ${currentPage === 'stocks' ? 'btn-primary' : 'btn-outline-primary'} me-2`}
              onClick={() => setCurrentPage('stocks')}
            >
              📊 Stocks List
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`btn ${currentPage === 'bulk' ? 'btn-primary' : 'btn-outline-primary'} me-2`}
              onClick={() => setCurrentPage('bulk')}
            >
              📦 Bulk Add
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`btn ${currentPage === 'charts' ? 'btn-primary' : 'btn-outline-primary'} me-2`}
              onClick={() => {
                clearTagFilter()
                setCurrentPage('charts')
              }}
            >
              📈 Charts
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`btn ${currentPage === 'analytics' ? 'btn-primary' : 'btn-outline-primary'} me-2`}
              onClick={() => setCurrentPage('analytics')}
            >
              📊 Analytics
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`btn ${currentPage === 'nse-import' ? 'btn-warning' : 'btn-outline-warning'} me-2`}
              onClick={() => setCurrentPage('nse-import')}
              title="Temporary page — remove after permanent pipeline is set up"
            >
              🗂️ NSE Import
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="btn btn-outline-danger"
              onClick={() => signOut(auth)}
              title={`Signed in as ${user.email}`}
            >
              Sign Out
            </motion.button>
          </div>
        </div>
      </nav>

      <div className="container-fluid mt-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
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
                          <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            className="btn btn-primary"
                            onClick={() => setCurrentPage('stocks')}
                          >
                            📊 View Stocks List
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            className="btn btn-success"
                            onClick={() => setCurrentPage('bulk')}
                          >
                            📦 Bulk Add Stocks
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            className="btn btn-outline-primary"
                            onClick={() => setCurrentPage('charts')}
                          >
                            📈 View Charts
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            className="btn btn-outline-primary"
                            onClick={() => setCurrentPage('analytics')}
                          >
                            📊 View Analytics
                          </motion.button>
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
            ) : currentPage === 'nse-import' ? (
              <TempNseImportPage />
            ) : (
              <Analytics />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

export default App
