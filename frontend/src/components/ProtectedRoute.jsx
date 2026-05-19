import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute() {
  const { initializing, isAuthenticated, profile, profileLoading } = useAuth()
  const location = useLocation()

  // Aguarda enquanto inicializa OU enquanto o profile ainda não chegou — evita
  // o "flash" de botões e menus liberados antes dos escopos serem carregados.
  if (initializing || (isAuthenticated && !profile && profileLoading)) {
    return (
      <div className="screen-center">
        <div className="loading-panel">
          <span className="loading-dot" />
          <strong>Carregando sessão</strong>
          <p>Validando credenciais e permissões do usuário.</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
