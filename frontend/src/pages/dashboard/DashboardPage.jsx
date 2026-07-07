import { useEffect, useState } from 'react'
import {
  Box,
  Card,
  CardContent,
  IconButton,
  Skeleton,
  Typography,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import PeopleIcon from '@mui/icons-material/People'
import BusinessIcon from '@mui/icons-material/Business'
import SecurityIcon from '@mui/icons-material/Security'
import LocalHospitalIcon from '@mui/icons-material/LocalHospital'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
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
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat'
import { useAuth } from '../../context/AuthContext'
import api from '../../api/axios'
import ActivityFeed from '../../components/dashboard/ActivityFeed'
import MiniCalendar from '../../components/dashboard/MiniCalendar'
import QuickActions from '../../components/dashboard/QuickActions'
import SparklineChart from '../../components/dashboard/SparklineChart'

const DONUT_COLORS = ['#F97316', '#3B82F6', '#8B5CF6', '#10B981', '#EF4444']

const ROLE_COLORS = {
  'Tenant Admin': '#F97316',
  'Doctor':       '#3B82F6',
  'Nurse':        '#10B981',
  'Caretaker':    '#8B5CF6',
}

const KPI_META = [
  { key: 'total_users',    label: 'Total Staff',    icon: <PeopleIcon sx={{ fontSize: 20 }} />,       color: '#3B82F6', trend: '+8.1%',  up: true, sparklineKey: 'users' },
  { key: 'total_tenants',  label: 'Total Tenants',  icon: <BusinessIcon sx={{ fontSize: 20 }} />,      color: '#8B5CF6', trend: '+0.0%',  up: true, sparklineKey: 'tenants' },
  { key: 'total_roles',    label: 'Total Roles',    icon: <SecurityIcon sx={{ fontSize: 20 }} />,      color: '#F97316', trend: '+0.0%',  up: true, sparklineKey: 'roles' },
  { key: 'total_patients', label: 'Total Patients', icon: <LocalHospitalIcon sx={{ fontSize: 20 }} />, color: '#10B981', trend: '+16.3%', up: true, sparklineKey: 'practitioners' },
]

function KpiCard({ icon, color, value, label, trend, up, loading, sparklineData }) {
  return (
    <Card sx={{ flex: 1, minWidth: 160, display: 'flex', flexDirection: 'column', borderTop: `3px solid ${color}` }}>
      <CardContent sx={{ p: 2.5, pb: '12px !important', flex: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box
              sx={{
                width: 40, height: 40, borderRadius: '50%',
                bgcolor: `${color}18`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color, flexShrink: 0,
              }}
            >
              {icon}
            </Box>
            <Typography sx={{ fontSize: 13, fontWeight: 500, color: 'text.secondary' }}>
              {label}
            </Typography>
          </Box>
          <IconButton size="small" sx={{ color: 'text.disabled', p: 0.25, mt: -0.5, mr: -0.5 }}>
            <MoreHorizIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
        {loading ? (
          <>
            <Skeleton width={64} height={44} />
            <Skeleton width={140} height={18} sx={{ mt: 0.5 }} />
          </>
        ) : (
          <>
            <Typography sx={{ fontSize: 36, fontWeight: 700, color: 'text.primary', lineHeight: 1.1, mb: 0.5 }}>
              {value ?? '—'}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {up === null ? (
                <TrendingFlatIcon sx={{ fontSize: 14, color: '#9CA3AF' }} />
              ) : (
                <TrendingUpIcon
                  sx={{
                    fontSize: 14,
                    color: up ? '#10B981' : '#EF4444',
                    transform: up ? 'none' : 'scaleY(-1)',
                  }}
                />
              )}
              <Typography sx={{ fontSize: 12, fontWeight: 500, color: up === null ? '#9CA3AF' : up ? '#10B981' : '#EF4444' }}>
                {trend} vs last week
              </Typography>
            </Box>
          </>
        )}
      </CardContent>
      {!loading && (
        <SparklineChart data={sparklineData ?? []} color={color} height={60} />
      )}
    </Card>
  )
}

function StaffRoleCard({ data, loading, sx }) {
  const total = data.reduce((s, r) => s + r.count, 0)
  return (
    <Card sx={sx}>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Typography sx={{ fontSize: 15, fontWeight: 600, color: 'text.primary', mb: 0.25 }}>
          Staff by Role
        </Typography>
        <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 2 }}>
          {total} members across {data.length} role{data.length !== 1 ? 's' : ''}
        </Typography>
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} height={28} sx={{ borderRadius: 1 }} />)}
          </Box>
        ) : data.length === 0 ? (
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>No staff data</Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {data.map(({ name, count }) => {
              const color = ROLE_COLORS[name] ?? '#6B7280'
              const pct = total > 0 ? (count / total) * 100 : 0
              return (
                <Box key={name}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
                      <Typography sx={{ fontSize: 13, color: 'text.primary', fontWeight: 500 }}>{name}</Typography>
                    </Box>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.primary' }}>{count}</Typography>
                  </Box>
                  <Box sx={{ height: 4, bgcolor: 'action.hover', borderRadius: 2, overflow: 'hidden' }}>
                    <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: color, borderRadius: 2, transition: 'width 0.6s ease' }} />
                  </Box>
                </Box>
              )
            })}
          </Box>
        )}
      </CardContent>
    </Card>
  )
}

