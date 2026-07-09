import { Box, Button, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import DashboardIcon from '@mui/icons-material/Dashboard'
import LockIcon from '@mui/icons-material/Lock'
import { useNavigate } from 'react-router-dom'

export default function ForbiddenPage() {
  const navigate = useNavigate()

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        bgcolor: 'background.default',
        px: 3,
      }}
    >
      {/* Large gradient number */}
      <Typography
        sx={{
          fontSize: '120px',
          fontWeight: 800,
          background: 'linear-gradient(135deg, #F97316, #EA6C0A)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          lineHeight: 1,
          userSelect: 'none',
        }}
      >
        403
      </Typography>

      {/* Illustration icon */}
      <LockIcon sx={{ fontSize: '80px', color: 'divider', mt: '-20px' }} />

      {/* Title */}
      <Typography sx={{ fontSize: '24px', fontWeight: 700, color: 'text.primary', mt: 2 }}>
        Access Denied
      </Typography>

      {/* Subtitle */}
      <Typography
        sx={{
          fontSize: '14px',
          color: 'text.secondary',
          textAlign: 'center',
          maxWidth: 320,
          lineHeight: 1.6,
          mt: 1,
        }}
      >
        You don't have permission to view this page. Contact your administrator if you think this is a mistake.
      </Typography>

      {/* Action buttons */}
      <Box sx={{ display: 'flex', gap: '12px', mt: '32px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Button
          variant="contained"
          startIcon={<DashboardIcon />}
          onClick={() => navigate('/dashboard')}
          sx={{
            bgcolor: '#F97316',
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: 2,
            '&:hover': { bgcolor: '#EA6C0A' },
          }}
        >
          Go to Dashboard
        </Button>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: 2,
          }}
        >
          Go Back
        </Button>
      </Box>

      {/* OrthoMed branding */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: '48px' }}>
        <Typography sx={{ fontSize: '18px', color: 'text.disabled', lineHeight: 1 }}>◈</Typography>
        <Typography sx={{ fontSize: '14px', fontWeight: 700, color: 'text.disabled', letterSpacing: '-0.3px' }}>
          OrthoMed
        </Typography>
      </Box>
    </Box>
  )
}
