import { useEffect, useMemo, useState } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import LockOpenIcon from '@mui/icons-material/LockOpen'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '@mui/material/styles'
import DataGrid from '../../components/common/DataGrid'
import FormModal from '../../components/common/FormModal'
import TenantFilter from '../../components/common/TenantFilter'

const EMPTY_FORM = { name: '', description: '' }
const TOTAL_PERMISSIONS = 13

export default function RolesPage() {
  const { user, hasPermission } = useAuth()
  const isSuperuser = user?.is_superuser === true
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const [roles, setRoles] = useState([])
  const [permissions, setPermissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // Drawer state
  const [drawerRole, setDrawerRole] = useState(null)
  const [drawerDetail, setDrawerDetail] = useState(null)
  const [drawerLoading, setDrawerLoading] = useState(false)

  // Per-switch loading: Map<permId, boolean>
  const [switchLoading, setSwitchLoading] = useState(new Map())

  // Permission counts for grid column: Map<roleId, number>
  const [permCountMap, setPermCountMap] = useState(new Map())

  const [selectedTenant, setSelectedTenant] = useState('all')
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  const showToast = (message, severity = 'success') =>
    setToast({ open: true, message, severity })

  const loadData = async () => {
    setLoading(true)
    try {
      const [rolesRes, permsRes] = await Promise.all([
        api.get('/api/administration/roles/'),
        api.get('/api/administration/permissions/'),
      ])
      const loadedRoles = rolesRes.data.results ?? rolesRes.data
      setRoles(loadedRoles)
      setPermissions(permsRes.data.results ?? permsRes.data)

      // Batch-fetch role details to populate permission counts in grid
      const details = await Promise.all(
        loadedRoles.map((r) =>
          api.get(`/api/administration/roles/${r.id}/`).then((res) => res.data).catch(() => null)
        )
      )
      const countMap = new Map()
      details.forEach((d) => { if (d) countMap.set(d.id, d.permissions?.length ?? 0) })
      setPermCountMap(countMap)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const loadRoleDetail = async (roleId) => {
    setDrawerLoading(true)
    try {
      const res = await api.get(`/api/administration/roles/${roleId}/`)
      setDrawerDetail(res.data)
      setPermCountMap((prev) => {
        const next = new Map(prev)
        next.set(roleId, res.data.permissions?.length ?? 0)
        return next
      })
    } finally {
      setDrawerLoading(false)
    }
  }

  const openDrawer = (role) => {
    setDrawerRole(role)
    setDrawerDetail(null)
    setSwitchLoading(new Map())
    loadRoleDetail(role.id)
  }

  const closeDrawer = () => {
    setDrawerRole(null)
    setDrawerDetail(null)
  }

  const handleToggle = async (perm, checked) => {
    if (!drawerRole) return
    setSwitchLoading((prev) => new Map(prev).set(perm.id, true))
    try {
      if (checked) {
        await api.post(
          `/api/administration/roles/${drawerRole.id}/assign_permission/`,
          { permission_id: perm.id }
        )
        setDrawerDetail((prev) => ({
          ...prev,
          permissions: [...(prev?.permissions ?? []), perm],
        }))
        setPermCountMap((prev) => {
          const next = new Map(prev)
          next.set(drawerRole.id, (next.get(drawerRole.id) ?? 0) + 1)
          return next
        })
        showToast('Permission granted')
      } else {
        await api.delete(
          `/api/administration/roles/${drawerRole.id}/remove_permission/`,
          { data: { permission_id: perm.id } }
        )
        setDrawerDetail((prev) => ({
          ...prev,
          permissions: (prev?.permissions ?? []).filter((p) => p.id !== perm.id),
        }))
        setPermCountMap((prev) => {
          const next = new Map(prev)
          next.set(drawerRole.id, Math.max(0, (next.get(drawerRole.id) ?? 1) - 1))
          return next
        })
        showToast('Permission revoked')
      }
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to update permission', 'error')
    } finally {
      setSwitchLoading((prev) => {
        const next = new Map(prev)
        next.set(perm.id, false)
        return next
      })
    }
  }

  const handleAddSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/api/administration/roles/', {
        name: addForm.name,
        description: addForm.description,
      })
      setAddOpen(false)
      setAddForm(EMPTY_FORM)
      showToast('Role created successfully')
      loadData()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to create role', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Permissions grouped by module
  const permsByModule = useMemo(() => {
    const groups = {}
    permissions.forEach((p) => {
      if (!groups[p.module]) groups[p.module] = []
      groups[p.module].push(p)
    })
    return groups
  }, [permissions])

  // Live set of assigned permission IDs
  const assignedIds = useMemo(
    () => new Set((drawerDetail?.permissions ?? []).map((p) => p.id)),
    [drawerDetail]
  )

  const rowBorderColor = (row) => {
    const count = permCountMap.get(row.id)
    if (count === undefined) return 'transparent'
    if (count === 0) return '#EF4444'
    if (count < 7) return '#F97316'
    return '#10B981'
  }

  const statusChip = (value) => (
    <Chip
      label={value ? 'Active' : 'Inactive'}
      size="small"
      sx={{
        bgcolor: value
          ? (isDark ? 'rgba(34,197,94,0.15)' : '#DCFCE7')
          : (isDark ? 'rgba(239,68,68,0.15)' : '#FEE2E2'),
        color: value
          ? (isDark ? '#4ADE80' : '#16A34A')
          : (isDark ? '#F87171' : '#DC2626'),
        fontWeight: 600,
        fontSize: '0.78rem',
        height: 24,
      }}
    />
  )

  const tenantColumn = { field: 'tenant_name', headerName: 'Tenant', width: 200 }
  const baseColumns = [
    {
      field: 'id',
      headerName: 'ID',
      width: 72,
      renderCell: ({ row, value }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Box
            sx={{
              width: 3,
              height: 32,
              borderRadius: '2px',
              bgcolor: rowBorderColor(row),
              flexShrink: 0,
            }}
          />
          <Typography sx={{ fontSize: '0.875rem', color: 'text.primary' }}>{value}</Typography>
        </Box>
      ),
    },
    { field: 'name', headerName: 'Name', flex: 1 },
    { field: 'description', headerName: 'Description', flex: 1 },
    {
      field: 'permissions_count',
      headerName: 'Permissions',
      width: 130,
      renderCell: ({ row }) => {
        const count = permCountMap.get(row.id)
        if (count === undefined) {
          return <Typography sx={{ fontSize: '0.875rem', color: 'text.disabled' }}>—</Typography>
        }
        return (
          <Chip
            label={`${count} / ${TOTAL_PERMISSIONS}`}
            size="small"
            sx={{
              bgcolor: count > 0
                ? (isDark ? 'rgba(16,185,129,0.15)' : '#D1FAE5')
                : (isDark ? 'rgba(249,115,22,0.15)' : '#FFF7ED'),
              color: count > 0
                ? (isDark ? '#34D399' : '#065F46')
                : (isDark ? '#FB923C' : '#9A3412'),
              fontWeight: 600,
              fontSize: '0.78rem',
              height: 24,
            }}
          />
        )
      },
    },
    {
      field: 'is_active',
      headerName: 'Status',
      width: 90,
      renderCell: ({ value }) => statusChip(value),
    },
    {
      field: 'created_at',
      headerName: 'Created At',
      width: 160,
      renderCell: ({ value }) =>
        value
          ? new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' })
          : '—',
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 100,
      renderCell: ({ row }) => (
        <Tooltip title="View / Manage Permissions">
          <IconButton
            size="small"
            onClick={() => openDrawer(row)}
            sx={{ color: '#3B82F6', '&:hover': { color: '#2563EB', bgcolor: 'rgba(59,130,246,0.08)' } }}
          >
            <LockOpenIcon sx={{ fontSize: 17 }} />
          </IconButton>
        </Tooltip>
      ),
    },
  ]
  const columns = isSuperuser
    ? [baseColumns[0], tenantColumn, ...baseColumns.slice(1)]
    : baseColumns

  return (
    <>
      {/* Page header */}
      <Box
        sx={{
          mb: 3,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          background: isDark
            ? 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.04) 100%)'
            : 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
          borderBottom: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          p: 3,
        }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary', lineHeight: 1.2 }}>
            Roles
          </Typography>
          <Typography sx={{ fontSize: 14, color: 'text.secondary', mt: 0.5 }}>
            Define and manage role-based access groups
          </Typography>
        </Box>
        {hasPermission('Administration:RoleCreate') && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAddOpen(true)}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
          >
            Add Role
          </Button>
        )}
      </Box>

      <TenantFilter show={isSuperuser} selectedTenant={selectedTenant} onChange={setSelectedTenant} />
      <DataGrid
        rows={selectedTenant === 'all' ? roles : roles.filter((r) => r.tenant_id === selectedTenant)}
        columns={columns}
        loading={loading}
      />

      {/* ── Add Role ─────────────────────────────────────────────── */}
      <FormModal
        open={addOpen}
        onClose={() => { setAddOpen(false); setAddForm(EMPTY_FORM) }}
        title="Add Role"
        onSubmit={handleAddSubmit}
        loading={saving}
      >
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <TextField
            label="Name"
            required
            size="small"
            fullWidth
            value={addForm.name}
            onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
          />
          <TextField
            label="Description"
            size="small"
            fullWidth
            multiline
            rows={2}
            value={addForm.description}
            onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
          />
        </Stack>
      </FormModal>

      {/* ── Permissions Drawer ────────────────────────────────────── */}
      <Drawer
        anchor="right"
        open={!!drawerRole}
        onClose={closeDrawer}
        PaperProps={{
          sx: { width: 420, display: 'flex', flexDirection: 'column' },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            px: 2.5, py: 2,
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            borderBottom: '1px solid', borderColor: 'divider',
            flexShrink: 0,
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0, mr: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 18, color: 'text.primary', lineHeight: 1.2 }}>
              {drawerRole?.name}
            </Typography>
            <Typography sx={{ fontSize: 13, color: '#718096', mt: 0.4, lineHeight: 1.4 }}>
              {drawerRole?.description || 'No description'}
            </Typography>
            {isSuperuser && drawerRole?.tenant_name && (
              <Chip
                label={drawerRole.tenant_name}
                size="small"
                sx={{
                  mt: 0.75,
                  height: 22,
                  fontSize: '0.75rem',
                  bgcolor: isDark ? 'rgba(59,130,246,0.15)' : '#EFF6FF',
                  color: '#3B82F6',
                }}
              />
            )}
          </Box>
          <IconButton size="small" onClick={closeDrawer} sx={{ mt: 0.25, flexShrink: 0 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Body — permission toggles grouped by module */}
        <Box sx={{ flex: 1, overflowY: 'auto', px: 2, py: 2 }}>
          {drawerLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}>
              <CircularProgress size={28} />
            </Box>
          ) : (
            Object.entries(permsByModule).map(([module, modulePerms]) => {
              const assignedInModule = modulePerms.filter((p) => assignedIds.has(p.id)).length
              return (
                <Accordion
                  key={module}
                  defaultExpanded
                  disableGutters
                  elevation={0}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: '8px !important',
                    mb: 1.5,
                    '&:before': { display: 'none' },
                    overflow: 'hidden',
                  }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon sx={{ fontSize: 18 }} />}
                    sx={{ px: 2, minHeight: 48, '& .MuiAccordionSummary-content': { my: 1 } }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%', mr: 1 }}>
                      <Typography sx={{ fontWeight: 600, fontSize: 14, color: 'text.primary', flex: 1 }}>
                        {module}
                      </Typography>
                      <Chip
                        label={`${assignedInModule} / ${modulePerms.length} enabled`}
                        size="small"
                        sx={{
                          height: 22,
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          bgcolor: assignedInModule > 0
                            ? (isDark ? 'rgba(249,115,22,0.18)' : '#FFF7ED')
                            : (isDark ? 'rgba(156,163,175,0.15)' : '#F3F4F6'),
                          color: assignedInModule > 0 ? '#F97316' : (isDark ? '#9CA3AF' : '#6B7280'),
                        }}
                      />
                    </Box>
                  </AccordionSummary>

                  <AccordionDetails sx={{ p: 0 }}>
                    <List dense disablePadding>
                      {modulePerms.map((perm, idx) => {
                        const isChecked = assignedIds.has(perm.id)
                        const isLoadingSwitch = switchLoading.get(perm.id) === true
                        return (
                          <ListItem
                            key={perm.id}
                            sx={{
                              px: 2, py: 0.75,
                              borderTop: '1px solid',
                              borderColor: idx === 0 ? 'divider' : 'divider',
                              '&:not(:first-of-type)': { borderTop: '1px solid', borderColor: 'divider' },
                            }}
                          >
                            <ListItemText
                              primary={
                                <Typography sx={{ fontSize: 13, fontWeight: 500, color: 'text.primary' }}>
                                  {perm.action}
                                </Typography>
                              }
                              secondary={
                                perm.description ? (
                                  <Typography component="span" sx={{ fontSize: 12, color: '#718096' }}>
                                    {perm.description}
                                  </Typography>
                                ) : undefined
                              }
                            />
                            <Box sx={{ ml: 1, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                              {isLoadingSwitch ? (
                                <Box sx={{ width: 40, display: 'flex', justifyContent: 'center' }}>
                                  <CircularProgress size={16} sx={{ color: '#F97316' }} />
                                </Box>
                              ) : (
                                <Switch
                                  size="small"
                                  checked={isChecked}
                                  disabled={!hasPermission('Administration:RoleUpdate')}
                                  onChange={(e) => handleToggle(perm, e.target.checked)}
                                  sx={{
                                    '& .MuiSwitch-switchBase.Mui-checked': { color: '#F97316' },
                                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                      bgcolor: '#F97316',
                                    },
                                  }}
                                />
                              )}
                            </Box>
                          </ListItem>
                        )
                      })}
                    </List>
                  </AccordionDetails>
                </Accordion>
              )
            })
          )}
        </Box>

        {/* Footer */}
        <Divider />
        <Box
          sx={{
            px: 2.5, py: 2,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5,
            flexShrink: 0,
          }}
        >
          <Typography sx={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center' }}>
            Changes are saved automatically
          </Typography>
          <Button
            variant="outlined"
            size="small"
            onClick={closeDrawer}
            sx={{ textTransform: 'none', borderRadius: 2, px: 3 }}
          >
            Close
          </Button>
        </Box>
      </Drawer>

      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={toast.severity}
          onClose={() => setToast((t) => ({ ...t, open: false }))}
          sx={{ fontSize: '0.85rem' }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </>
  )
}
