import { useEffect, useState } from 'react'
import { Box, Card, CardContent, Skeleton, Typography } from '@mui/material'
import PeopleIcon from '@mui/icons-material/People'
import SecurityIcon from '@mui/icons-material/Security'
import ApartmentIcon from '@mui/icons-material/Apartment'
import MedicalServicesIcon from '@mui/icons-material/MedicalServices'
import api from '../../api/axios'

function StatCard({ icon, value, label, color, loading }) {
  return (
    <Card sx={{ flex: 1, minWidth: 200, borderRadius: 2 }}>
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2.5, p: 3, '&:last-child': { pb: 3 } }}>
        <Box
          sx={{
            bgcolor: `${color}18`,
            color,
            borderRadius: 2,
            p: 1.5,
            display: 'flex',
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>
        <Box>
          {loading ? (
            <>
              <Skeleton variant="text" width={60} height={40} />
              <Skeleton variant="text" width={90} height={20} />
            </>
          ) : (
            <>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 700,
                  lineHeight: 1,
                  color: '#1e2a3b',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {value ?? '—'}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                {label}
              </Typography>
            </>
          )}
        </Box>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/auth/dashboard-stats/')
      .then((res) => setStats(res.data))
      .catch(() => setStats({}))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e2a3b', mb: 0.5 }}>
        Welcome to OrthoMynd
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        Select a module from the sidebar to get started.
      </Typography>

      <Box sx={{ display: 'flex', gap: 2.5, flexWrap: 'wrap' }}>
        <StatCard icon={<PeopleIcon />} value={stats?.total_users} label="Total Users" color="#1976d2" loading={loading} />
        <StatCard icon={<ApartmentIcon />} value={stats?.total_tenants} label="Total Tenants" color="#0891b2" loading={loading} />
        <StatCard icon={<SecurityIcon />} value={stats?.total_roles} label="Total Roles" color="#7c3aed" loading={loading} />
        <StatCard icon={<MedicalServicesIcon />} value={stats?.total_practitioners} label="Practitioners" color="#059669" loading={loading} />
      </Box>
    </Box>
  )
}
