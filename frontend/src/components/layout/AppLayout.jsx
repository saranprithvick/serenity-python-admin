import { useEffect, useState } from 'react'
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  Divider,
  Drawer,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Popover,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import DashboardIcon from '@mui/icons-material/Dashboard'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import LockIcon from '@mui/icons-material/Lock'
import LogoutIcon from '@mui/icons-material/Logout'
import MedicalServicesIcon from '@mui/icons-material/MedicalServices'
import MenuIcon from '@mui/icons-material/Menu'
import NotificationsIcon from '@mui/icons-material/Notifications'
import PeopleIcon from '@mui/icons-material/People'
import SearchIcon from '@mui/icons-material/Search'
import SecurityIcon from '@mui/icons-material/Security'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useColorMode } from '../../theme'
import api from '../../api/axios'

const SIDEBAR_EXPANDED  = 260
const SIDEBAR_COLLAPSED = 68
const ACCENT        = '#F97316'
const ACTIVE_BG     = 'rgba(249,115,22,0.15)'
const INACTIVE_TEXT = 'rgba(255,255,255,0.7)'
const SECTION_TEXT  = 'rgba(255,255,255,0.4)'
const SIDEBAR_DIVIDER = 'rgba(255,255,255,0.1)'

const NAV_SECTIONS = [
  {
    title: 'MAIN',
    items: [{ label: 'Dashboard', icon: <DashboardIcon sx={{ fontSize: 20 }} />, to: '/dashboard' }],
  },
  {
    title: 'ADMINISTRATION',
    items: [
      { label: 'Staff',       icon: <PeopleIcon sx={{ fontSize: 20 }} />,          to: '/administration/users' },
      { label: 'Roles',       icon: <SecurityIcon sx={{ fontSize: 20 }} />,         to: '/administration/roles' },
      { label: 'Permissions', icon: <LockIcon sx={{ fontSize: 20 }} />,             to: '/administration/permissions' },
    ],
  },
  {
    title: 'MODULES',
    items: [{ label: 'Patients', icon: <MedicalServicesIcon sx={{ fontSize: 20 }} />, to: '/patients' }],
  },
]

const PAGE_TITLES = {
  '/dashboard':                   'Dashboard',
  '/administration/users':        'Staff Management',
  '/administration/roles':        'Role Management',
  '/administration/permissions':  'Permissions',
  '/patients':                    'Patient Management',
}

const STATIC_NOTIFS = [
  { text: 'New practitioner added', time: '2m ago' },
  { text: 'testuser1 logged in',    time: '15m ago' },
  { text: 'Role updated',           time: '1h ago' },
]

function getInitials(user) {
  if (!user) return '?'
  if (user.first_name && user.last_name) return (user.first_name[0] + user.last_name[0]).toUpperCase()
  if (user.first_name) return user.first_name[0].toUpperCase()
  if (user.username)   return user.username[0].toUpperCase()
  if (user.email)      return user.email[0].toUpperCase()
  return '?'
}

