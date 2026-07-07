import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Link,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import BlockIcon from '@mui/icons-material/Block'
import ContactsIcon from '@mui/icons-material/Contacts'
import EditIcon from '@mui/icons-material/Edit'
import EmailIcon from '@mui/icons-material/Email'
import FlashOnIcon from '@mui/icons-material/FlashOn'
import HomeIcon from '@mui/icons-material/Home'
import InfoIcon from '@mui/icons-material/Info'
import LocationOnIcon from '@mui/icons-material/LocationOn'
import NotesIcon from '@mui/icons-material/Notes'
import PhoneIcon from '@mui/icons-material/Phone'
import { useTheme } from '@mui/material/styles'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import FormModal from '../../components/common/FormModal'

const EMPTY_EDIT = {
  firstName: '', lastName: '', email: '', phone: '',
  specialisation: '', city: '', country: '', address: '', notes: '',
}

const getInitials = (name) => {
  if (!name) return '?'
  const parts = name.trim().split(' ')
  return parts.length === 1
    ? parts[0][0].toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const formatDate = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function PatientDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, hasPermission } = useAuth()
  const isSuperuser = user?.is_superuser === true
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const [patient, setPatient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState(EMPTY_EDIT)
  const [saving, setSaving] = useState(false)
  const [deactivateOpen, setDeactivateOpen] = useState(false)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  const showToast = (message, severity = 'success') =>
    setToast({ open: true, message, severity })

  const loadPatient = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/api/patients/${id}/`)
      setPatient(res.data)
    } catch (err) {
      if (err.response?.status === 404) {
        navigate('/not-found', { replace: true })
      }
      // 403 is handled globally by the axios interceptor → /forbidden
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPatient()
  }, [id])

  const openEdit = () => {
    if (!patient) return
    setEditForm({
      firstName: patient.first_name ?? '',
      lastName: patient.last_name ?? '',
      email: patient.email ?? '',
      phone: patient.phone ?? '',
      specialisation: patient.specialisation ?? '',
      city: patient.city ?? '',
      country: patient.country ?? '',
      address: patient.address ?? '',
      notes: patient.notes ?? '',
    })
    setEditOpen(true)
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.put(`/api/patients/${id}/`, {
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
      setEditOpen(false)
      showToast('Patient updated successfully')
      loadPatient()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to update patient', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async () => {
    try {
      await api.delete(`/api/patients/${id}/`)
      setDeactivateOpen(false)
      showToast('Patient deactivated')
      loadPatient()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to deactivate patient', 'error')
      setDeactivateOpen(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress sx={{ color: '#F97316' }} />
      </Box>
    )
  }

  if (!patient) return null

  const initials = getInitials(patient.full_name)

  const statusChip = (active) => (
    <Chip
      label={active ? 'Active' : 'Inactive'}
      size="small"
      sx={{
        bgcolor: active
          ? (isDark ? 'rgba(34,197,94,0.15)' : '#DCFCE7')
          : (isDark ? 'rgba(239,68,68,0.15)' : '#FEE2E2'),
        color: active
          ? (isDark ? '#4ADE80' : '#16A34A')
          : (isDark ? '#F87171' : '#DC2626'),
        fontWeight: 600,
        fontSize: '0.78rem',
        height: 24,
      }}
    />
  )

  // Reusable card header (called as a function, not a component, to avoid reconciliation issues)
  const sectionHeader = (icon, title) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2.5, pt: 2.5, pb: 1.5 }}>
      {icon}
      <Typography sx={{ fontWeight: 600, fontSize: 15, color: 'text.primary' }}>{title}</Typography>
    </Box>
  )

  const contactRows = [
    { icon: <EmailIcon sx={{ fontSize: 20 }} />, value: patient.email },
    { icon: <PhoneIcon sx={{ fontSize: 20 }} />, value: patient.phone },
    {
      icon: <LocationOnIcon sx={{ fontSize: 20 }} />,
      value: [patient.city, patient.country].filter(Boolean).join(', ') || null,
    },
    { icon: <HomeIcon sx={{ fontSize: 20 }} />, value: patient.address },
  ]

  return (
    <>
      {/* Breadcrumb */}
      <Breadcrumbs sx={{ mb: 2, fontSize: 13 }}>
        <Link
          component="button"
          underline="hover"
          onClick={() => navigate('/patients')}
          sx={{ fontSize: 13, color: '#718096', cursor: 'pointer', background: 'none', border: 'none', p: 0 }}
        >
          Patients
        </Link>
        <Typography sx={{ fontSize: 13, color: 'text.primary' }}>
          {patient.full_name}
        </Typography>
      </Breadcrumbs>

      {/* Patient header card */}
      <Card sx={{ mb: 3 }}>
        <CardContent
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            p: 3,
            flexWrap: 'wrap',
            '&:last-child': { pb: 3 },
          }}
        >
          {/* Avatar */}
          <Box
            sx={{
              width: 64, height: 64, borderRadius: '50%', bgcolor: '#F97316',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >
            <Typography sx={{ fontSize: 22, fontWeight: 700, color: '#fff', lineHeight: 1 }}>
              {initials}
            </Typography>
          </Box>

          {/* Name + condition + tenant */}
          <Box sx={{ flex: 1, minWidth: 180 }}>
            <Typography sx={{ fontSize: 24, fontWeight: 700, color: 'text.primary', lineHeight: 1.2 }}>
              {patient.full_name}
            </Typography>
            <Chip
              label={patient.specialisation || 'No condition recorded'}
              size="small"
              sx={{ bgcolor: '#FFF7ED', color: '#F97316', fontWeight: 600, fontSize: 12, mt: 0.75, height: 22 }}
            />
            {isSuperuser && patient.tenant_name && (
              <Typography sx={{ fontSize: 13, color: '#718096', mt: 0.75 }}>
                {patient.tenant_name}
              </Typography>
            )}
          </Box>

          {/* Status + action buttons */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, alignItems: 'flex-end', flexShrink: 0 }}>
            {statusChip(patient.is_active)}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {hasPermission('Patient:Update') && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<EditIcon />}
                  onClick={openEdit}
                  sx={{
                    borderColor: '#F97316', color: '#F97316', textTransform: 'none', fontWeight: 600, borderRadius: 2,
                    '&:hover': { borderColor: '#EA6C0A', bgcolor: '#FFF7ED' },
                  }}
                >
                  Edit
                </Button>
              )}
              {patient.is_active && hasPermission('Patient:Delete') && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<BlockIcon />}
                  onClick={() => setDeactivateOpen(true)}
                  sx={{
                    borderColor: '#EF4444', color: '#EF4444', textTransform: 'none', fontWeight: 600, borderRadius: 2,
                    '&:hover': { borderColor: '#DC2626', bgcolor: '#FEF2F2' },
                  }}
                >
                  Deactivate
                </Button>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Two-column information layout */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '7fr 5fr' }, gap: 3 }}>

        {/* Left column */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

          {/* Contact Information */}
          <Card>
            {sectionHeader(
              <ContactsIcon sx={{ color: '#F97316', fontSize: 18 }} />,
              'Contact Information',
            )}
            <Divider />
            <CardContent sx={{ px: 2.5, pt: 0.5, pb: 1, '&:last-child': { pb: 1.5 } }}>
              {contactRows.map(({ icon, value }, i) => (
                <Box
                  key={i}
                  sx={{
                    display: 'flex',
                    gap: '12px',
                    py: '12px',
                    borderBottom: i < contactRows.length - 1 ? '1px solid #F1F5F9' : 'none',
                    alignItems: 'flex-start',
                  }}
                >
                  <Box sx={{ color: '#9CA3AF', display: 'flex', flexShrink: 0, mt: 0.15 }}>
                    {icon}
                  </Box>
                  <Typography sx={{ fontSize: 14, color: value ? 'text.primary' : '#9CA3AF' }}>
                    {value || 'Not provided'}
                  </Typography>
                </Box>
              ))}
            </CardContent>
          </Card>

          {/* Clinical Notes */}
          <Card>
            {sectionHeader(
              <NotesIcon sx={{ color: '#F97316', fontSize: 18 }} />,
              'Clinical Notes',
            )}
            <Divider />
            <CardContent sx={{ px: 2.5, pt: 1.5, pb: 2.5, '&:last-child': { pb: 2.5 } }}>
              {patient.notes ? (
                <Typography sx={{ fontSize: 14, lineHeight: 1.8, color: isDark ? '#CBD5E0' : '#4A5568' }}>
                  {patient.notes}
                </Typography>
              ) : (
                <Box sx={{ textAlign: 'center', py: 3 }}>
                  <Typography sx={{ color: '#9CA3AF', fontSize: 13 }}>
                    No clinical notes recorded
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>

        {/* Right column */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

          {/* Record Details */}
          <Card>
            {sectionHeader(
              <InfoIcon sx={{ color: '#F97316', fontSize: 18 }} />,
              'Record Details',
            )}
            <Divider />
            <CardContent sx={{ px: 2.5, pt: 0.5, pb: 0.5, '&:last-child': { pb: 1 } }}>
              {[
                { label: 'Patient ID', value: `#${patient.id}` },
                ...(isSuperuser && patient.tenant_name
                  ? [{ label: 'Tenant', value: patient.tenant_name }]
                  : []),
                { label: 'Created', value: formatDate(patient.created_at) },
                { label: 'Last Updated', value: formatDate(patient.updated_at) },
              ].map(({ label, value }) => (
                <Box
                  key={label}
                  sx={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    py: 1.5, borderBottom: '1px solid #F1F5F9',
                  }}
                >
                  <Typography sx={{ fontSize: 13, color: '#718096', fontWeight: 500 }}>{label}</Typography>
                  <Typography sx={{ fontSize: 13, color: 'text.primary', fontWeight: 600 }}>{value}</Typography>
                </Box>
              ))}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5 }}>
                <Typography sx={{ fontSize: 13, color: '#718096', fontWeight: 500 }}>Status</Typography>
                {statusChip(patient.is_active)}
              </Box>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            {sectionHeader(
              <FlashOnIcon sx={{ color: '#F97316', fontSize: 18 }} />,
              'Quick Actions',
            )}
            <Divider />
            <CardContent sx={{ px: 2.5, py: 2, '&:last-child': { pb: 2 } }}>
              <Stack spacing={1}>
                {hasPermission('Patient:Update') && (
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<EditIcon />}
                    onClick={openEdit}
                    sx={{
                      textTransform: 'none', fontWeight: 600, justifyContent: 'flex-start',
                      borderColor: 'divider', color: 'text.primary', borderRadius: 2,
                    }}
                  >
                    Edit Patient Details
                  </Button>
                )}
                {patient.is_active && hasPermission('Patient:Delete') && (
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<BlockIcon />}
                    onClick={() => setDeactivateOpen(true)}
                    sx={{
                      textTransform: 'none', fontWeight: 600, justifyContent: 'flex-start',
                      borderColor: '#EF4444', color: '#EF4444', borderRadius: 2,
                      '&:hover': { bgcolor: '#FEF2F2', borderColor: '#DC2626' },
                    }}
                  >
                    Deactivate Patient
                  </Button>
                )}
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<ArrowBackIcon />}
                  onClick={() => navigate('/patients')}
                  sx={{
                    textTransform: 'none', fontWeight: 600, justifyContent: 'flex-start',
                    borderColor: 'divider', color: '#718096', borderRadius: 2,
                  }}
                >
                  Back to Patients
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Edit Modal */}
      <FormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={`Edit — ${patient.full_name}`}
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

      {/* Deactivate confirm */}
      <ConfirmDialog
        open={deactivateOpen}
        onClose={() => setDeactivateOpen(false)}
        onConfirm={handleDeactivate}
        title="Deactivate Patient"
        message={`Are you sure you want to deactivate ${patient.full_name}?`}
        confirmLabel="Deactivate"
      />

      {/* Toast notifications */}
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
