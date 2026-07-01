import { useEffect, useState } from 'react'
import {
  Alert,
  Autocomplete,
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
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import DeleteIcon from '@mui/icons-material/Delete'
import LockOpenIcon from '@mui/icons-material/LockOpen'
import api from '../../api/axios'
import DataGrid from '../../components/common/DataGrid'
import FormModal from '../../components/common/FormModal'

const EMPTY_FORM = { name: '', description: '' }

export default function RolesPage() {
  const [roles, setRoles] = useState([])
  const [permissions, setPermissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // Permissions drawer
  const [drawerRole, setDrawerRole] = useState(null)
  const [drawerDetail, setDrawerDetail] = useState(null)
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [assignPerm, setAssignPerm] = useState(null)
  const [assignSaving, setAssignSaving] = useState(false)

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
      setRoles(rolesRes.data.results ?? rolesRes.data)
      setPermissions(permsRes.data.results ?? permsRes.data)
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
    } finally {
      setDrawerLoading(false)
    }
  }

  const openDrawer = (role) => {
    setDrawerRole(role)
    setDrawerDetail(null)
    setAssignPerm(null)
    loadRoleDetail(role.id)
  }

  const closeDrawer = () => {
    setDrawerRole(null)
    setDrawerDetail(null)
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

  const handleAssignPermission = async () => {
    if (!assignPerm) return
    setAssignSaving(true)
    try {
      await api.post(
        `/api/administration/roles/${drawerRole.id}/assign_permission/`,
        { permission_id: assignPerm.id }
      )
      setAssignPerm(null)
      showToast('Permission assigned')
      loadRoleDetail(drawerRole.id)
      loadData()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to assign permission', 'error')
    } finally {
      setAssignSaving(false)
    }
  }

  const handleRemovePermission = async (permId) => {
    try {
      await api.delete(
        `/api/administration/roles/${drawerRole.id}/remove_permission/`,
        { data: { permission_id: permId } }
      )
      showToast('Permission removed')
      loadRoleDetail(drawerRole.id)
      loadData()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to remove permission', 'error')
    }
  }

  const assignedIds = new Set((drawerDetail?.permissions ?? []).map((p) => p.id))
  const unassignedPerms = permissions.filter((p) => !assignedIds.has(p.id))

  const columns = [
    { field: 'id', headerName: 'ID', width: 60 },
    { field: 'name', headerName: 'Name', flex: 1 },
    { field: 'description', headerName: 'Description', flex: 1 },
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
      width: 140,
      renderCell: ({ row }) => (
        <Tooltip title="View / Manage Permissions">
          <IconButton size="small" color="primary" onClick={() => openDrawer(row)}>
            <LockOpenIcon sx={{ fontSize: 17 }} />
          </IconButton>
        </Tooltip>
      ),
    },
  ]

  return (
    <>
      <DataGrid
        title="Roles"
        rows={roles}
        columns={columns}
        loading={loading}
        onAdd={() => setAddOpen(true)}
        addLabel="Add Role"
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
          sx: {
            width: 400,
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        {/* Drawer header */}
        <Box
          sx={{
            px: 2.5,
            py: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              {drawerRole?.name}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Permission assignments
            </Typography>
          </Box>
          <IconButton size="small" onClick={closeDrawer}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Assigned permissions list */}
        <Box sx={{ flex: 1, overflowY: 'auto', px: 2, py: 1.5 }}>
          {drawerLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <>
              <Typography
                variant="caption"
                sx={{ fontWeight: 700, color: 'text.secondary', letterSpacing: '0.06em', textTransform: 'uppercase' }}
              >
                Assigned ({drawerDetail?.permissions?.length ?? 0})
              </Typography>
              <List dense disablePadding sx={{ mt: 0.5 }}>
                {(drawerDetail?.permissions ?? []).length === 0 ? (
                  <Typography sx={{ color: 'text.disabled', fontSize: '0.85rem', py: 1.5 }}>
                    No permissions assigned to this role.
                  </Typography>
                ) : (
                  (drawerDetail?.permissions ?? []).map((perm) => (
                    <ListItem
                      key={perm.id}
                      disableGutters
                      secondaryAction={
                        <Tooltip title="Remove">
                          <IconButton
                            edge="end"
                            size="small"
                            onClick={() => handleRemovePermission(perm.id)}
                          >
                            <DeleteIcon sx={{ fontSize: 16, color: 'error.main' }} />
                          </IconButton>
                        </Tooltip>
                      }
                      sx={{ py: 0.5 }}
                    >
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
                              {perm.key}
                            </Typography>
                            <Chip
                              label={perm.action}
                              size="small"
                              sx={{ height: 18, fontSize: '0.72rem' }}
                            />
                          </Box>
                        }
                        secondary={perm.description || undefined}
                      />
                    </ListItem>
                  ))
                )}
              </List>
            </>
          )}
        </Box>

        <Divider />

        {/* Assign section */}
        <Box sx={{ px: 2.5, py: 2 }}>
          <Typography
            variant="caption"
            sx={{ fontWeight: 700, color: 'text.secondary', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', mb: 1 }}
          >
            Assign Permission
          </Typography>
          <Autocomplete
            size="small"
            options={unassignedPerms}
            getOptionLabel={(p) => p.key}
            value={assignPerm}
            onChange={(_, v) => setAssignPerm(v)}
            renderInput={(params) => (
              <TextField {...params} placeholder="Select a permission…" />
            )}
            isOptionEqualToValue={(opt, val) => opt.id === val.id}
          />
          <Button
            variant="contained"
            size="small"
            fullWidth
            disabled={!assignPerm || assignSaving}
            onClick={handleAssignPermission}
            sx={{ mt: 1.5, textTransform: 'none' }}
          >
            {assignSaving ? 'Assigning…' : 'Assign'}
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
