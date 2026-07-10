import { useState } from 'react'
import { Box, Card, Divider, IconButton, Skeleton, Typography } from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined'
import LocalHospitalOutlinedIcon from '@mui/icons-material/LocalHospitalOutlined'
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined'
import { useTheme } from '@mui/material/styles'

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function buildCells(month, year) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrev = new Date(year, month, 0).getDate()

  const cells = []
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: daysInPrev - i, otherMonth: true })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, otherMonth: false })
  }
  const remaining = 42 - cells.length
  for (let d = 1; d <= remaining; d++) {
    cells.push({ day: d, otherMonth: true })
  }
  return cells
}

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function MiniCalendar({ stats = null, monthlyData = [], loading = false }) {
  const today = new Date()
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const [displayed, setDisplayed] = useState({ month: today.getMonth(), year: today.getFullYear() })

  const prevMonth = () => {
    setDisplayed((d) => {
      if (d.month === 0) return { month: 11, year: d.year - 1 }
      return { month: d.month - 1, year: d.year }
    })
  }

  const nextMonth = () => {
    setDisplayed((d) => {
      if (d.month === 11) return { month: 0, year: d.year + 1 }
      return { month: d.month + 1, year: d.year }
    })
  }

  const cells = buildCells(displayed.month, displayed.year)

  const isToday = (cell) =>
    !cell.otherMonth &&
    displayed.month === today.getMonth() &&
    displayed.year === today.getFullYear() &&
    cell.day === today.getDate()

  return (
    <Card>
      <Box sx={{ px: 2, pt: 2, pb: 1.5 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <IconButton size="small" onClick={prevMonth} sx={{ p: 0.25 }}>
            <ChevronLeftIcon sx={{ fontSize: 18 }} />
          </IconButton>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary' }}>
            {MONTH_NAMES[displayed.month]} {displayed.year}
          </Typography>
          <IconButton size="small" onClick={nextMonth} sx={{ p: 0.25 }}>
            <ChevronRightIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>

        {/* Day labels */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', mb: 0.75 }}>
          {DAY_LABELS.map((d) => (
            <Box key={d} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 24 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.disabled' }}>{d}</Typography>
            </Box>
          ))}
        </Box>

        {/* Calendar grid */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
          {cells.map((cell, i) => (
            <Box
              key={i}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                borderRadius: isToday(cell) ? '50%' : 1,
                bgcolor: isToday(cell) ? '#F97316' : 'transparent',
                cursor: 'default',
                '&:hover': !isToday(cell)
                  ? { bgcolor: isDark ? 'rgba(249,115,22,0.12)' : '#FFF7ED' }
                  : {},
              }}
            >
              <Typography
                sx={{
                  fontSize: 11,
                  fontWeight: isToday(cell) ? 700 : 400,
                  color: isToday(cell)
                    ? 'white'
                    : cell.otherMonth
                    ? (isDark ? 'rgba(255,255,255,0.2)' : '#D1D5DB')
                    : 'text.primary',
                  lineHeight: 1,
                }}
              >
                {cell.day}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      <Divider />

      {/* Month at a Glance */}
      <Box sx={{ px: 2, py: 1.75 }}>
        <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.6px', mb: 1.5 }}>
          Month at a Glance
        </Typography>
        {(() => {
          const abbr = MONTH_ABBR[displayed.month]
          const monthEntry = monthlyData.find((m) => m.month === abbr)
          const registrations = monthEntry?.count ?? 0
          const glanceItems = [
            {
              icon: <EventNoteOutlinedIcon sx={{ fontSize: 15 }} />,
              color: '#F97316',
              label: 'Registered',
              value: registrations,
            },
            {
              icon: <LocalHospitalOutlinedIcon sx={{ fontSize: 15 }} />,
              color: '#10B981',
              label: 'Patients',
              value: stats?.total_patients ?? '—',
            },
            {
              icon: <BadgeOutlinedIcon sx={{ fontSize: 15 }} />,
              color: '#3B82F6',
              label: 'Staff',
              value: stats?.total_users ?? '—',
            },
          ]
          return (
            <Box sx={{ display: 'flex', gap: 1 }}>
              {glanceItems.map(({ icon, color, label, value }) => (
                <Box
                  key={label}
                  sx={{
                    flex: 1,
                    bgcolor: `${color}10`,
                    border: '1px solid',
                    borderColor: `${color}30`,
                    borderRadius: 2,
                    px: 1, py: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 0.25,
                  }}
                >
                  <Box sx={{ color, display: 'flex', alignItems: 'center' }}>{icon}</Box>
                  {loading ? (
                    <Skeleton width={24} height={22} />
                  ) : (
                    <Typography sx={{ fontSize: 16, fontWeight: 700, color: 'text.primary', lineHeight: 1.1 }}>
                      {value}
                    </Typography>
                  )}
                  <Typography sx={{ fontSize: 10, color: 'text.secondary', fontWeight: 500, textAlign: 'center', lineHeight: 1.2 }}>
                    {label}
                  </Typography>
                </Box>
              ))}
            </Box>
          )
        })()}
      </Box>
    </Card>
  )
}
