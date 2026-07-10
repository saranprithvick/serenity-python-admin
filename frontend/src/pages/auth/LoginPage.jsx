import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Link,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material'
import LocalHospitalIcon from '@mui/icons-material/LocalHospital'
import SecurityIcon from '@mui/icons-material/Security'
import InsightsIcon from '@mui/icons-material/Insights'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const FEATURES = [
  {
    icon: <LocalHospitalIcon sx={{ fontSize: 20, color: '#F97316' }} />,
    primary: 'Multi-Hospital Support',
    secondary: 'Manage multiple tenants from one platform',
  },
  {
    icon: <SecurityIcon sx={{ fontSize: 20, color: '#F97316' }} />,
    primary: 'Role-Based Access Control',
    secondary: 'Granular permissions for every team member',
  },
  {
    icon: <InsightsIcon sx={{ fontSize: 20, color: '#F97316' }} />,
    primary: 'Real-Time Analytics',
    secondary: 'Track performance with live dashboards',
  },
]

export default function LoginPage() {
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [showPass, setShowPass]     = useState(false)
  const [error, setError]           = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [snackbar, setSnackbar]     = useState(false)
  const { login }    = useAuth()
  const navigate     = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address.')
      return
    }

    setSubmitting(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      const status = err.response?.status
      if (status === 401) {
        setError('Invalid email or password. Please try again.')
      } else if (status === 400) {
        setError('Please check your email and password format.')
      } else {
        setError('Unable to connect. Please check your connection and try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* ── Left panel ──────────────────────────────────────────── */}
      <Box
        sx={{
          width: '60%',
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #1A202C 0%, #2D3748 50%, #1A202C 100%)',
        }}
      >
        {/* Decorative circles */}
        <Box sx={{ position: 'absolute', width: 400, height: 400, top: -100, left: -100, borderRadius: '50%', background: 'rgba(249,115,22,0.08)' }} />
        <Box sx={{ position: 'absolute', width: 300, height: 300, bottom: -80, right: -80, borderRadius: '50%', background: 'rgba(249,115,22,0.06)' }} />
        <Box sx={{ position: 'absolute', width: 200, height: 200, top: '40%', left: '40%', borderRadius: '50%', background: 'rgba(249,115,22,0.04)' }} />

        {/* Content */}
        <Box sx={{ position: 'relative', textAlign: 'center', px: 6, maxWidth: 480 }}>
          {/* Logo */}
          <Typography sx={{ fontSize: 48, color: '#F97316', lineHeight: 1 }}>◈</Typography>
          <Typography
            sx={{
              fontSize: 36, fontWeight: 800, color: '#FFFFFF',
              letterSpacing: '-1px', mt: 0.5, lineHeight: 1,
            }}
          >
            OrthoMed
          </Typography>

          {/* Divider */}
          <Box sx={{ width: 40, height: 3, bgcolor: '#F97316', borderRadius: '2px', mx: 'auto', my: 2 }} />

          {/* Tagline */}
          <Typography sx={{ fontSize: 20, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
            Empowering Orthopaedic Care
          </Typography>

          {/* Subtitle */}
          <Typography
            sx={{
              fontSize: 14, color: 'rgba(255,255,255,0.5)',
              mt: 1.5, lineHeight: 1.6, maxWidth: 320, mx: 'auto',
            }}
          >
            Manage your practice, patients, and team from one powerful platform.
          </Typography>

          {/* Feature highlights */}
          <Box sx={{ mt: 6, textAlign: 'left' }}>
            {FEATURES.map(({ icon, primary, secondary }) => (
              <Box key={primary} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                <Box
                  sx={{
                    bgcolor: 'rgba(249,115,22,0.15)',
                    p: '10px',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {icon}
                </Box>
                <Box>
                  <Typography sx={{ color: '#FFFFFF', fontWeight: 600, fontSize: 14, lineHeight: 1.3 }}>
                    {primary}
                  </Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, mt: 0.25, lineHeight: 1.4 }}>
                    {secondary}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Bottom trust line */}
        <Typography
          sx={{
            position: 'absolute', bottom: 32,
            fontSize: 11, color: 'rgba(255,255,255,0.3)',
            textAlign: 'center',
          }}
        >
          Trusted by leading orthopaedic practices
        </Typography>
      </Box>

      {/* ── Right panel ─────────────────────────────────────────── */}
      <Box
        sx={{
          width: { xs: '100%', md: '40%' },
          bgcolor: 'background.paper',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 380, px: '40px' }}>

          {/* Mobile logo — only visible when left panel is hidden */}
          <Box sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', alignItems: 'center', mb: 4 }}>
            <Typography sx={{ fontSize: 32, color: '#F97316', lineHeight: 1 }}>◈</Typography>
            <Typography sx={{ fontSize: 24, fontWeight: 800, color: 'text.primary', letterSpacing: '-0.5px' }}>
              OrthoMed
            </Typography>
          </Box>

          {/* Header */}
          <Typography sx={{ fontSize: 28, fontWeight: 800, color: 'text.primary', letterSpacing: '-0.5px', lineHeight: 1.2 }}>
            Welcome back
          </Typography>
          <Typography sx={{ fontSize: 14, color: 'text.secondary', mt: 1 }}>
            Sign in to continue to OrthoMed
          </Typography>

          {/* Form */}
          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 4 }}>
            <TextField
              label="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
              autoComplete="email"
              autoFocus
              variant="outlined"
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
            />

            <TextField
              label="Password"
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
              autoComplete="current-password"
              variant="outlined"
              sx={{ mt: 2, '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPass((v) => !v)}
                        edge="end"
                        size="small"
                        tabIndex={-1}
                      >
                        {showPass
                          ? <VisibilityOffIcon sx={{ fontSize: 18, color: '#9CA3AF' }} />
                          : <VisibilityIcon    sx={{ fontSize: 18, color: '#9CA3AF' }} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />

            {/* Forgot password */}
            <Box sx={{ mt: 1, textAlign: 'right' }}>
              <Link
                component="button"
                type="button"
                underline="none"
                onClick={() => setSnackbar(true)}
                sx={{ fontSize: 13, color: '#F97316', cursor: 'pointer', fontWeight: 500, '&:hover': { color: '#EA6C0A' } }}
              >
                Forgot password?
              </Link>
            </Box>

            {/* Submit */}
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={submitting}
              sx={{
                mt: 3,
                py: '12px',
                fontSize: 15,
                fontWeight: 700,
                borderRadius: '8px',
                textTransform: 'none',
                background: 'linear-gradient(135deg, #F97316 0%, #EA6C0A 100%)',
                boxShadow: '0 4px 12px rgba(249,115,22,0.4)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #EA6C0A 0%, #D96309 100%)',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 6px 16px rgba(249,115,22,0.5)',
                },
                '&:disabled': {
                  background: 'linear-gradient(135deg, #F97316 0%, #EA6C0A 100%)',
                  opacity: 0.7,
                },
              }}
            >
              {submitting
                ? <CircularProgress size={20} sx={{ color: '#fff' }} />
                : 'Sign In'}
            </Button>

            {/* Error alert */}
            {error && (
              <Alert severity="error" sx={{ mt: 2, borderRadius: '8px', fontSize: 13 }}>
                {error}
              </Alert>
            )}
          </Box>

          {/* Footer */}
          <Box sx={{ mt: 5, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>OrthoMed v1.0</Typography>
            <Typography sx={{ fontSize: 11, color: 'text.disabled', mt: 0.5 }}>© 2026 OrthoMed Platform</Typography>
          </Box>
        </Box>
      </Box>

      {/* Forgot password snackbar */}
      <Snackbar
        open={snackbar}
        autoHideDuration={3000}
        onClose={() => setSnackbar(false)}
        message="Password reset coming soon"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}
