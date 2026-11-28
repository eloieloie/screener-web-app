import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { onAuthStateChanged, signOut, type User } from 'firebase/auth'
import { auth } from './config/firebase'
import Analytics from './components/Analytics'
import KiteConnectAPI from './services/kiteConnectAPI'
import NavBar, { type Page } from './components/NavBar'
import KitePage from './pages/KitePage'
import StocksPage from './pages/StocksPage'
import ChartsPage from './pages/ChartsPage'
import BulkStocksPage from './pages/BulkStocksPage'
import TempNseImportPage from './pages/TempNseImportPage'
import TestTradePage from './pages/TestTradePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ChangePasswordModal from './components/ChangePasswordModal'

function App() {
  // Zerodha redirects back with ?request_token=..., which the Kite page must handle
  const [currentPage, setCurrentPage] = useState<Page>(() =>
    new URLSearchParams(window.location.search).has('request_token') ? 'kite' : 'dashboard'
  )
  const [kiteConnected, setKiteConnected] = useState(false)
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [authView, setAuthView] = useState<'login' | 'register'>('login')

  useEffect(() => {
    return onAuthStateChanged(auth, u => setUser(u))
  }, [])

  useEffect(() => {
    if (!user || new URLSearchParams(window.location.search).has('request_token')) return
    const kite = KiteConnectAPI.getInstance()
    kite.checkAuthStatus().then(() => setKiteConnected(kite.isReady()))
  }, [user])

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
    return authView === 'register' ? (
      <RegisterPage onSwitchToLogin={() => setAuthView('login')} />
    ) : (
      <LoginPage onSwitchToRegister={() => setAuthView('register')} />
    )
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
      <NavBar
        currentPage={currentPage}
        onNavigate={page => {
          if (page === 'charts') clearTagFilter()
          setCurrentPage(page)
        }}
        userEmail={user.email}
        kiteConnected={kiteConnected}
        onChangePassword={() => setShowChangePassword(true)}
        onSignOut={() => signOut(auth)}
      />

      {showChangePassword && (
        <ChangePasswordModal user={user} onClose={() => setShowChangePassword(false)} />
      )}

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
            ) : currentPage === 'kite' ? (
              <KitePage onAuthChange={setKiteConnected} />
            ) : currentPage === 'stocks' ? (
              <StocksPage onNavigateToChartsWithTag={navigateToChartsWithTag} />
            ) : currentPage === 'bulk' ? (
              <BulkStocksPage />
            ) : currentPage === 'charts' ? (
              <ChartsPage selectedTag={selectedTag} onClearTagFilter={clearTagFilter} />
            ) : currentPage === 'nse-import' ? (
              <TempNseImportPage />
            ) : currentPage === 'test-trade' ? (
              <TestTradePage />
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
