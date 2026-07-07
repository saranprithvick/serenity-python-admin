import { Box, CircularProgress } from '@mui/material'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import ForbiddenPage from '../../pages/errors/ForbiddenPage'

export default function ProtectedRoute({ children, requiredPermission = undefined }) {
  const { user, loading, hasPermission } = useAuth()

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <ForbiddenPage />
  }

  return children
}
