import { Box, Button, Card, CardContent, Divider, Tooltip, Typography } from '@mui/material'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import BadgeIcon from '@mui/icons-material/Badge'
import SecurityIcon from '@mui/icons-material/Security'
import AssessmentIcon from '@mui/icons-material/Assessment'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import { timeAgo } from '../../utils/timeAgo'

const ACTIONS = [
  {
    label: '+ Add Patient',
    icon: <PersonAddIcon sx={{ fontSize: 16 }} />,
    permission: 'Patient:Create',
    path: '/patients',
    color: '#F97316',
    tooltip: 'Register a new patient',
  },
  {
    label: '+ Add Staff',
    icon: <BadgeIcon sx={{ fontSize: 16 }} />,
    permission: 'Administration:UserCreate',
    path: '/administration/users',
    color: 'primary',
    tooltip: 'Create a new staff member',
  },
  {
    label: '+ Add Role',
    icon: <SecurityIcon sx={{ fontSize: 16 }} />,
    permission: 'Administration:RoleCreate',
    path: '/administration/roles',
    color: 'primary',
    tooltip: 'Create a new role',
  },
]

export default function QuickActions({ hasPermission, activities = [] }) {
  const navigate = useNavigate()
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  return (
    <Card>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Typography sx={{ fontSize: 15, fontWeight: 600, color: 'text.primary', mb: 1.5 }}>
          Quick Actions
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
          {ACTIONS.map((action) => {
            if (!hasPermission(action.permission)) return null
            const isOrange = action.color === '#F97316'
            return (
              <Tooltip key={action.label} title={action.tooltip} placement="top">
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={action.icon}
                  onClick={() => navigate(action.path)}
                  sx={{
                    justifyContent: 'flex-start',
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 2,
                    py: '10px',
                    ...(isOrange && {
                      color: '#F97316',
                      borderColor: '#F97316',
                      '&:hover': {
                        bgcolor: isDark ? 'rgba(249,115,22,0.08)' : '#FFF7ED',
                        borderColor: '#F97316',
                      },
                    }),
                  }}
                >
                  {action.label}
                </Button>
              </Tooltip>
            )
          })}

          <Tooltip title="Coming soon" placement="top">
            <span style={{ display: 'block' }}>
              <Button
                variant="outlined"
                fullWidth
                disabled
                startIcon={<AssessmentIcon sx={{ fontSize: 16 }} />}
                sx={{ justifyContent: 'flex-start', fontSize: 12, fontWeight: 600, borderRadius: 2, py: '10px' }}
              >
                View Reports
              </Button>
            </span>
          </Tooltip>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary', mb: 1.25 }}>
          Recent Notifications
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          {activities.slice(0, 3).map((item, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  mt: 0.5,
                  flexShrink: 0,
                  bgcolor: item.type === 'user_created' ? '#3B82F6' : '#10B981',
                }}
              />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 12, color: 'text.primary', lineHeight: 1.4, wordBreak: 'break-word' }}>
                  {item.description}
                </Typography>
                <Typography sx={{ fontSize: 11, color: '#9CA3AF' }}>
                  {timeAgo(item.time)}
                </Typography>
              </Box>
            </Box>
          ))}
          {activities.length === 0 && (
            <Typography sx={{ fontSize: 12, color: 'text.secondary', textAlign: 'center', py: 1 }}>
              No notifications
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  )
}
