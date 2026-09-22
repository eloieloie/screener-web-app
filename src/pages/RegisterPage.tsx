import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { auth, db } from '../config/firebase'
import SimpleCaptcha, { type SimpleCaptchaHandle } from '../components/SimpleCaptcha'

interface RegisterPageProps {
  onSwitchToLogin: () => void
}

export default function RegisterPage({ onSwitchToLogin }: RegisterPageProps) {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [captchaInput, setCaptchaInput] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const captchaRef = useRef<SimpleCaptchaHandle>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (!captchaRef.current?.verify(captchaInput)) {
      setError('Captcha verification failed. Please try again.')
      captchaRef.current?.refresh()
      setCaptchaInput('')
      return
    }

    setSubmitting(true)
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password)
      if (displayName.trim()) {
        await updateProfile(user, { displayName: displayName.trim() })
      }
      // Auto-approve: create the users doc immediately, no manual review step.
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        displayName: displayName.trim() || null,
        role: 'user',
        approved: true,
        createdAt: new Date().toISOString(),
      })
      // onAuthStateChanged in App.tsx will pick up the signed-in user automatically.
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code
      if (code === 'auth/email-already-in-use') {
        setError('An account with this email already exists.')
      } else {
        setError(err instanceof Error ? err.message : 'Failed to create account.')
      }
      captchaRef.current?.refresh()
      setCaptchaInput('')
    } finally {
      setSubmitting(false)
    }
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
            <h1 className="h4 fw-bold mt-2 mb-1">Create Account</h1>
            <p className="text-muted small mb-0">Register to get instant access</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label fw-semibold">Name</label>
              <input
                type="text"
                className="form-control"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your name"
                autoFocus
              />
            </div>
            <div className="mb-3">
              <label className="form-label fw-semibold">Email</label>
              <input
                type="email"
                className="form-control"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="mb-3">
              <label className="form-label fw-semibold">Password</label>
              <input
                type="password"
                className="form-control"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                required
              />
            </div>
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
            <div className="mb-3">
              <label className="form-label fw-semibold">Verification</label>
              <div className="d-flex flex-column gap-2">
                <SimpleCaptcha ref={captchaRef} />
                <input
                  type="text"
                  className="form-control"
                  value={captchaInput}
                  onChange={e => setCaptchaInput(e.target.value)}
                  placeholder="Enter the code shown above"
                  required
                />
              </div>
            </div>
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
                  Creating account...
                </>
              ) : 'Register'}
            </motion.button>
          </form>

          <div className="text-center mt-4">
            <button type="button" className="btn btn-link btn-sm" onClick={onSwitchToLogin}>
              Already have an account? Sign in
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
