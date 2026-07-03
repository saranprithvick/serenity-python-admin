import { StrictMode, useState, useMemo } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { AuthProvider } from './context/AuthContext'
import App from './App'
import { lightTheme, darkTheme, ColorModeContext } from './theme'
import './index.css'

function Root() {
  const [mode, setMode] = useState<'light' | 'dark'>(() => {
    try {
      return (localStorage.getItem('orthomed_color_mode') as 'light' | 'dark') || 'light'
    } catch {
      return 'light'
    }
  })

  const colorMode = useMemo(
    () => ({
      toggleColorMode: () => {
        setMode((prev) => {
          const next = prev === 'light' ? 'dark' : 'light'
          try { localStorage.setItem('orthomed_color_mode', next) } catch {}
          return next
        })
      },
      mode,
    }),
    [mode]
  )

  const theme = mode === 'light' ? lightTheme : darkTheme

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </ColorModeContext.Provider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
)
