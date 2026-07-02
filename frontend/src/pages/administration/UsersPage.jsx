import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
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
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import PersonOffIcon from '@mui/icons-material/PersonOff'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import DataGrid from '../../components/common/DataGrid'
import FormModal from '../../components/common/FormModal'

const EMPTY_ADD = { email: '', username: '', firstName: '', lastName: '', password: '', tenantId: '' }
const EMPTY_EDIT = { firstName: '', lastName: '', isActive: true }

export default function UsersPage() {
  const { user, hasPermission } = useAuth()
  const isSuperuser = user?.is_superuser === true

  const [users, setUsers] = useState([])
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [deactivateUser, setDeactivateUser] = useState(null)
  const [saving, setSaving] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_ADD)
  const [editForm, setEditForm] = useState(EMPTY_EDIT)
  const [addError, setAddError] = useState('')
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  const loadUsers = async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/auth/users/')
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
    }
  }, [isSuperuser])

  const showToast = (message, severity = 'success') =>
    setToast({ open: true, message, severity })

  const handleAddSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setAddError('')
    try {
      await api.post('/api/auth/users/', {
        email: addForm.email,
        username: addForm.username,
        first_name: addForm.firstName,
        last_name: addForm.lastName,
        password: addForm.password,
        ...(isSuperuser && addForm.tenantId && { tenant_id: addForm.tenantId }),
      })
      setAddOpen(false)
      setAddForm(EMPTY_ADD)
      showToast('User created successfully')
      loadUsers()
    } catch (err) {
      const data = err.response?.data
      if (data && typeof data === 'object') {
        const msgs = Object.entries(data)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`)
          .join('  ')
        setAddError(msgs)
      } else {
        setAddError('Failed to create user')
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
      await api.put(`/api/auth/users/${editUser.id}/`, {
        first_name: editForm.firstName,
        last_name: editForm.lastName,
        is_active: editForm.isActive,
      })
      setEditUser(null)
      showToast('User updated successfully')
      loadUsers()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to update user', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async () => {
    try {
      await api.delete(`/api/auth/users/${deactivateUser.id}/`)
      setDeactivateUser(null)
      showToast('User deactivated')
      loadUsers()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to deactivate user', 'error')
      setDeactivateUser(null)
    }
  }

  const tenantColumn = { field: 'tenant_id', headerName: 'Tenant', width: 150 }
  const baseColumns = [
    { field: 'id', headerName: 'ID', width: 60 },
    { field: 'email', headerName: 'Email', flex: 1 },
    { field: 'username', headerName: 'Username', width: 150 },
    { field: 'first_name', headerName: 'First Name', width: 130 },
    { field: 'last_name', headerName: 'Last Name', width: 130 },
    {
      field: 'is_active',
      headerName: 'Active',
      width: 80,
      renderCell: ({ value }) => (
        <Chip
          label={value ? '✓' : '✗'}
          size="small"
          sx={{
            bgcolor: value ? '#dcfce7' : '#fee2e2',
            color: value ? '#16a34a' : '#dc2626',
            fontWeight: 700,
            fontSize: '0.78rem',
            height: 22,
          }}
        />
      ),
    },
    {
      field: 'date_joined',
      headerName: 'Date Joined',
      width: 160,
      renderCell: ({ value }) =>
        value ? new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—',
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', gap: 0.25 }}>
          {hasPermission('Administration:UserUpdate') && (
            <Tooltip title="Edit">
              <IconButton size="small" onClick={() => openEdit(row)}>
                <EditIcon sx={{ fontSize: 17 }} />
              </IconButton>
            </Tooltip>
          )}
          {row.is_active && hasPermission('Administration:UserDelete') && (
            <Tooltip title="Deactivate">
              <IconButton size="small" color="error" onClick={() => setDeactivateUser(row)}>
                <PersonOffIcon sx={{ fontSize: 17 }} />
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
      <DataGrid
        title="Users"
        rows={users}
        columns={columns}
        loading={loading}
        onAdd={hasPermission('Administration:UserCreate') ? () => setAddOpen(true) : undefined}
        addLabel="Add User"
      />

      {/* ── Add User ─────────────────────────────────────────────── */}
      <FormModal
        open={addOpen}
        onClose={() => { setAddOpen(false); setAddForm(EMPTY_ADD); setAddError('') }}
        title="Add User"
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

      {/* ── Edit User ─────────────────────────────────────────────── */}
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

      {/* ── Deactivate Confirm ────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deactivateUser}
        onClose={() => setDeactivateUser(null)}
        onConfirm={handleDeactivate}
        title="Deactivate User"
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
