import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getErrorMessage } from '../../utils/errorMessages'
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import BlockIcon from '@mui/icons-material/Block'
import CloseIcon from '@mui/icons-material/Close'
import EditIcon from '@mui/icons-material/Edit'
import SearchIcon from '@mui/icons-material/Search'
import VisibilityIcon from '@mui/icons-material/Visibility'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '@mui/material/styles'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import DataGrid from '../../components/common/DataGrid'
import FormModal from '../../components/common/FormModal'
import TenantFilter from '../../components/common/TenantFilter'

const EMPTY_ADD = {
  firstName: '', lastName: '', email: '', phone: '',
  specialisation: '', city: '', country: '', address: '', notes: '', tenantId: '',
}
const EMPTY_EDIT = {
  firstName: '', lastName: '', email: '', phone: '',
  specialisation: '', city: '', country: '', address: '', notes: '',
}

export default function PatientsPage() {
  const { user, hasPermission } = useAuth()
  const isSuperuser = user?.is_superuser === true
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const [patients, setPatients] = useState([])
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deactivateTarget, setDeactivateTarget] = useState(null)
  const [saving, setSaving] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_ADD)
  const [editForm, setEditForm] = useState(EMPTY_EDIT)
  const [error, setError] = useState('')
  const [addError, setAddError] = useState('')
  const [selectedTenant, setSelectedTenant] = useState('all')
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || '')
  const [debouncedSearch, setDebouncedSearch] = useState(() => searchParams.get('search') || '')
  const [statusFilter, setStatusFilter] = useState('all')
  const [apiTotal, setApiTotal] = useState(0)

  // Debounce search input by 300 ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  const loadPatients = async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (statusFilter !== 'all') params.set('is_active', statusFilter)
      if (isSuperuser && selectedTenant !== 'all') params.set('tenant_id', selectedTenant)
      const query = params.toString() ? '?' + params.toString() : ''
      const res = await api.get(`/api/patients/${query}`)
      const results = res.data.results ?? res.data
      setPatients(results)
      setApiTotal(res.data.count ?? results.length)
    } catch (err) {
      if (err.response?.status === 403) {
        setError('You do not have permission to view patients. Contact your administrator.')
      } else {
        setError('Failed to load patients.')
      }
    } finally {
      setLoading(false)
    }
  }

  // Reload when search, status filter, or tenant selection changes
  useEffect(() => {
    loadPatients()
  }, [debouncedSearch, statusFilter, selectedTenant])

  // Load tenants for superadmin once on mount
  useEffect(() => {
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
    const payload = {
      first_name: addForm.firstName,
      last_name: addForm.lastName,
      ...(addForm.email && { email: addForm.email }),
      ...(addForm.phone && { phone: addForm.phone }),
      ...(addForm.specialisation && { specialisation: addForm.specialisation }),
      ...(addForm.city && { city: addForm.city }),
      ...(addForm.country && { country: addForm.country }),
      ...(addForm.address && { address: addForm.address }),
      ...(addForm.notes && { notes: addForm.notes }),
      ...(isSuperuser && addForm.tenantId && { tenant_id: addForm.tenantId }),
    }
    try {
      await api.post('/api/patients/', payload)
      setAddOpen(false)
      setAddForm(EMPTY_ADD)
      showToast('Patient created successfully')
      loadPatients()
    } catch (err) {
      const data = err.response?.data
      if (data && typeof data === 'object') {
        const msgs = Object.entries(data)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`)
          .join('  ')
        setAddError(msgs)
      } else {
        setAddError('Failed to create patient')
      }
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (row) => {
    setEditForm({
      firstName: row.first_name ?? '',
      lastName: row.last_name ?? '',
      email: row.email ?? '',
      phone: row.phone ?? '',
      specialisation: row.specialisation ?? '',
      city: row.city ?? '',
      country: row.country ?? '',
      address: row.address ?? '',
      notes: row.notes ?? '',
    })
    setEditTarget(row)
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.put(`/api/patients/${editTarget.id}/`, {
        first_name: editForm.firstName,
        last_name: editForm.lastName,
        email: editForm.email || null,
        phone: editForm.phone || null,
        specialisation: editForm.specialisation || null,
        city: editForm.city || null,
        country: editForm.country || null,
        address: editForm.address || null,
        notes: editForm.notes || null,
      })
      setEditTarget(null)
      showToast('Patient updated successfully')
      loadPatients()
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async () => {
    try {
      await api.delete(`/api/patients/${deactivateTarget.id}/`)
      setDeactivateTarget(null)
      showToast('Patient deactivated')
      loadPatients()
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
      setDeactivateTarget(null)
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

  const baseColumns = [
    { field: 'id', headerName: 'ID', width: 60 },
    {
      field: 'full_name',
      headerName: 'Patient Name',
      flex: 1,
      renderCell: ({ value, row }) => (
        <Typography
          sx={{
            fontSize: 14, color: '#3B82F6', cursor: 'pointer', fontWeight: 500,
            '&:hover': { textDecoration: 'underline' },
          }}
          onClick={() => navigate(`/patients/${row.id}`)}
        >
          {value}
        </Typography>
      ),
    },
    { field: 'specialisation', headerName: 'Condition/Treatment', width: 190 },
    { field: 'city', headerName: 'City', width: 120 },
    { field: 'country', headerName: 'Country', width: 100 },
    { field: 'email', headerName: 'Email', width: 200 },
    { field: 'phone', headerName: 'Phone', width: 130 },
    {
      field: 'is_active',
      headerName: 'Status',
      width: 90,
      renderCell: ({ value }) => statusChip(value),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', gap: 0.25 }}>
          <Tooltip title="View Details">
            <IconButton
              size="small"
              onClick={() => navigate(`/patients/${row.id}`)}
              sx={{ color: '#3B82F6', '&:hover': { color: '#2563EB', bgcolor: 'rgba(59,130,246,0.08)' } }}
            >
              <VisibilityIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>
          {hasPermission('Patient:Update') && (
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
          {row.is_active && hasPermission('Patient:Delete') && (
            <Tooltip title="Deactivate">
              <IconButton
                size="small"
                onClick={() => setDeactivateTarget(row)}
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

  const tenantColumn = {
    field: 'tenant_name',
    headerName: 'Hospital',
    width: 200,
    renderCell: (params) => (
      <Typography sx={{ fontSize: 13 }}>{params.row.tenant_name || '—'}</Typography>
    ),
  }
  const columns = isSuperuser
    ? [baseColumns[0], tenantColumn, ...baseColumns.slice(1)]
    : baseColumns

  const displayedRows = patients

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
            Patients
          </Typography>
          <Typography sx={{ fontSize: 14, color: 'text.secondary', mt: 0.5 }}>
            Manage patient records and profiles
          </Typography>
        </Box>
        {hasPermission('Patient:Create') && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAddOpen(true)}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
          >
            Add Patient
          </Button>
        )}
      </Box>

      <TenantFilter show={isSuperuser} selectedTenant={selectedTenant} onChange={setSelectedTenant} />

      {/* Search + filter toolbar */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0 }}>
          <TextField
            placeholder="Search by name, condition, city, email…"
            size="small"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ width: 340, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: '#9CA3AF' }} />
                </InputAdornment>
              ),
            }}
          />
          {(searchQuery || statusFilter !== 'all') && (
            <Button
              size="small"
              variant="text"
              startIcon={<CloseIcon sx={{ fontSize: 15 }} />}
              onClick={() => { setSearchQuery(''); setStatusFilter('all') }}
              sx={{ color: '#718096', textTransform: 'none', fontWeight: 500, fontSize: 13 }}
            >
              Clear
            </Button>
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', whiteSpace: 'nowrap' }}>
            {displayedRows.length !== apiTotal
              ? `Showing ${displayedRows.length} of ${apiTotal} patients`
              : `${apiTotal} patient${apiTotal !== 1 ? 's' : ''}`}
          </Typography>

          <ToggleButtonGroup
            value={statusFilter}
            exclusive
            onChange={(_, val) => val && setStatusFilter(val)}
            size="small"
            sx={{
              '& .MuiToggleButton-root': {
                textTransform: 'none',
                fontSize: 12,
                fontWeight: 500,
                px: 1.5,
                py: 0.5,
                border: '1px solid',
                borderColor: 'divider',
                color: 'text.secondary',
                '&.Mui-selected': {
                  bgcolor: '#F97316',
                  color: '#fff',
                  borderColor: '#F97316',
                  '&:hover': { bgcolor: '#EA6C0A' },
                },
              },
            }}
          >
            <ToggleButton value="all">All</ToggleButton>
            <ToggleButton value="true">Active</ToggleButton>
            <ToggleButton value="false">Inactive</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      <DataGrid
        rows={displayedRows}
        columns={columns}
        loading={loading}
      />

      {/* ── Add Patient ─────────────────────────────────────────────── */}
      <FormModal
        open={addOpen}
        onClose={() => { setAddOpen(false); setAddForm(EMPTY_ADD); setAddError('') }}
        title="Add Patient"
        onSubmit={handleAddSubmit}
        loading={saving}
      >
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          {addError && (
            <Alert severity="error" sx={{ fontSize: '0.82rem' }}>{addError}</Alert>
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
          <Stack direction="row" spacing={1.5}>
            <TextField
              label="First Name"
              required
              size="small"
              fullWidth
              value={addForm.firstName}
              onChange={(e) => setAddForm((f) => ({ ...f, firstName: e.target.value }))}
            />
            <TextField
              label="Last Name"
              required
              size="small"
              fullWidth
              value={addForm.lastName}
              onChange={(e) => setAddForm((f) => ({ ...f, lastName: e.target.value }))}
            />
          </Stack>
          <TextField
            label="Condition/Treatment"
            size="small"
            fullWidth
            value={addForm.specialisation}
            onChange={(e) => setAddForm((f) => ({ ...f, specialisation: e.target.value }))}
          />
          <Stack direction="row" spacing={1.5}>
            <TextField
              label="Email"
              type="email"
              size="small"
              fullWidth
              value={addForm.email}
              onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
            />
            <TextField
              label="Phone"
              size="small"
              fullWidth
              value={addForm.phone}
              onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </Stack>
          <Stack direction="row" spacing={1.5}>
            <TextField
              label="City"
              size="small"
              fullWidth
              value={addForm.city}
              onChange={(e) => setAddForm((f) => ({ ...f, city: e.target.value }))}
            />
            <TextField
              label="Country"
              size="small"
              fullWidth
              value={addForm.country}
              onChange={(e) => setAddForm((f) => ({ ...f, country: e.target.value }))}
            />
          </Stack>
          <TextField
            label="Address"
            size="small"
            fullWidth
            multiline
            rows={2}
            value={addForm.address}
            onChange={(e) => setAddForm((f) => ({ ...f, address: e.target.value }))}
          />
          <TextField
            label="Notes"
            size="small"
            fullWidth
            multiline
            rows={2}
            value={addForm.notes}
            onChange={(e) => setAddForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </Stack>
      </FormModal>

      {/* ── Edit Patient ────────────────────────────────────────────── */}
      <FormModal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title={`Edit — ${editTarget?.full_name}`}
        onSubmit={handleEditSubmit}
        loading={saving}
      >
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Stack direction="row" spacing={1.5}>
            <TextField
              label="First Name"
              required
              size="small"
              fullWidth
              value={editForm.firstName}
              onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
            />
            <TextField
              label="Last Name"
              required
              size="small"
              fullWidth
              value={editForm.lastName}
              onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
            />
          </Stack>
          <TextField
            label="Condition/Treatment"
            size="small"
            fullWidth
            value={editForm.specialisation}
            onChange={(e) => setEditForm((f) => ({ ...f, specialisation: e.target.value }))}
          />
          <Stack direction="row" spacing={1.5}>
            <TextField
              label="Email"
              type="email"
              size="small"
              fullWidth
              value={editForm.email}
              onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
            />
            <TextField
              label="Phone"
              size="small"
              fullWidth
              value={editForm.phone}
              onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </Stack>
          <Stack direction="row" spacing={1.5}>
            <TextField
              label="City"
              size="small"
              fullWidth
              value={editForm.city}
              onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))}
            />
            <TextField
              label="Country"
              size="small"
              fullWidth
              value={editForm.country}
              onChange={(e) => setEditForm((f) => ({ ...f, country: e.target.value }))}
            />
          </Stack>
          <TextField
            label="Address"
            size="small"
            fullWidth
            multiline
            rows={2}
            value={editForm.address}
            onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
          />
          <TextField
            label="Notes"
            size="small"
            fullWidth
            multiline
            rows={2}
            value={editForm.notes}
            onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </Stack>
      </FormModal>

      {/* ── Deactivate Confirm ────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={handleDeactivate}
        title="Deactivate Patient"
        message={`Are you sure you want to deactivate ${deactivateTarget?.full_name}?`}
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