function TopConditionsCard({ data, loading, sx }) {
  const top = data.slice(0, 4)
  const total = data.reduce((s, d) => s + d.value, 0)
  return (
    <Card sx={sx}>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Typography sx={{ fontSize: 15, fontWeight: 600, color: 'text.primary', mb: 0.25 }}>
          Top Conditions
        </Typography>
        <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 2 }}>
          Most common patient conditions
        </Typography>
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} height={28} sx={{ borderRadius: 1 }} />)}
          </Box>
        ) : top.length === 0 ? (
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>No patient data</Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {top.map((entry, i) => {
              const color = DONUT_COLORS[i % DONUT_COLORS.length]
              const pct = total > 0 ? (entry.value / total) * 100 : 0
              return (
                <Box key={entry.name}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
                      <Typography sx={{ fontSize: 12, color: 'text.primary', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {entry.name}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.primary', ml: 1, flexShrink: 0 }}>{entry.value}</Typography>
                  </Box>
                  <Box sx={{ height: 4, bgcolor: 'action.hover', borderRadius: 2, overflow: 'hidden' }}>
                    <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: color, borderRadius: 2, transition: 'width 0.6s ease' }} />
                  </Box>
                </Box>
              )
            })}
          </Box>
        )}
      </CardContent>
    </Card>
  )
}

