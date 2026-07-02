import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import ProtectedRoute from './components/common/ProtectedRoute'
import LoginPage from './pages/auth/LoginPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import UsersPage from './pages/administration/UsersPage'
import RolesPage from './pages/administration/RolesPage'
import PermissionsPage from './pages/administration/PermissionsPage'
import PractitionersPage from './pages/practitioners/PractitionersPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/administration/users" element={<UsersPage />} />
        <Route path="/administration/roles" element={<RolesPage />} />
        <Route path="/administration/permissions" element={<PermissionsPage />} />
        <Route path="/practitioners" element={<PractitionersPage />} />
      </Route>
    </Routes>
  )
}
