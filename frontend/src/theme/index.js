import { createTheme } from '@mui/material/styles'
import { createContext, useContext } from 'react'

const baseTypography = {
  fontFamily: '"Plus Jakarta Sans", sans-serif',
  h4: { fontWeight: 700 },
  h5: { fontWeight: 700 },
  h6: { fontWeight: 600 },
  subtitle1: { fontWeight: 500 },
  subtitle2: { fontWeight: 500 },
  body1: { fontWeight: 400 },
  body2: { fontWeight: 400 },
  button: { fontWeight: 600, textTransform: 'none' },
}

// Shared overrides that don't depend on palette mode
const baseComponents = {
  MuiButton: {
    styleOverrides: {
      root: { borderRadius: 8, textTransform: 'none', fontWeight: 600 },
      containedPrimary: {
        background: 'linear-gradient(135deg, #F97316 0%, #EA6C0A 100%)',
        boxShadow: '0 1px 2px rgba(249,115,22,0.4)',
        '&:hover': {
          background: 'linear-gradient(135deg, #EA6C0A 0%, #D96309 100%)',
          boxShadow: '0 4px 8px rgba(249,115,22,0.4)',
        },
      },
      outlinedPrimary: {
        borderColor: '#F97316',
        '&:hover': {
          backgroundColor: 'rgba(249,115,22,0.04)',
        },
      },
    },
  },
  MuiChip: {
    styleOverrides: {
      root: { borderRadius: 6, fontWeight: 600, fontSize: 12 },
    },
  },
  MuiTooltip: {
    styleOverrides: {
      tooltip: {
        backgroundColor: '#1A202C',
        fontSize: 12,
        borderRadius: 6,
        padding: '6px 10px',
      },
    },
  },
  MuiDialog: {
    styleOverrides: {
      paper: {
        borderRadius: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      },
    },
  },
  MuiDrawer: {
    styleOverrides: {
      paper: {
        borderLeft: 'none',
        boxShadow: '-4px 0 20px rgba(0,0,0,0.1)',
      },
    },
  },
}

export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#F97316' },
    secondary: { main: '#1A202C' },
    background: { default: '#F8FAFC', paper: '#FFFFFF' },
    text: { primary: '#1A202C', secondary: '#718096' },
    divider: '#E2E8F0',
  },
  typography: baseTypography,
  shape: { borderRadius: 8 },
  components: {
    ...baseComponents,
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.1)',
          border: '1px solid #F1F5F9',
          transition: 'box-shadow 0.2s ease, transform 0.2s ease',
          '&:hover': {
            boxShadow: '0 4px 6px rgba(0,0,0,0.07), 0 10px 15px rgba(0,0,0,0.1)',
            transform: 'translateY(-1px)',
          },
        },
      },
    },
    MuiDataGrid: {
      styleOverrides: {
        root: { border: 'none', borderRadius: 0 },
        row: { '&:nth-of-type(even)': { backgroundColor: '#F8FAFC' } },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            '&.Mui-focused fieldset': {
              borderColor: '#F97316',
              borderWidth: 2,
            },
          },
          '& label.Mui-focused': { color: '#F97316' },
        },
      },
    },
  },
})

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#F97316' },
    secondary: { main: '#94A3B8' },
    background: { default: '#0F172A', paper: '#1E293B' },
    text: { primary: '#F1F5F9', secondary: '#94A3B8' },
    divider: 'rgba(255,255,255,0.08)',
  },
  typography: baseTypography,
  shape: { borderRadius: 8 },
  components: {
    ...baseComponents,
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.08)',
          transition: 'box-shadow 0.2s ease, transform 0.2s ease',
          '&:hover': {
            boxShadow: '0 4px 6px rgba(0,0,0,0.3), 0 10px 15px rgba(0,0,0,0.3)',
            transform: 'translateY(-1px)',
          },
        },
      },
    },
    MuiDataGrid: {
      styleOverrides: {
        root: { border: 'none', borderRadius: 0 },
        row: { '&:nth-of-type(even)': { backgroundColor: 'rgba(255,255,255,0.03)' } },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
            '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
            '&.Mui-focused fieldset': {
              borderColor: '#F97316',
              borderWidth: 2,
            },
          },
          '& label.Mui-focused': { color: '#F97316' },
        },
      },
    },
  },
})

export const ColorModeContext = createContext({ toggleColorMode: () => {}, mode: 'light' })
export const useColorMode = () => useContext(ColorModeContext)

export default lightTheme
