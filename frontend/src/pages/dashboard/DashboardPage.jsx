import { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import PeopleIcon from '@mui/icons-material/People'
import BusinessIcon from '@mui/icons-material/Business'
import SecurityIcon from '@mui/icons-material/Security'
import LocalHospitalIcon from '@mui/icons-material/LocalHospital'
import MedicalServicesIcon from '@mui/icons-material/MedicalServices'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import AssessmentIcon from '@mui/icons-material/Assessment'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Label,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../api/axios'

const DONUT_COLORS = ['#F97316', '#3B82F6', '#8B5CF6', '#10B981', '#EF4444']

const KPI_META = [
  { key: 'total_users',         label: 'Total Users',   icon: <PeopleIcon sx={{ fontSize: 20 }} />,       color: '#3B82F6', trend: '+12.5%', up: true },
  { key: 'total_tenants',       label: 'Total Tenants', icon: <BusinessIcon sx={{ fontSize: 20 }} />,      color: '#8B5CF6', trend: '+0.0%',  up: true },
  { key: 'total_roles',         label: 'Total Roles',   icon: <SecurityIcon sx={{ fontSize: 20 }} />,      color: '#F97316', trend: '+4.2%',  up: true },
  { key: 'total_practitioners', label: 'Practitioners', icon: <LocalHospitalIcon sx={{ fontSize: 20 }} />, color: '#10B981', trend: '+8.3%',  up: true },
]

function KpiCard({ icon, color, value, label, trend, up, loading }) {
  return (
    <Card sx={{ flex: 1, minWidth: 160 }}>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box
            sx={{
              width: 40, height: 40, borderRadius: '50%',
              bgcolor: `${color}18`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color,
            }}
          >
            {icon}
          </Box>
          <IconButton size="small" sx={{ color: 'text.disabled', p: 0.25, mt: -0.5, mr: -0.5 }}>
            <MoreHorizIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
        {loading ? (
          <>
            <Skeleton width={64} height={44} />
            <Skeleton width={100} height={18} />
            <Skeleton width={80} height={16} sx={{ mt: 0.5 }} />
          </>
        ) : (
          <>
            <Typography sx={{ fontSize: 32, fontWeight: 700, color: 'text.primary', lineHeight: 1.1, mb: 0.5 }}>
              {value ?? '—'}
            </Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 0.75 }}>{label}</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <TrendingUpIcon
                sx={{
                  fontSize: 14,
                  color: up ? '#10B981' : '#EF4444',
                  transform: up ? 'none' : 'scaleY(-1)',
                }}
              />
              <Typography sx={{ fontSize: 12, fontWeight: 500, color: up ? '#10B981' : '#EF4444' }}>
                {trend} vs last week
              </Typography>
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function SectionCard({ title, action, children }) {
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ px: 2.5, pt: 2.5, pb: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 600, color: 'text.primary' }}>{title}</Typography>
        {action}
      </Box>
      <Box sx={{ flex: 1, overflow: 'hidden' }}>{children}</Box>
    </Card>
  )
}

const CustomChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <Box sx={{
      bgcolor: 'background.paper',
      border: '1px solid',
      borderColor: 'divider',
      borderRadius: 2,
      px: 1.5, py: 1,
      boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
    }}>
      <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.primary' }}>{label}</Typography>
      <Typography sx={{ fontSize: 12, color: '#F97316' }}>{payload[0].value} registrations</Typography>
    </Box>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const [stats, setStats] = useState(null)
  const [chartData, setChartData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('month')

  useEffect(() => {
    Promise.all([
      api.get('/api/auth/dashboard-stats/'),
      api.get('/api/auth/dashboard-chart-data/'),
    ])
      .then(([statsRes, chartRes]) => {
        setStats(statsRes.data)
        setChartData(chartRes.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const firstName = user?.first_name || user?.username || user?.email?.split('@')[0] || 'there'
  const tenantLabel = user?.is_superuser
    ? 'across all tenants'
    : `at ${chartData?.tenant_name || 'your clinic'}`

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const specData = chartData?.practitioners_by_specialisation ?? []
  const specTotal = specData.reduce((s, d) => s + d.value, 0)

  const gridColor   = theme.palette.divider
  const tickColor   = theme.palette.text.secondary
  const paperColor  = theme.palette.background.paper
  const actIconBgPractitioner = isDark ? 'rgba(249,115,22,0.15)' : '#FFF7ED'
  const actIconBgUser         = isDark ? 'rgba(59,130,246,0.15)'  : '#EFF6FF'

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

      {/* ── Row 1: Welcome header ───────────────────────────────── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography sx={{ fontSize: 24, fontWeight: 700, color: 'text.primary', lineHeight: 1.3 }}>
            Welcome back, {firstName}! 👋
          </Typography>
          <Typography sx={{ fontSize: 14, color: 'text.secondary', mt: 0.5 }}>
            Here&apos;s what&apos;s happening {tenantLabel} today.
          </Typography>
        </Box>
        <Box
          sx={{
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            px: 2, py: 1,
            display: 'flex', alignItems: 'center', gap: 1,
          }}
        >
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{today}</Typography>
        </Box>
      </Box>

      {/* ── Row 2: KPI cards ────────────────────────────────────── */}
      <Box sx={{ display: 'flex', gap: 2.5, flexWrap: 'wrap' }}>
        {KPI_META.map((m) => (
          <KpiCard
            key={m.key}
            icon={m.icon}
            color={m.color}
            value={stats?.[m.key]}
            label={m.label}
            trend={m.trend}
            up={m.up}
            loading={loading}
          />
        ))}
      </Box>

      {/* ── Row 3: Charts ───────────────────────────────────────── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 2.5 }}>

        {/* Line / Area chart */}
        <Card>
          <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
              <Box>
                <Typography sx={{ fontSize: 15, fontWeight: 600, color: 'text.primary' }}>
                  Practitioner Registrations
                </Typography>
                <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.25 }}>
                  Monthly activity for {new Date().getFullYear()}
                </Typography>
              </Box>
              <Select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                size="small"
                sx={{ fontSize: 13, '& .MuiSelect-select': { py: 0.75, pr: '28px !important' } }}
              >
                <MenuItem value="week" sx={{ fontSize: 13 }}>This Week</MenuItem>
                <MenuItem value="month" sx={{ fontSize: 13 }}>This Month</MenuItem>
                <MenuItem value="year" sx={{ fontSize: 13 }}>This Year</MenuItem>
              </Select>
            </Box>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart
                data={chartData?.monthly_registrations ?? []}
                margin={{ top: 5, right: 8, bottom: 0, left: -20 }}
              >
                <defs>
                  <linearGradient id="regGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F97316" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: tickColor }}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: tickColor }}
                  width={28}
                />
                <ChartTooltip content={<CustomChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#F97316"
                  strokeWidth={2}
                  fill="url(#regGradient)"
                  dot={{ fill: '#F97316', r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Donut chart */}
        <Card>
          <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
            <Typography sx={{ fontSize: 15, fontWeight: 600, color: 'text.primary', mb: 0.25 }}>
              By Specialisation
            </Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1 }}>
              Practitioners breakdown
            </Typography>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', pt: 3 }}>
                <Skeleton variant="circular" width={140} height={140} />
              </Box>
            ) : specData.length === 0 ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160 }}>
                <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>No data</Typography>
              </Box>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie
                      data={specData}
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={72}
                      dataKey="value"
                      paddingAngle={3}
                    >
                      {specData.map((entry, i) => (
                        <Cell key={entry.name} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                      ))}
                      <Label
                        content={({ viewBox }) => {
                          const { cx, cy } = viewBox
                          return (
                            <g>
                              <text
                                x={cx} y={cy - 5}
                                textAnchor="middle"
                                style={{ fontSize: 24, fontWeight: 700, fill: theme.palette.text.primary }}
                              >
                                {specTotal}
                              </text>
                              <text
                                x={cx} y={cy + 14}
                                textAnchor="middle"
                                style={{ fontSize: 11, fill: theme.palette.text.secondary }}
                              >
                                Total
                              </text>
                            </g>
                          )
                        }}
                      />
                    </Pie>
                    <ChartTooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: `1px solid ${gridColor}`,
                        background: paperColor,
                        fontSize: 12,
                      }}
                      formatter={(value, name) => [value, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* Custom legend — outside recharts so it never gets clipped */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mt: 1.5 }}>
                  {specData.map((entry, i) => (
                    <Box key={entry.name} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box
                        sx={{
                          width: 8, height: 8, borderRadius: '50%',
                          bgcolor: DONUT_COLORS[i % DONUT_COLORS.length],
                          flexShrink: 0,
                        }}
                      />
                      <Typography sx={{ fontSize: 11, color: 'text.secondary', flex: 1, lineHeight: 1.3 }}>
                        {entry.name}
                      </Typography>
                      <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.primary' }}>
                        {entry.value}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </>
            )}
          </CardContent>
        </Card>
      </Box>

      {/* ── Row 4: Bottom section ───────────────────────────────── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '5fr 4fr 3fr', gap: 2.5 }}>

        {/* Recent Practitioners table */}
        <SectionCard
          title="Recent Practitioners"
          action={
            <Typography
              component={Link}
              to="/practitioners"
              sx={{ fontSize: 13, color: '#F97316', textDecoration: 'none', fontWeight: 500, '&:hover': { textDecoration: 'underline' } }}
            >
              View all
            </Typography>
          }
        >
          {loading ? (
            <Box sx={{ px: 2.5, pb: 2 }}>
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} height={44} sx={{ mb: 0.5 }} />)}
            </Box>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow
                  sx={{
                    '& th': {
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'text.secondary',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      border: 'none',
                      bgcolor: 'background.default',
                      py: 1,
                    },
                  }}
                >
                  <TableCell>Name</TableCell>
                  <TableCell>Specialisation</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(chartData?.recent_practitioners ?? []).map((p) => (
                  <TableRow
                    key={p.id}
                    sx={{
                      '& td': { borderBottom: '1px solid', borderColor: 'divider', py: 1.25 },
                      '&:last-child td': { border: 'none' },
                    }}
                  >
                    <TableCell sx={{ fontSize: 13, fontWeight: 500, color: 'text.primary' }}>
                      {p.full_name}
                    </TableCell>
                    <TableCell sx={{ fontSize: 13, color: 'text.secondary' }}>
                      {p.specialisation || '—'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={p.is_active ? 'Active' : 'Inactive'}
                        size="small"
                        sx={{
                          height: 22,
                          fontSize: 11,
                          fontWeight: 600,
                          bgcolor: p.is_active ? '#D1FAE5' : '#FEE2E2',
                          color: p.is_active ? '#065F46' : '#B91C1C',
                          border: 'none',
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && (chartData?.recent_practitioners ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} sx={{ textAlign: 'center', color: 'text.secondary', fontSize: 13, py: 3 }}>
                      No practitioners yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </SectionCard>

        {/* Team Activity */}
        <SectionCard title="Recent Activity">
          {loading ? (
            <Box sx={{ px: 2.5, pb: 2 }}>
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} height={52} sx={{ mb: 0.5 }} />)}
            </Box>
          ) : (
            <List dense disablePadding sx={{ px: 1, pb: 1.5 }}>
              {(chartData?.recent_activity ?? []).map((item, i) => (
                <ListItem key={i} disablePadding sx={{ py: 0.75, alignItems: 'flex-start' }}>
                  <ListItemIcon sx={{ minWidth: 40, mt: 0.25 }}>
                    <Box
                      sx={{
                        width: 30, height: 30, borderRadius: '50%',
                        bgcolor: item.type === 'practitioner' ? actIconBgPractitioner : actIconBgUser,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {item.type === 'practitioner'
                        ? <MedicalServicesIcon sx={{ fontSize: 15, color: '#F97316' }} />
                        : <PersonAddIcon sx={{ fontSize: 15, color: '#3B82F6' }} />}
                    </Box>
                  </ListItemIcon>
                  <ListItemText
                    primary={item.action}
                    secondary={`${item.detail} · ${item.time}`}
                    slotProps={{
                      primary:   { sx: { fontSize: 13, fontWeight: 500, color: 'text.primary',   lineHeight: 1.4 } },
                      secondary: { sx: { fontSize: 12,                  color: 'text.secondary', lineHeight: 1.4 } },
                    }}
                  />
                </ListItem>
              ))}
              {!loading && (chartData?.recent_activity ?? []).length === 0 && (
                <Typography sx={{ fontSize: 13, color: 'text.secondary', textAlign: 'center', py: 3 }}>
                  No activity yet
                </Typography>
              )}
            </List>
          )}
        </SectionCard>

        {/* Quick Actions + Notifications */}
        <Card>
          <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
            <Typography sx={{ fontSize: 15, fontWeight: 600, color: 'text.primary', mb: 1.5 }}>
              Quick Actions
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              <Button
                variant="outlined"
                fullWidth
                startIcon={<MedicalServicesIcon sx={{ fontSize: 16 }} />}
                onClick={() => navigate('/practitioners')}
                sx={{ justifyContent: 'flex-start', fontSize: 13, color: '#F97316', borderColor: '#F97316', '&:hover': { bgcolor: isDark ? 'rgba(249,115,22,0.08)' : '#FFF7ED', borderColor: '#F97316' } }}
              >
                Add Practitioner
              </Button>
              <Button
                variant="outlined"
                fullWidth
                startIcon={<PersonAddIcon sx={{ fontSize: 16 }} />}
                onClick={() => navigate('/administration/users')}
                sx={{ justifyContent: 'flex-start', fontSize: 13 }}
              >
                Add User
              </Button>
              <Button
                variant="outlined"
                fullWidth
                startIcon={<SecurityIcon sx={{ fontSize: 16 }} />}
                onClick={() => navigate('/administration/roles')}
                sx={{ justifyContent: 'flex-start', fontSize: 13 }}
              >
                Add Role
              </Button>
              <Tooltip title="Coming soon" placement="top">
                <span style={{ display: 'block' }}>
                  <Button
                    variant="outlined"
                    fullWidth
                    disabled
                    startIcon={<AssessmentIcon sx={{ fontSize: 16 }} />}
                    sx={{ justifyContent: 'flex-start', fontSize: 13 }}
                  >
                    View Reports
                  </Button>
                </span>
              </Tooltip>
            </Box>

            {/* Recent Notifications */}
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary', mt: 2.5, mb: 1.25 }}>
              Recent Notifications
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {loading
                ? [1, 2, 3].map((i) => <Skeleton key={i} height={36} />)
                : (chartData?.recent_activity ?? []).slice(0, 3).map((item, i) => (
                    <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
                      <Box
                        sx={{
                          width: 8, height: 8, borderRadius: '50%', mt: 0.6, flexShrink: 0,
                          bgcolor: item.type === 'practitioner' ? '#F97316' : '#3B82F6',
                        }}
                      />
                      <Box>
                        <Typography sx={{ fontSize: 12, color: 'text.primary', lineHeight: 1.4 }}>
                          {item.action}: {item.detail}
                        </Typography>
                        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{item.time}</Typography>
                      </Box>
                    </Box>
                  ))}
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  )
}
