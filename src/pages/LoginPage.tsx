import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth'
import { collection, getDocs, doc, setDoc, getDoc } from 'firebase/firestore'
import { auth, db } from '../config/firebase'

const googleProvider = new GoogleAuthProvider()

export default function LoginPage() {
  const [mode, setMode] = useState<'loading' | 'login' | 'setup'>('loading')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    getDocs(collection(db, 'users'))
      .then(snap => setMode(snap.empty ? 'setup' : 'login'))
      .catch(() => setMode('login'))
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch {
      setError('Invalid email or password.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setSubmitting(true)
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password)
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        role: 'admin',
        createdAt: new Date().toISOString(),
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create admin account.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogle = async () => {
    setError('')
    setSubmitting(true)
    try {
      const { user } = await signInWithPopup(auth, googleProvider)
      // Create users doc on first Google sign-in
      const userRef = doc(db, 'users', user.uid)
      const snap = await getDoc(userRef)
      if (!snap.exists()) {
        await setDoc(userRef, {
          email: user.email,
          displayName: user.displayName,
          role: 'admin',
          createdAt: new Date().toISOString(),
        })
      }
    } catch (err: unknown) {
      if (err instanceof Error && (err as { code?: string }).code !== 'auth/popup-closed-by-user') {
        setError(err.message || 'Google sign-in failed.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (mode === 'loading') {
    return (
      <div className="min-vh-100 bg-light d-flex align-items-center justify-content-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center" style={{ background: '#f0f2f5' }}>
      <motion.div
        className="card border-0 shadow"
        style={{ width: '420px' }}
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <div className="card-body p-5">
          <div className="text-center mb-4">
            <motion.div
              style={{ fontSize: '2.5rem', lineHeight: 1.2 }}
              initial={{ scale: 0, rotate: -15 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 15, delay: 0.1 }}
            >
              📊
            </motion.div>
            <h1 className="h4 fw-bold mt-2 mb-1">Stock Screener</h1>
            <p className="text-muted small mb-0">
              {mode === 'setup' ? 'Create your admin account to get started' : 'Sign in to continue'}
            </p>
          </div>

          {mode === 'setup' && (
            <motion.div
              className="alert alert-info py-2 small mb-3"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.25 }}
            >
              <strong>First-time setup</strong> — no admin account exists yet. Create one below.
            </motion.div>
          )}

          <form onSubmit={mode === 'setup' ? handleSetup : handleLogin}>
            <div className="mb-3">
              <label className="form-label fw-semibold">Email</label>
              <input
                type="email"
                className="form-control"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
                autoFocus
              />
            </div>
            <div className="mb-3">
              <label className="form-label fw-semibold">Password</label>
              <input
                type="password"
                className="form-control"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={mode === 'setup' ? 'Min. 8 characters' : 'Enter password'}
                required
              />
            </div>
            {mode === 'setup' && (
              <div className="mb-3">
                <label className="form-label fw-semibold">Confirm Password</label>
                <input
                  type="password"
                  className="form-control"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  required
                />
              </div>
            )}
            <AnimatePresence>
              {error && (
                <motion.div
                  className="alert alert-danger py-2 small mb-3"
                  initial={{ opacity: 0, y: -6, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              className="btn btn-primary w-100 py-2"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" />
                  {mode === 'setup' ? 'Creating account...' : 'Signing in...'}
                </>
              ) : mode === 'setup' ? 'Create Admin Account' : 'Sign In'}
            </motion.button>
          </form>

          <div className="d-flex align-items-center my-4">
            <hr className="flex-grow-1" />
            <span className="px-3 text-muted small">or</span>
            <hr className="flex-grow-1" />
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn btn-outline-secondary w-100 py-2 d-flex align-items-center justify-content-center gap-2"
            onClick={handleGoogle}
            disabled={submitting}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="18" height="18">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Sign in with Google
          </motion.button>
        </div>
      </motion.div>
    </div>
  )
}
