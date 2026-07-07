import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import BlockIcon from '@mui/icons-material/Block'
import EditIcon from '@mui/icons-material/Edit'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '@mui/material/styles'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import DataGrid from '../../components/common/DataGrid'
import FormModal from '../../components/common/FormModal'
import TenantFilter from '../../components/common/TenantFilter'

const EMPTY_ADD = {
  email: '', username: '', firstName: '', lastName: '', password: '',
  userType: '', specialisation: '', tenantId: '',
}
const EMPTY_EDIT = { firstName: '', lastName: '', isActive: true }
const EMPTY_TENANT_ADMIN = { email: '', username: '', firstName: '', lastName: '', password: '', tenantId: '' }

export default function PractitionersStaffPage() {
  const { user, hasPermission } = useAuth()
  const isSuperuser = user?.is_superuser === true
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const [users, setUsers] = useState([])
  const [tenants, setTenants] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [tenantAdminModalOpen, setTenantAdminModalOpen] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [deactivateUser, setDeactivateUser] = useState(null)
  const [saving, setSaving] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_ADD)
  const [tenantAdminForm, setTenantAdminForm] = useState(EMPTY_TENANT_ADMIN)
  const [editForm, setEditForm] = useState(EMPTY_EDIT)
  const [addError, setAddError] = useState('')
  const [tenantAdminError, setTenantAdminError] = useState('')
  const [selectedTenant, setSelectedTenant] = useState('all')
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  const loadUsers = async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/practitioners/')
      setUsers(res.data.results ?? res.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
    if (isSuperuser) {
      api.get('/api/tenants/').then((res) => {
        const list = res.data.results ?? res.data
        setTenants([...list].sort((a, b) => a.id - b.id))
      }).catch(() => {})
      api.get('/api/administration/roles/').then((res) => {
        setRoles(res.data.results ?? res.data)
      }).catch(() => {})
    }
  }, [isSuperuser])

  const showToast = (message, severity = 'success') =>
    setToast({ open: true, message, severity })

  const handleAddSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setAddError('')
    try {
      await api.post('/api/practitioners/', {
        email: addForm.email,
        username: addForm.username,
        first_name: addForm.firstName,
        last_name: addForm.lastName,
        password: addForm.password,
        ...(addForm.userType && { user_type: addForm.userType }),
        ...(addForm.specialisation && { specialisation: addForm.specialisation }),
        ...(isSuperuser && addForm.tenantId && { tenant_id: addForm.tenantId }),
      })
      setAddOpen(false)
      setAddForm(EMPTY_ADD)
      showToast('Staff member created successfully')
      loadUsers()
    } catch (err) {
      const data = err.response?.data
      if (data && typeof data === 'object') {
        const msgs = Object.entries(data)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`)
          .join('  ')
        setAddError(msgs)
      } else {
        setAddError('Failed to create staff member')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleTenantAdminSubmit = async (e) => {
    e.preventDefault()
    setTenantAdminError('')
    if (!tenantAdminForm.tenantId) {
      setTenantAdminError('Please select a tenant.')
      return
    }
    const tenantAdminRole = roles.find(
      (r) => r.name === 'Tenant Admin' && r.tenant_id === tenantAdminForm.tenantId
    )
    if (!tenantAdminRole) {
      setTenantAdminError(
        'No Tenant Admin role found for this tenant. Please seed the tenant first.'
      )
      return
    }
    setSaving(true)
    try {
      await api.post('/api/practitioners/', {
        email: tenantAdminForm.email,
        username: tenantAdminForm.username,
        password: tenantAdminForm.password,
        first_name: tenantAdminForm.firstName,
        last_name: tenantAdminForm.lastName,
        user_type: 'tenant_admin',
        tenant_id: tenantAdminForm.tenantId,
        role_id: tenantAdminRole.id,
      })
      const tenantName = tenants.find((t) => t.id === tenantAdminForm.tenantId)?.name ?? 'selected tenant'
      setTenantAdminModalOpen(false)
      setTenantAdminForm(EMPTY_TENANT_ADMIN)
      showToast(`Tenant Admin created for ${tenantName}`)
      loadUsers()
    } catch (err) {
      const data = err.response?.data
      if (data && typeof data === 'object') {
        const msgs = Object.entries(data)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`)
          .join('  ')
        setTenantAdminError(msgs)
      } else {
        setTenantAdminError('Failed to create Tenant Admin')
      }
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (row) => {
    setEditForm({
      firstName: row.first_name ?? '',
      lastName: row.last_name ?? '',
      isActive: row.is_active,
    })
    setEditUser(row)
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.put(`/api/practitioners/${editUser.id}/`, {
        first_name: editForm.firstName,
        last_name: editForm.lastName,
        is_active: editForm.isActive,
      })
      setEditUser(null)
      showToast('Staff member updated successfully')
      loadUsers()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to update staff member', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async () => {
    try {
      await api.delete(`/api/practitioners/${deactivateUser.id}/`)
      setDeactivateUser(null)
      showToast('Staff member deactivated')
      loadUsers()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to deactivate staff member', 'error')
      setDeactivateUser(null)
    }
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

  const userTypeChip = (value) => {
    if (!value) return <Typography sx={{ fontSize: 13, color: 'text.disabled' }}>—</Typography>
    const isAdmin = value === 'tenant_admin'
    return (
      <Chip
        label={isAdmin ? 'Tenant Admin' : 'Staff'}
        size="small"
        sx={{
          bgcolor: isAdmin
            ? (isDark ? 'rgba(139,92,246,0.15)' : '#EDE9FE')
            : (isDark ? 'rgba(59,130,246,0.15)' : '#EFF6FF'),
          color: isAdmin
            ? (isDark ? '#A78BFA' : '#6D28D9')
            : (isDark ? '#60A5FA' : '#1D4ED8'),
          fontWeight: 600,
          fontSize: '0.78rem',
          height: 24,
        }}
      />
    )
  }

  const tenantColumn = { field: 'tenant_id', headerName: 'Tenant', width: 150 }
  const baseColumns = [
    { field: 'id', headerName: 'ID', width: 60 },
    { field: 'email', headerName: 'Email', flex: 1 },
    { field: 'username', headerName: 'Username', width: 140 },
    {
      field: 'user_type',
      headerName: 'User Type',
      width: 130,
      renderCell: ({ value }) => userTypeChip(value),
    },
    { field: 'specialisation', headerName: 'Specialisation', width: 175,
      renderCell: ({ value }) => value || <Typography sx={{ fontSize: 13, color: 'text.disabled' }}>—</Typography>,
    },
    {
      field: 'is_active',
      headerName: 'Status',
      width: 90,
      renderCell: ({ value }) => statusChip(value),
    },
    {
      field: 'date_joined',
      headerName: 'Date Joined',
      width: 140,
      renderCell: ({ value }) =>
        value ? new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—',
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 100,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', gap: 0.25 }}>
          {hasPermission('Administration:UserUpdate') && (
            <Tooltip title="Edit">
              <IconButton
                size="small"
                onClick={() => openEdit(row)}
                sx={{ color: '#6B7280', '&:hover': { color: '#374151', bgcolor: 'rgba(107,114,128,0.08)' } }}
              >
                <EditIcon sx={{ fontSize: 17 }} />
              </IconButton>
            </Tooltip>
          )}
          {row.is_active && hasPermission('Administration:UserDelete') && (
            <Tooltip title="Deactivate">
              <IconButton
                size="small"
                onClick={() => setDeactivateUser(row)}
                sx={{ color: '#EF4444', '&:hover': { color: '#DC2626', bgcolor: 'rgba(239,68,68,0.08)' } }}
              >
                <BlockIcon sx={{ fontSize: 17 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
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
            Staff
          </Typography>
          <Typography sx={{ fontSize: 14, color: 'text.secondary', mt: 0.5 }}>
            Manage staff members and access rights
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          {isSuperuser && (
            <Button
              variant="contained"
              startIcon={<AdminPanelSettingsIcon />}
              onClick={() => setTenantAdminModalOpen(true)}
              sx={{
                bgcolor: '#1A202C',
                color: '#fff',
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 600,
                '&:hover': { bgcolor: '#2D3748', color: '#fff' },
              }}
            >
              Add Tenant Admin
            </Button>
          )}
          {hasPermission('Administration:UserCreate') && (
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setAddOpen(true)}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              Add Staff Member
            </Button>
          )}
        </Box>
      </Box>

      <TenantFilter show={isSuperuser} selectedTenant={selectedTenant} onChange={setSelectedTenant} />
      <DataGrid
        rows={selectedTenant === 'all' ? users : users.filter((u) => u.tenant_id === selectedTenant)}
        columns={columns}
        loading={loading}
      />

      {/* ── Add Staff Member ─────────────────────────────────────────────── */}
      <FormModal
        open={addOpen}
        onClose={() => { setAddOpen(false); setAddForm(EMPTY_ADD); setAddError('') }}
        title="Add Staff Member"
        onSubmit={handleAddSubmit}
        loading={saving}
      >
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          {addError && (
            <Alert severity="error" sx={{ fontSize: '0.82rem' }}>
              {addError}
            </Alert>
          )}
          {isSuperuser && (
            <FormControl size="small" fullWidth required>
              <InputLabel>Tenant</InputLabel>
              <Select
                label="Tenant"
                value={addForm.tenantId}
                onChange={(e) => setAddForm((f) => ({ ...f, tenantId: e.target.value }))}
              >
                {tenants.map((t) => (
                  <MenuItem key={t.id} value={t.id}>{t.id} — {t.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          <TextField
            label="Email"
            type="email"
            required
            size="small"
            fullWidth
            value={addForm.email}
            onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
          />
          <TextField
            label="Username"
            required
            size="small"
            fullWidth
            value={addForm.username}
            onChange={(e) => setAddForm((f) => ({ ...f, username: e.target.value }))}
          />
          <Stack direction="row" spacing={1.5}>
            <TextField
              label="First Name"
              size="small"
              fullWidth
              value={addForm.firstName}
              onChange={(e) => setAddForm((f) => ({ ...f, firstName: e.target.value }))}
            />
            <TextField
              label="Last Name"
              size="small"
              fullWidth
              value={addForm.lastName}
              onChange={(e) => setAddForm((f) => ({ ...f, lastName: e.target.value }))}
            />
          </Stack>
          <Stack direction="row" spacing={1.5}>
            <FormControl size="small" fullWidth>
              <InputLabel>User Type</InputLabel>
              <Select
                label="User Type"
                value={addForm.userType}
                onChange={(e) => setAddForm((f) => ({ ...f, userType: e.target.value }))}
              >
                <MenuItem value="tenant_admin">Tenant Admin</MenuItem>
                <MenuItem value="staff">Staff</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Specialisation"
              size="small"
              fullWidth
              value={addForm.specialisation}
              onChange={(e) => setAddForm((f) => ({ ...f, specialisation: e.target.value }))}
            />
          </Stack>
          <TextField
            label="Password"
            type="password"
            required
            size="small"
            fullWidth
            value={addForm.password}
            onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
          />
        </Stack>
      </FormModal>

      {/* ── Edit Staff Member ─────────────────────────────────────────────── */}
      <FormModal
        open={!!editUser}
        onClose={() => setEditUser(null)}
        title={`Edit — ${editUser?.email}`}
        onSubmit={handleEditSubmit}
        loading={saving}
      >
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Stack direction="row" spacing={1.5}>
            <TextField
              label="First Name"
              size="small"
              fullWidth
              value={editForm.firstName}
              onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
            />
            <TextField
              label="Last Name"
              size="small"
              fullWidth
              value={editForm.lastName}
              onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
            />
          </Stack>
          <FormControlLabel
            control={
              <Checkbox
                checked={editForm.isActive}
                onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))}
                size="small"
              />
            }
            label="Active"
          />
        </Stack>
      </FormModal>

      {/* ── Create Tenant Admin ─────────────────────────────────────── */}
      <FormModal
        open={tenantAdminModalOpen}
        onClose={() => { setTenantAdminModalOpen(false); setTenantAdminForm(EMPTY_TENANT_ADMIN); setTenantAdminError('') }}
        title="Create Tenant Admin"
        onSubmit={handleTenantAdminSubmit}
        loading={saving}
      >
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: -0.5 }}>
            This user will have full administrative access to the selected tenant
          </Typography>
          {tenantAdminError && (
            <Alert severity="error" sx={{ fontSize: '0.82rem' }}>
              {tenantAdminError}
            </Alert>
          )}
          <FormControl size="small" fullWidth required>
            <InputLabel>Tenant</InputLabel>
            <Select
              label="Tenant"
              value={tenantAdminForm.tenantId}
              onChange={(e) => setTenantAdminForm((f) => ({ ...f, tenantId: e.target.value }))}
            >
              {tenants.map((t) => (
                <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Email"
            type="email"
            required
            size="small"
            fullWidth
            value={tenantAdminForm.email}
            onChange={(e) => setTenantAdminForm((f) => ({ ...f, email: e.target.value }))}
          />
          <TextField
            label="Username"
            required
            size="small"
            fullWidth
            value={tenantAdminForm.username}
            onChange={(e) => setTenantAdminForm((f) => ({ ...f, username: e.target.value }))}
          />
          <Stack direction="row" spacing={1.5}>
            <TextField
              label="First Name"
              size="small"
              fullWidth
              value={tenantAdminForm.firstName}
              onChange={(e) => setTenantAdminForm((f) => ({ ...f, firstName: e.target.value }))}
            />
            <TextField
              label="Last Name"
              size="small"
              fullWidth
              value={tenantAdminForm.lastName}
              onChange={(e) => setTenantAdminForm((f) => ({ ...f, lastName: e.target.value }))}
            />
          </Stack>
          <TextField
            label="Password"
            type="password"
            required
            size="small"
            fullWidth
            value={tenantAdminForm.password}
            onChange={(e) => setTenantAdminForm((f) => ({ ...f, password: e.target.value }))}
          />
        </Stack>
      </FormModal>

      {/* ── Deactivate Confirm ────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deactivateUser}
        onClose={() => setDeactivateUser(null)}
        onConfirm={handleDeactivate}
        title="Deactivate Staff Member"
        message={`Are you sure you want to deactivate ${deactivateUser?.email}?`}
        confirmLabel="Deactivate"
      />

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
