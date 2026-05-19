import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Sidebar from './Sidebar'
import NotificationBell from './NotificationBell'

function TrialBanner() {
  const { assinaturaStatus, assinaturaDiasTrial } = useAuth()
  if (assinaturaStatus !== 'trial' || assinaturaDiasTrial === null || assinaturaDiasTrial > 7) {
    return null
  }
  const msg = assinaturaDiasTrial <= 0
    ? 'Seu período de avaliação encerrou.'
    : `Seu trial expira em ${assinaturaDiasTrial} dia${assinaturaDiasTrial !== 1 ? 's' : ''}.`
  return (
    <div className="trial-banner">
      <span>{msg} </span>
      <Link className="trial-banner-link" to="/assinatura">Assinar agora</Link>
    </div>
  )
}

export default function Layout() {
  return (
    <div className="app-frame">
      <Sidebar />
      <main className="content-shell">
        <TrialBanner />
        <NotificationBell />
        <Outlet />
      </main>
    </div>
  )
}
