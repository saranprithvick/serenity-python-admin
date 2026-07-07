import { Box, Button, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import DashboardIcon from '@mui/icons-material/Dashboard'
import SearchOffIcon from '@mui/icons-material/SearchOff'
import { useNavigate } from 'react-router-dom'

export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#F8FAFC',
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
        404
      </Typography>

      {/* Illustration icon */}
      <SearchOffIcon sx={{ fontSize: '80px', color: '#E2E8F0', mt: '-20px' }} />

      {/* Title */}
      <Typography sx={{ fontSize: '24px', fontWeight: 700, color: '#1A202C', mt: 2 }}>
        Page Not Found
      </Typography>

      {/* Subtitle */}
      <Typography
        sx={{
          fontSize: '14px',
          color: '#718096',
          textAlign: 'center',
          maxWidth: 320,
          lineHeight: 1.6,
          mt: 1,
        }}
      >
        The page you're looking for doesn't exist or has been moved.
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
            borderColor: '#E2E8F0',
            color: '#718096',
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: 2,
            '&:hover': { borderColor: '#CBD5E0', bgcolor: 'rgba(0,0,0,0.02)' },
          }}
        >
          Go Back
        </Button>
      </Box>

      {/* OrthoMed branding */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: '48px' }}>
        <Typography sx={{ fontSize: '18px', color: '#CBD5E0', lineHeight: 1 }}>◈</Typography>
        <Typography sx={{ fontSize: '14px', fontWeight: 700, color: '#CBD5E0', letterSpacing: '-0.3px' }}>
          OrthoMed
        </Typography>
      </Box>
    </Box>
  )
}
