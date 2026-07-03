import { useState } from 'react'
import { Alert, Box, Button, TextField, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Left panel */}
      <Box
        sx={{
          flex: 1,
          bgcolor: '#1A202C',
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          px: 6,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle grid overlay */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <Box sx={{ position: 'relative', textAlign: 'center', maxWidth: 380 }}>
          <Typography
            sx={{
              fontSize: 48,
              fontWeight: 700,
              color: '#fff',
              letterSpacing: '-1px',
              lineHeight: 1.1,
              mb: 2,
            }}
          >
            <Box component="span" sx={{ color: '#F97316' }}>◈</Box>
            {' '}OrthoMed
          </Typography>

          <Typography
            sx={{
              fontSize: 16,
              color: 'rgba(255,255,255,0.55)',
              lineHeight: 1.6,
              fontWeight: 400,
            }}
          >
            Enterprise Healthcare Administration
          </Typography>

          <Box
            sx={{
              mt: 5,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
            }}
          >
            {[
              'Multi-tenant practitioner management',
              'Role-based access control',
              'Secure session authentication',
            ].map((text) => (
              <Box
                key={text}
                sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}
              >
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: '#F97316',
                    flexShrink: 0,
                  }}
                />
                <Typography sx={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', textAlign: 'left' }}>
                  {text}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      {/* Right panel */}
      <Box
        sx={{
          flex: 1,
          bgcolor: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: 4,
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 400 }}>
          {/* Mobile logo */}
          <Box sx={{ display: { xs: 'block', md: 'none' }, textAlign: 'center', mb: 4 }}>
            <Typography sx={{ fontSize: 28, fontWeight: 700, color: '#1A202C' }}>
              <Box component="span" sx={{ color: '#F97316' }}>◈</Box> OrthoMed
            </Typography>
          </Box>

          <Typography
            variant="h4"
            sx={{ fontWeight: 700, color: '#1A202C', mb: 0.75, fontSize: 28 }}
          >
            Welcome back
          </Typography>
          <Typography sx={{ fontSize: 15, color: '#718096', mb: 4 }}>
            Sign in to your account
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}
          >
            <TextField
              label="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
              autoComplete="email"
              autoFocus
              size="medium"
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
              autoComplete="current-password"
              size="medium"
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={submitting}
              sx={{
                mt: 0.5,
                py: 1.5,
                fontSize: 15,
                fontWeight: 600,
                bgcolor: '#F97316',
                '&:hover': { bgcolor: '#ea6c0a' },
              }}
            >
              {submitting ? 'Signing in…' : 'Sign In'}
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
