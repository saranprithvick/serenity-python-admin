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

const baseComponents = {
  MuiButton: {
    styleOverrides: {
      root: { borderRadius: 8, textTransform: 'none', fontWeight: 600 },
    },
  },
  MuiChip: {
    styleOverrides: {
      root: { borderRadius: 6, fontWeight: 500 },
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
          borderRadius: 8,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: '1px solid #E2E8F0',
        },
      },
    },
    MuiDataGrid: {
      styleOverrides: {
        root: { border: 'none', borderRadius: 0 },
        row: { '&:nth-of-type(even)': { backgroundColor: '#F8FAFC' } },
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
          borderRadius: 8,
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.08)',
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
            '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
            '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
          },
        },
      },
    },
  },
})

export const ColorModeContext = createContext({ toggleColorMode: () => {}, mode: 'light' })
export const useColorMode = () => useContext(ColorModeContext)

export default lightTheme
