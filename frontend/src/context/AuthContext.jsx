import { createContext, useContext, useEffect, useState } from 'react'
import api from '../api/axios'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [permissions, setPermissions] = useState([])
  const [loading, setLoading] = useState(true)

  const loadPermissions = async (userData) => {
    if (!userData) {
      setPermissions([])
      return
    }
    if (userData.is_superuser) {
      setPermissions(['*'])
      return
    }
    try {
      const res = await api.get(`/api/administration/user-roles/${userData.id}/permissions/`)
      const perms = (res.data.results ?? res.data).map((p) => p.key)
      console.log('Loaded permissions:', perms)
      setPermissions(perms)
    } catch (err) {
      console.error('Permission load error:', err)
      setPermissions([])
    }
  }

  const checkAuth = async () => {
    try {
      const res = await api.get('/api/practitioners/auth/me/')
      setUser(res.data)
      await loadPermissions(res.data)
    } catch {
      setUser(null)
      setPermissions([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkAuth()
  }, [])

  const login = async (email, password) => {
    const res = await api.post('/api/practitioners/auth/login/', { email, password })
    setUser(res.data)
    await loadPermissions(res.data)
    return res.data
  }

  const logout = async () => {
    try {
      await api.post('/api/practitioners/auth/logout/')
    } finally {
      setUser(null)
      setPermissions([])
      window.location.href = '/login'
    }
  }

  const hasPermission = (key) => permissions.includes('*') || permissions.includes(key)

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth, permissions, hasPermission }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
