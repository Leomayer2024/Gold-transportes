import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getDefaultAuthorizedPath, hasScopePermission } from '../lib/permissions'

export default function AccessRoute({ requiredScope }) {
  const { profile } = useAuth()

  if (hasScopePermission(profile, requiredScope)) {
    return <Outlet />
  }

  return <Navigate replace to={getDefaultAuthorizedPath(profile)} />
}