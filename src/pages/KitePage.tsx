import AuthenticationStatus from '../components/AuthenticationStatus'

interface KitePageProps {
  onAuthChange: (isAuthenticated: boolean) => void
}

export default function KitePage({ onAuthChange }: KitePageProps) {
  return (
    <div className="mx-auto" style={{ maxWidth: 720 }}>
      <h4 className="mb-1">Zerodha Kite</h4>
      <p className="text-muted mb-4">Connect your Zerodha account to get live market data.</p>
      <AuthenticationStatus onAuthChange={onAuthChange} />
    </div>
  )
}
