import { useEffect, useState } from 'react'
import { Box, Card, CardContent, Typography } from '@mui/material'
import PeopleIcon from '@mui/icons-material/People'
import SecurityIcon from '@mui/icons-material/Security'
import LockIcon from '@mui/icons-material/Lock'
import api from '../../api/axios'

function StatCard({ icon, value, label, color }) {
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
        </Box>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState({ users: null, roles: null })

  useEffect(() => {
    const loadStats = async () => {
      try {
        const [usersRes, rolesRes] = await Promise.all([
          api.get('/api/auth/users/'),
          api.get('/api/administration/roles/'),
        ])
        setStats({ users: usersRes.data.count, roles: rolesRes.data.count })
      } catch {
        // Stats remain null; the — placeholder shows
      }
    }
    loadStats()
  }, [])

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e2a3b', mb: 0.5 }}>
        Welcome to Prism
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        Select a module from the sidebar to get started.
      </Typography>

      <Box sx={{ display: 'flex', gap: 2.5, flexWrap: 'wrap' }}>
        <StatCard icon={<PeopleIcon />} value={stats.users} label="Total Users" color="#1976d2" />
        <StatCard icon={<SecurityIcon />} value={stats.roles} label="Total Roles" color="#7c3aed" />
        <StatCard icon={<LockIcon />} value={12} label="Permissions" color="#0891b2" />
      </Box>
    </Box>
  )
}