export default function AppLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const pageTitle = PAGE_TITLES[location.pathname] ?? 'OrthoMed'
  const { toggleColorMode, mode } = useColorMode()
  const theme = useTheme()

  const isDesktop = useMediaQuery('(min-width:1200px)')
  const isTablet  = useMediaQuery('(min-width:768px)')

  const [searchFocused, setSearchFocused] = useState(false)
  const [notifAnchor,   setNotifAnchor]   = useState(null)
  const [avatarAnchor,  setAvatarAnchor]  = useState(null)
  const [tenantName,    setTenantName]    = useState(null)
  const [mobileOpen,    setMobileOpen]    = useState(false)
  const [sidebarOpen,   setSidebarOpen]   = useState(() => {
    try {
      const stored = localStorage.getItem('orthomed_sidebar_open')
      return stored !== null ? stored === 'true' : true
    } catch {
      return true
    }
  })

  const toggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev
      try { localStorage.setItem('orthomed_sidebar_open', String(next)) } catch {}
      return next
    })
  }

  const showLabels = !isDesktop || sidebarOpen
  const drawerWidth = isDesktop
    ? (sidebarOpen ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED)
    : SIDEBAR_EXPANDED

  useEffect(() => {
    if (user && !user.is_superuser) {
      api.get('/api/practitioners/auth/dashboard-chart-data/')
        .then((res) => setTenantName(res.data.tenant_name))
        .catch(() => {})
    }
  }, [user?.id])

  const isDark = mode === 'dark'
  const sidebarBg         = isDark ? '#0F172A'                : '#1A202C'
  const appbarBg          = theme.palette.background.paper
  const appbarBorderColor = theme.palette.divider
  const appbarTextColor   = theme.palette.text.primary
  const searchBg          = isDark ? '#253347'                : '#F8FAFC'
  const searchBorder      = isDark ? 'rgba(255,255,255,0.12)' : '#E2E8F0'
  const searchBorderHover = isDark ? 'rgba(255,255,255,0.22)' : '#D1D9E0'
  const iconColor         = theme.palette.text.secondary
  const kmChipBg          = isDark ? 'rgba(255,255,255,0.1)'  : '#E2E8F0'

  const tenantLabel = user?.is_superuser ? 'Platform Admin' : (tenantName || '')

  // ── Sidebar content ─────────────────────────────────────────────────────────
  const sidebarContent = (
    <>
      {/* Logo + collapse button */}
      <Box
        sx={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          px: showLabels ? 2.5 : 1,
          justifyContent: 'space-between',
          borderBottom: `1px solid ${SIDEBAR_DIVIDER}`,
          flexShrink: 0,
          overflow: 'hidden',
          background: 'linear-gradient(180deg, #1E2733 0%, #1A202C 100%)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, overflow: 'hidden', minWidth: 0 }}>
          <Box component="span" sx={{ color: ACCENT, fontSize: 20, fontWeight: 700, flexShrink: 0, lineHeight: 1 }}>
            ◈
          </Box>
          {showLabels && (
            <Typography
              sx={{
                color: '#fff',
                fontWeight: 700,
                fontSize: 20,
                letterSpacing: '-0.3px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              OrthoMed
            </Typography>
          )}
        </Box>

        {/* Collapse toggle — desktop only */}
        {isDesktop && (
          <IconButton
            size="small"
            onClick={toggleSidebar}
            sx={{
              bgcolor: 'rgba(255,255,255,0.1)',
              color: '#fff',
              width: 28,
              height: 28,
              flexShrink: 0,
              ml: 1,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.18)' },
            }}
          >
            {sidebarOpen
              ? <ChevronLeftIcon  sx={{ fontSize: 18 }} />
              : <ChevronRightIcon sx={{ fontSize: 18 }} />
            }
          </IconButton>
        )}
      </Box>

      {/* Nav sections */}
      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', py: 1 }}>
        {NAV_SECTIONS.map((section) => (
          <Box key={section.title}>
            {showLabels ? (
              <Typography
                sx={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: SECTION_TEXT,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  pl: 2,
                  mt: 3.5,
                  mb: 1.25,
                  display: 'block',
                }}
              >
                {section.title}
              </Typography>
            ) : (
              <Box sx={{ height: 20 }} />
            )}

            <List disablePadding>
              {section.items.map((item) => {
                const active = location.pathname === item.to
                return (
                  <ListItem
                    key={item.to}
                    disablePadding
                    sx={{ mx: showLabels ? 1 : 0, mb: 0.25, width: 'auto' }}
                  >
                    <Tooltip
                      title={!showLabels ? item.label : ''}
                      placement="right"
                      arrow
                    >
                      <ListItemButton
                        component={NavLink}
                        to={item.to}
                        onClick={() => !isDesktop && setMobileOpen(false)}
                        sx={{
                          borderRadius: (active && showLabels) ? '0 8px 8px 0' : '8px',
                          px: showLabels ? 2 : 0,
                          py: 1.25,
                          justifyContent: showLabels ? 'flex-start' : 'center',
                          color: active ? '#fff' : INACTIVE_TEXT,
                          bgcolor: active ? ACTIVE_BG : 'transparent',
                          borderLeft: (active && showLabels) ? `3px solid ${ACCENT}` : '3px solid transparent',
                          gap: showLabels ? 1.5 : 0,
                          minHeight: 44,
                          '&:hover': {
                            bgcolor: active ? ACTIVE_BG : 'rgba(249,115,22,0.06)',
                            color: '#fff',
                          },
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 0, color: 'inherit', justifyContent: 'center' }}>
                          {item.icon}
                        </ListItemIcon>
                        {showLabels && (
                          <ListItemText
                            primary={item.label}
                            slotProps={{
                              primary: {
                                sx: { fontSize: '0.875rem', fontWeight: active ? 600 : 400, lineHeight: 1.4 },
                              },
                            }}
                          />
                        )}
                      </ListItemButton>
                    </Tooltip>
                  </ListItem>
                )
              })}
            </List>
          </Box>
        ))}
      </Box>

      {/* User footer */}
      <Box
        sx={{
          px: showLabels ? 2 : 0,
          py: 2,
          borderTop: `1px solid ${SIDEBAR_DIVIDER}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: showLabels ? 'flex-start' : 'center',
          gap: showLabels ? 1.5 : 0,
          flexShrink: 0,
        }}
      >
        <Avatar sx={{ width: 36, height: 36, bgcolor: ACCENT, fontSize: 15, fontWeight: 700, flexShrink: 0 }}>
          {getInitials(user)}
        </Avatar>
        {showLabels && (
          <Box sx={{ minWidth: 0 }}>
            <Typography
              sx={{
                fontSize: 13,
                color: '#fff',
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                lineHeight: 1.4,
              }}
            >
              {user?.email}
            </Typography>
            {tenantLabel && (
              <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', display: 'block', lineHeight: 1.4 }}>
                {tenantLabel}
              </Typography>
            )}
          </Box>
        )}
      </Box>
    </>
  )

  // ── Drawer paper sx shared between permanent and temporary ──────────────────
  const paperSx = {
    bgcolor: sidebarBg,
    color: '#fff',
    border: 'none',
    display: 'flex',
    flexDirection: 'column',
    overflowX: 'hidden',
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>

      {/* ── Desktop: permanent collapsible sidebar ───────────────────────── */}
      {isDesktop && (
        <Drawer
          variant="permanent"
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            transition: 'width 0.2s ease',
            '& .MuiDrawer-paper': {
              ...paperSx,
              width: drawerWidth,
              boxSizing: 'border-box',
              transition: 'width 0.2s ease',
            },
          }}
        >
          {sidebarContent}
        </Drawer>
      )}

      {/* ── Tablet / Mobile: temporary overlay sidebar ───────────────────── */}
      {!isDesktop && (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              ...paperSx,
              width: SIDEBAR_EXPANDED,
              boxSizing: 'border-box',
            },
          }}
        >
          {sidebarContent}
        </Drawer>
      )}

      {/* ── Main area ────────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>

        {/* AppBar */}
        <AppBar
          position="static"
          elevation={0}
          sx={{
            bgcolor: appbarBg,
            color: appbarTextColor,
            borderBottom: `1px solid ${appbarBorderColor}`,
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            zIndex: 1,
          }}
        >
          <Toolbar sx={{ gap: 2, minHeight: '64px !important', px: isTablet ? 3 : 2 }}>

            {/* Hamburger — tablet / mobile */}
            {!isDesktop && (
              <IconButton
                size="small"
                onClick={() => setMobileOpen(true)}
                edge="start"
                sx={{ color: iconColor, mr: 0.5, flexShrink: 0 }}
              >
                <MenuIcon />
              </IconButton>
            )}

            {/* Page title */}
            <Typography
              sx={{
                fontWeight: 600,
                fontSize: isTablet ? 18 : 16,
                color: appbarTextColor,
                letterSpacing: '-0.2px',
                flexShrink: 0,
                minWidth: isTablet ? 160 : 'auto',
              }}
            >
              {pageTitle}
            </Typography>

            {/* Search bar — hidden on mobile */}
            <Box sx={{ flex: 1, display: isTablet ? 'flex' : 'none', justifyContent: 'center' }}>
              <TextField
                placeholder="Search patients, staff..."
                size="small"
                sx={{
                  width: 320,
                  '& .MuiOutlinedInput-root': {
                    bgcolor: searchBg,
                    borderRadius: '24px',
                    fontSize: 13,
                    '& fieldset': {
                      borderColor: searchFocused ? ACCENT : searchBorder,
                      transition: 'border-color 150ms',
                    },
                    '&:hover fieldset': {
                      borderColor: searchFocused ? ACCENT : searchBorderHover,
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: ACCENT,
                      borderWidth: 1,
                    },
                  },
                  '& .MuiInputBase-input': {
                    color: appbarTextColor,
                    '&::placeholder': { color: '#718096', opacity: 1 },
                  },
                }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ fontSize: 18, color: '#718096' }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <Box
                          sx={{
                            bgcolor: kmChipBg,
                            borderRadius: 1,
                            px: 0.75,
                            py: 0.2,
                            fontSize: 11,
                            fontFamily: 'monospace',
                            color: '#718096',
                            lineHeight: 1.6,
                            userSelect: 'none',
                          }}
                        >
                          ⌘K
                        </Box>
                      </InputAdornment>
                    ),
                  },
                }}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
              />
            </Box>

            {/* Mobile: flex spacer */}
            {!isTablet && <Box sx={{ flex: 1 }} />}

            {/* Right: action icons */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>

              {/* Notification bell */}
              <Tooltip title="Notifications">
                <IconButton
                  size="small"
                  onClick={(e) => setNotifAnchor(e.currentTarget)}
                  sx={{
                    color: iconColor,
                    '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', borderRadius: '50%' },
                  }}
                >
                  <Badge
                    badgeContent={3}
                    sx={{
                      '& .MuiBadge-badge': {
                        bgcolor: ACCENT,
                        color: '#fff',
                        fontSize: 10,
                        minWidth: 16,
                        height: 16,
                        padding: '0 4px',
                      },
                    }}
                  >
                    <NotificationsIcon sx={{ fontSize: 22 }} />
                  </Badge>
                </IconButton>
              </Tooltip>

              {/* Theme toggle */}
              <Tooltip title={isDark ? 'Light mode' : 'Dark mode'}>
                <IconButton
                  size="small"
                  onClick={toggleColorMode}
                  sx={{ color: iconColor }}
                >
                  {isDark
                    ? <LightModeIcon sx={{ fontSize: 20 }} />
                    : <DarkModeIcon  sx={{ fontSize: 20 }} />}
                </IconButton>
              </Tooltip>

              {/* User avatar */}
              <Tooltip title="Account">
                <Avatar
                  onClick={(e) => setAvatarAnchor(e.currentTarget)}
                  sx={{
                    width: 36,
                    height: 36,
                    bgcolor: ACCENT,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    ml: 0.5,
                    transition: 'box-shadow 0.2s ease',
                    '&:hover': { boxShadow: '0 0 0 2px #F97316, 0 0 0 4px rgba(249,115,22,0.2)' },
                  }}
                >
                  {getInitials(user)}
                </Avatar>
              </Tooltip>
            </Box>
          </Toolbar>
        </AppBar>

        {/* Page content */}
        <Box
          component="main"
          sx={{ flex: 1, p: { xs: 2, sm: 3 }, bgcolor: 'background.default' }}
        >
          <Outlet />
        </Box>
      </Box>

      {/* ── Notification Popover ─────────────────────────────────────────── */}
      <Popover
        open={Boolean(notifAnchor)}
        anchorEl={notifAnchor}
        onClose={() => setNotifAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          sx: {
            width: 320,
            borderRadius: 2,
            mt: 1,
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            overflow: 'hidden',
          },
        }}
      >
        <Box sx={{ px: 2, py: 1.75, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography sx={{ fontWeight: 600, fontSize: 14 }}>Notifications</Typography>
        </Box>

        <List disablePadding>
          {STATIC_NOTIFS.map((n, i) => (
            <ListItem
              key={i}
              sx={{
                px: 2,
                py: 1.25,
                borderBottom: i < STATIC_NOTIFS.length - 1 ? '1px solid' : 'none',
                borderColor: 'divider',
                alignItems: 'flex-start',
              }}
            >
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: ACCENT,
                  mt: 0.7,
                  mr: 1.5,
                  flexShrink: 0,
                }}
              />
              <Box>
                <Typography sx={{ fontSize: 13, fontWeight: 500 }}>{n.text}</Typography>
                <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.25 }}>{n.time}</Typography>
              </Box>
            </ListItem>
          ))}
        </List>

        <Box sx={{ px: 2, py: 1.25, borderTop: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
          <Typography
            sx={{
              fontSize: 13,
              color: ACCENT,
              fontWeight: 500,
              cursor: 'pointer',
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            View all
          </Typography>
        </Box>
      </Popover>

      {/* ── Avatar dropdown menu ─────────────────────────────────────────── */}
      <Menu
        anchorEl={avatarAnchor}
        open={Boolean(avatarAnchor)}
        onClose={() => setAvatarAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          sx: {
            width: 220,
            borderRadius: 2,
            mt: 1,
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          },
        }}
      >
        <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
          <Typography
            sx={{
              fontSize: 13,
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {user?.email}
          </Typography>
          {tenantLabel && (
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.25 }}>
              {tenantLabel}
            </Typography>
          )}
        </Box>

        <Divider />

        <MenuItem
          onClick={() => { setAvatarAnchor(null); logout() }}
          sx={{ gap: 1.5, py: 1.25, color: 'error.main', fontSize: 14 }}
        >
          <LogoutIcon sx={{ fontSize: 18 }} />
          Logout
        </MenuItem>
      </Menu>

    </Box>
  )
}
