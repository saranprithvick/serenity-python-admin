import { useEffect, useState } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useTheme } from '@mui/material/styles'
import api from '../../api/axios'

const MODULE_COLORS = {
  Administration: '#1976d2',
  Practitioner: '#7c3aed',
}

const ACTION_COLORS = {
  View: 'default',
  Create: 'success',
  Update: 'warning',
  Delete: 'error',
  Security: 'info',
}

export default function PermissionsPage() {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const [grouped, setGrouped] = useState({})
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/api/administration/permissions/')
        const items = res.data.results ?? res.data

        // Group by module
        const map = {}
        for (const perm of items) {
          const mod = perm.module || perm.key.split(':')[0] || 'Other'
          if (!map[mod]) map[mod] = []
          map[mod].push(perm)
        }
        setGrouped(map)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleChange = (panel) => (_, isExpanded) => {
    setExpanded(isExpanded ? panel : false)
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}>
        <CircularProgress />
      </Box>
    )
  }

  const modules = Object.keys(grouped).sort()

  return (
    <Box>
      <Box
        sx={{
          mb: 3,
          background: isDark
            ? 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.04) 100%)'
            : 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
          borderBottom: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          p: 3,
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary', lineHeight: 1.2 }}>
          Permissions
        </Typography>
        <Typography sx={{ fontSize: 14, color: 'text.secondary', mt: 0.5 }}>
          Read-only registry of all permission keys used by the string-key permission system.
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {modules.map((mod) => {
          const perms = grouped[mod]
          const accent = MODULE_COLORS[mod] ?? '#374151'

          return (
            <Accordion
              key={mod}
              expanded={expanded === mod}
              onChange={handleChange(mod)}
              disableGutters
              elevation={0}
              variant="outlined"
              sx={{
                borderRadius: '10px !important',
                '&:before': { display: 'none' },
                overflow: 'hidden',
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{
                  bgcolor: 'background.default',
                  px: 2.5,
                  py: 0.5,
                  '& .MuiAccordionSummary-content': { alignItems: 'center', gap: 1.5 },
                }}
              >
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    bgcolor: accent,
                    flexShrink: 0,
                  }}
                />
                <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: 'text.primary' }}>
                  {mod}
                </Typography>
                <Chip
                  label={`${perms.length} permission${perms.length !== 1 ? 's' : ''}`}
                  size="small"
                  sx={{ height: 20, fontSize: '0.72rem', ml: 0.5 }}
                />
              </AccordionSummary>

              <AccordionDetails sx={{ p: 0 }}>
                <List dense disablePadding>
                  {perms.map((perm, i) => (
                    <Box key={perm.id}>
                      {i > 0 && <Divider component="li" />}
                      <ListItem
                        sx={{
                          px: 2.5,
                          py: 1.25,
                          alignItems: 'flex-start',
                          gap: 1.5,
                        }}
                      >
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                              <Typography
                                sx={{
                                  fontWeight: 700,
                                  fontSize: '0.87rem',
                                  fontFamily: 'monospace',
                                  color: 'text.primary',
                                }}
                              >
                                {perm.key}
                              </Typography>
                              <Chip
                                label={perm.action}
                                size="small"
                                color={ACTION_COLORS[perm.action] ?? 'default'}
                                sx={{ height: 20, fontSize: '0.7rem' }}
                              />
                            </Box>
                          }
                          secondary={
                            perm.description ? (
                              <Typography
                                variant="body2"
                                sx={{ color: 'text.secondary', fontSize: '0.8rem', mt: 0.25 }}
                              >
                                {perm.description}
                              </Typography>
                            ) : null
                          }
                        />
                      </ListItem>
                    </Box>
                  ))}
                </List>
              </AccordionDetails>
            </Accordion>
          )
        })}
      </Box>
    </Box>
  )
}
