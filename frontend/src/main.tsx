import { StrictMode, useState, useMemo, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { AuthProvider } from './context/AuthContext'
import App from './App'
import { lightTheme, darkTheme, ColorModeContext } from './theme'
import './index.css'

type ColorModePref = 'light' | 'dark' | 'system'

function getSystemMode(): 'light' | 'dark' {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getInitialPref(): ColorModePref {
  try {
    const stored = localStorage.getItem('orthomed_color_mode')
    if (stored === 'dark' || stored === 'light' || stored === 'system') return stored
    return 'system'
  } catch {
    return 'system'
  }
}

function Root() {
  const [pref, setPref] = useState<ColorModePref>(getInitialPref)
  const [systemMode, setSystemMode] = useState<'light' | 'dark'>(getSystemMode)

  const mode: 'light' | 'dark' = pref === 'system' ? systemMode : pref

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setSystemMode(e.matches ? 'dark' : 'light')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const colorMode = useMemo(
    () => ({
      toggleColorMode: () => {
        setPref((prev) => {
          const next = prev === 'light' ? 'dark' : 'light'
          try { localStorage.setItem('orthomed_color_mode', next) } catch {}
          return next
        })
      },
      setColorModePref: (newPref: ColorModePref) => {
        try {
          if (newPref === 'system') {
            localStorage.removeItem('orthomed_color_mode')
          } else {
            localStorage.setItem('orthomed_color_mode', newPref)
          }
        } catch {}
        setPref(newPref)
      },
      mode,
      colorModePref: pref,
    }),
    [mode, pref]
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
