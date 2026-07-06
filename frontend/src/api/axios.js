import axios from 'axios'

// No baseURL — all /api/* calls are proxied to Django by Vite (dev)
// and by the production reverse-proxy, keeping requests same-origin
// so session cookies work without CORS credential restrictions.
const api = axios.create({
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

// Django's SessionAuthentication requires the csrftoken cookie value
// as the X-CSRFToken header on every state-mutating request.
api.interceptors.request.use(config => {
  const method = (config.method || '').toLowerCase()
  if (!['get', 'head', 'options'].includes(method)) {
    const csrf = document.cookie
      .split('; ')
      .find(row => row.startsWith('csrftoken='))
      ?.split('=')[1]
    if (csrf) config.headers['X-CSRFToken'] = csrf
  }
  return config
})

// Redirect to /login on session expiry. Skip the me/ and login/ endpoints
// so that auth checks and credential errors surface normally to their callers.
api.interceptors.response.use(
  response => response,
  error => {
    const url = error.config?.url || ''
    if (
      error.response?.status === 401 &&
      !url.includes('/api/practitioners/auth/me/') &&
      !url.includes('/api/practitioners/auth/login/')
    ) {
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