const CustomAreaTooltip = ({ active, payload, label }) => {
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
  const { user, hasPermission } = useAuth()
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const [stats, setStats] = useState(null)
  const [chartData, setChartData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activities, setActivities] = useState([])
  const [activitiesLoading, setActivitiesLoading] = useState(true)
  const [period, setPeriod] = useState('month')
  const [staffByRole, setStaffByRole] = useState([])
  const [staffLoading, setStaffLoading] = useState(true)

  useEffect(() => {
    api.get('/api/practitioners/')
      .then((res) => {
        const list = res.data.results ?? res.data
        const map = {}
        for (const p of list) {
          const role = p.role_name || 'Unassigned'
          map[role] = (map[role] || 0) + 1
        }
        setStaffByRole(
          Object.entries(map)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
        )
      })
      .catch(() => {})
      .finally(() => setStaffLoading(false))
  }, [])

  useEffect(() => {
    Promise.all([
      api.get('/api/practitioners/auth/dashboard-stats/'),
      api.get('/api/practitioners/auth/dashboard-chart-data/'),
    ])
      .then(([statsRes, chartRes]) => {
        setStats(statsRes.data)
        setChartData(chartRes.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    api.get('/api/practitioners/auth/recent-activity/')
      .then((res) => setActivities(res.data))
      .catch(() => {})
      .finally(() => setActivitiesLoading(false))
  }, [])

  const firstName = user?.first_name || user?.username || user?.email?.split('@')[0] || 'there'
  const tenantLabel = user?.is_superuser
    ? 'across all tenants'
    : `at ${chartData?.tenant_name || 'your clinic'}`

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const specData = chartData?.patients_by_specialisation ?? []
  const specTotal = specData.reduce((s, d) => s + d.value, 0)
  const monthlyData = chartData?.monthly_registrations ?? []

  const gridColor  = theme.palette.divider
  const tickColor  = theme.palette.text.secondary
  const paperColor = theme.palette.background.paper

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

      {/* ── Row 1: Welcome header ───────────────────────────────── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography sx={{ fontSize: 24, fontWeight: 700, lineHeight: 1.3 }}>
            Welcome back,{' '}
            <Box
              component="span"
              sx={{
                background: isDark
                  ? 'linear-gradient(135deg, #F1F5F9, #F97316)'
                  : 'linear-gradient(135deg, #1A202C, #F97316)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {firstName}
            </Box>
            {' '}👋
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
            sparklineData={stats?.sparklines?.[m.sparklineKey]}
          />
        ))}
      </Box>

      {/* ── 3-col × 3-row grid; Activity Feed spans rows 1-2 ─── */}
      {/* Row 1: Area chart | Donut        | Activity Feed (↓)  */}
      {/* Row 2: Staff Role | Top Cond.    | Activity Feed (↑)  */}
      {/* Row 3: Bar chart  | Calendar     | Quick Actions       */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', lg: '5fr 4fr 3fr' },
          gap: 2.5,
        }}
      >
        {/* Row 1 Left: Area chart */}
        <Card sx={{ gridColumn: { lg: '1' }, gridRow: { lg: '1' }, height: '100%', display: 'flex', flexDirection: 'column' }}>
          <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 }, flex: 1, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
              <Box>
                <Typography sx={{ fontSize: 15, fontWeight: 600, color: 'text.primary' }}>
                  Patient Registrations
                </Typography>
                <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.25 }}>
                  Monthly activity for {new Date().getFullYear()}
                </Typography>
              </Box>
              <ToggleButtonGroup
                value={period}
                exclusive
                onChange={(_, val) => val && setPeriod(val)}
                size="small"
                sx={{
                  '& .MuiToggleButton-root': {
                    fontSize: 12,
                    py: 0.5,
                    px: 1.5,
                    textTransform: 'none',
                    fontWeight: 500,
                    border: '1px solid',
                    borderColor: 'divider',
                    '&.Mui-selected': {
                      bgcolor: 'rgba(249,115,22,0.1)',
                      color: '#F97316',
                      borderColor: '#F97316',
                      fontWeight: 600,
                    },
                  },
                }}
              >
                <ToggleButton value="week">Week</ToggleButton>
                <ToggleButton value="month">Month</ToggleButton>
                <ToggleButton value="year">Year</ToggleButton>
              </ToggleButtonGroup>
            </Box>
            <Box sx={{ flex: 1, minHeight: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={monthlyData}
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
                <ChartTooltip content={<CustomAreaTooltip />} />
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
            </Box>
          </CardContent>
        </Card>

        {/* Row 1 Center: Donut chart */}
        <Card sx={{ gridColumn: { lg: '2' }, gridRow: { lg: '1' }, height: '100%' }}>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Typography sx={{ fontSize: 15, fontWeight: 600, color: 'text.primary', mb: 0.25 }}>
                By Condition/Treatment
              </Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1 }}>
                Patients breakdown
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

        {/* Col 3, Rows 1-2: Activity Feed spans two rows */}
        <Box sx={{ gridColumn: { lg: '3' }, gridRow: { lg: '1 / 3' }, height: '100%', display: 'flex', flexDirection: 'column', '& > .MuiCard-root': { height: '100%' } }}>
          <ActivityFeed
            activities={activities}
            loading={activitiesLoading}
            showTenant={user?.is_superuser}
          />
        </Box>

        {/* Row 2 Left: Staff Role Breakdown */}
        <StaffRoleCard
          data={staffByRole}
          loading={staffLoading}
          sx={{ gridColumn: { lg: '1' }, gridRow: { lg: '2' }, height: '100%' }}
        />

        {/* Row 2 Center: Top Conditions */}
        <TopConditionsCard
          data={specData}
          loading={loading}
          sx={{ gridColumn: { lg: '2' }, gridRow: { lg: '2' }, height: '100%' }}
        />

        {/* Row 3 Left: Bar chart */}
        <Card sx={{ gridColumn: { lg: '1' }, gridRow: { lg: '3' }, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 }, flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Typography sx={{ fontSize: 15, fontWeight: 600, color: 'text.primary', mb: 0.25 }}>
                Monthly Overview
              </Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1.5 }}>
                Registrations by month
              </Typography>
              {loading ? (
                <Skeleton variant="rectangular" sx={{ flex: 1, minHeight: 100, borderRadius: 1 }} />
              ) : (
                <Box sx={{ flex: 1, minHeight: 100 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={monthlyData}
                    margin={{ top: 4, right: 4, bottom: 0, left: -24 }}
                    barSize={14}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: tickColor }}
                    />
                    <YAxis
                      allowDecimals={false}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: tickColor }}
                      width={24}
                    />
                    <ChartTooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: `1px solid ${gridColor}`,
                        background: paperColor,
                        fontSize: 12,
                      }}
                      formatter={(v) => [v, 'Registrations']}
                    />
                    <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                </Box>
              )}
            </CardContent>
          </Card>

        {/* Row 3 Center: Calendar */}
        <Box sx={{ gridColumn: { lg: '2' }, gridRow: { lg: '3' }, height: '100%', display: 'flex', flexDirection: 'column', '& > .MuiCard-root': { height: '100%' } }}>
          <MiniCalendar stats={stats} monthlyData={monthlyData} loading={loading} />
        </Box>

        {/* Row 3 Right: Quick Actions */}
        <Box sx={{ gridColumn: { lg: '3' }, gridRow: { lg: '3' }, height: '100%', display: 'flex', flexDirection: 'column', '& > .MuiCard-root': { height: '100%' } }}>
          <QuickActions hasPermission={hasPermission} activities={activities} />
        </Box>
      </Box>
    </Box>
  )
}
