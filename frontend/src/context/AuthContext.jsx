import { createContext, useContext, useEffect, useState } from 'react'
import api from '../api/axios'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const checkAuth = async () => {
    try {
      const res = await api.get('/api/auth/me/')
      setUser(res.data)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkAuth()
  }, [])

  const login = async (email, password) => {
    try {
      const res = await api.post('/api/auth/login/', { email, password })
      setUser(res.data)
      return res.data
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Login failed')
    }
  }

  const logout = async () => {
    try {
      await api.post('/api/auth/logout/')
    } finally {
      setUser(null)
      window.location.href = '/login'
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
