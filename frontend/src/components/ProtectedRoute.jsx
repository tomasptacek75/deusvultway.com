import { Navigate } from 'react-router-dom'
import { getUser, isAuthenticated } from '../api/client'

export default function ProtectedRoute({ role, children }) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />
  const user = getUser()
  if (role && user?.role !== role) return <Navigate to="/login" replace />
  return children
}
