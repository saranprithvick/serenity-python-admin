import {
  AppBar,
  Box,
  Button,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from '@mui/material'
import DashboardIcon from '@mui/icons-material/Dashboard'
import PeopleIcon from '@mui/icons-material/People'
import SecurityIcon from '@mui/icons-material/Security'
import LockIcon from '@mui/icons-material/Lock'
import MedicalServicesIcon from '@mui/icons-material/MedicalServices'
import LogoutIcon from '@mui/icons-material/Logout'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const DRAWER_WIDTH = 240

const NAV_SECTIONS = [
  {
    title: 'MAIN',
    items: [{ label: 'Dashboard', icon: <DashboardIcon fontSize="small" />, to: '/dashboard' }],
  },
  {
    title: 'ADMINISTRATION',
    items: [
      { label: 'Users', icon: <PeopleIcon fontSize="small" />, to: '/administration/users' },
      { label: 'Roles', icon: <SecurityIcon fontSize="small" />, to: '/administration/roles' },
      { label: 'Permissions', icon: <LockIcon fontSize="small" />, to: '/administration/permissions' },
    ],
  },
  {
    title: 'MODULES',
    items: [{ label: 'Practitioners', icon: <MedicalServicesIcon fontSize="small" />, to: '/practitioners' }],
  },
]

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/administration/users': 'User Management',
  '/administration/roles': 'Role Management',
  '/administration/permissions': 'Permissions',
  '/practitioners': 'Practitioners',
}

export default function AppLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const pageTitle = PAGE_TITLES[location.pathname] ?? 'Orthomynd'

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            bgcolor: '#0e1625',
            color: '#94a3b8',
            border: 'none',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        {/* Brand */}
        <Toolbar sx={{ px: 2.5, minHeight: '64px !important' }}>
          <Typography
            sx={{
              color: 'primary.main',
              fontWeight: 700,
              fontSize: '1.1rem',
              letterSpacing: '-0.2px',
            }}
          >
            ◈ Orthomynd
          </Typography>
        </Toolbar>

        {/* Nav */}
        <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, pb: 1 }}>
          {NAV_SECTIONS.map((section) => (
            <Box key={section.title} sx={{ mb: 0.5 }}>
              <Typography
                sx={{
                  display: 'block',
                  px: 1.5,
                  pt: 2,
                  pb: 0.75,
                  fontSize: '0.625rem',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  color: '#3d5166',
                  textTransform: 'uppercase',
                }}
              >
                {section.title}
              </Typography>
              <List disablePadding>
                {section.items.map((item) => {
                  const active = location.pathname === item.to
                  return (
                    <ListItem key={item.to} disablePadding sx={{ mb: 0.25 }}>
                      <ListItemButton
                        component={NavLink}
                        to={item.to}
                        sx={{
                          borderRadius: '8px',
                          px: 1.5,
                          py: 0.875,
                          color: active ? '#fff' : '#94a3b8',
                          bgcolor: active ? 'primary.main' : 'transparent',
                          '&:hover': {
                            bgcolor: active ? 'primary.dark' : 'rgba(255,255,255,0.07)',
                            color: '#fff',
                          },
                          transition: 'background-color 150ms, color 150ms',
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 34, color: 'inherit' }}>
                          {item.icon}
                        </ListItemIcon>
                        <ListItemText
                          primary={item.label}
                          slotProps={{
                            primary: {
                              sx: {
                                fontSize: '0.875rem',
                                fontWeight: active ? 600 : 400,
                              },
                            },
                          }}
                        />
                      </ListItemButton>
                    </ListItem>
                  )
                })}
              </List>
            </Box>
          ))}
        </Box>

        {/* Current user footer */}
        <Box
          sx={{
            px: 2.5,
            py: 1.75,
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <Typography
            sx={{ fontSize: '0.72rem', color: '#3d5166', display: 'block', lineHeight: 1.4 }}
          >
            Signed in as
          </Typography>
          <Typography
            sx={{
              fontSize: '0.78rem',
              color: '#64748b',
              display: 'block',
              mt: 0.25,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {user?.email}
          </Typography>
        </Box>
      </Drawer>

      {/* ── Main area ──────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        {/* AppBar */}
        <AppBar
          position="static"
          elevation={0}
          sx={{
            bgcolor: '#fff',
            color: 'text.primary',
            borderBottom: '1px solid #e2e8f0',
            zIndex: 1,
          }}
        >
          <Toolbar sx={{ justifyContent: 'space-between', minHeight: '64px !important' }}>
            <Typography
              variant="subtitle1"
              sx={{ fontWeight: 600, color: '#1e2a3b', fontSize: '0.95rem' }}
            >
              {pageTitle}
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography variant="body2" sx={{ color: '#64748b', fontSize: '0.85rem' }}>
                {user?.username || user?.email}
              </Typography>
              <Button
                size="small"
                startIcon={<LogoutIcon sx={{ fontSize: '1rem !important' }} />}
                onClick={logout}
                sx={{
                  color: '#64748b',
                  fontSize: '0.8rem',
                  textTransform: 'none',
                  '&:hover': { color: 'error.main', bgcolor: 'transparent' },
                }}
              >
                Logout
              </Button>
            </Box>
          </Toolbar>
        </AppBar>

        {/* Page content */}
        <Box component="main" sx={{ flex: 1, p: 3, bgcolor: 'background.default' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}
