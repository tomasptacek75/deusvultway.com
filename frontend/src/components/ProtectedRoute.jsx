import { Navigate } from 'react-router-dom'
import { getUser, isAuthenticated, loginPath } from '../api/client'

export default function ProtectedRoute({ role, children }) {
  if (!isAuthenticated()) return <Navigate to={loginPath()} replace />
  const user = getUser()
  if (role && user?.role !== role) return <Navigate to={loginPath()} replace />
  return children
}
