import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute() {
  const { initializing, isAuthenticated } = useAuth()
  const location = useLocation()

  if (initializing) {
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
