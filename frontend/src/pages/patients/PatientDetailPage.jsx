import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Alert,
  Avatar,
  Badge,
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Link,
  Paper,
  Skeleton,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import BlockIcon from '@mui/icons-material/Block'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ContactsIcon from '@mui/icons-material/Contacts'
import EditIcon from '@mui/icons-material/Edit'
import EmailIcon from '@mui/icons-material/Email'
import ErrorIcon from '@mui/icons-material/Error'
import FlashOnIcon from '@mui/icons-material/FlashOn'
import HomeIcon from '@mui/icons-material/Home'
import InfoIcon from '@mui/icons-material/Info'
import LocationOnIcon from '@mui/icons-material/LocationOn'
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead'
import NotesIcon from '@mui/icons-material/Notes'
import PhoneIcon from '@mui/icons-material/Phone'
import { useTheme } from '@mui/material/styles'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import FormModal from '../../components/common/FormModal'
import SendMessageModal from '../../components/chat/SendMessageModal'

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

const formatMessageDate = (iso) => {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// Self-contained per-message item — manages its own expand state
function MessageItem({ msg }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = msg.message.length > 200

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        mb: 1.5,
      }}
    >
      {/* Row 1: sender + date + delivery chip */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Avatar sx={{ width: 32, height: 32, bgcolor: '#F97316', fontSize: 13, fontWeight: 700 }}>
            {getInitials(msg.sent_by_name || '?')}
          </Avatar>
          <Typography sx={{ fontWeight: 600, fontSize: 14 }}>
            {msg.sent_by_name || 'Unknown'}
          </Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: 12 }}>•</Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
            {formatMessageDate(msg.sent_at)}
          </Typography>
        </Box>
        {msg.is_delivered ? (
          <Chip
            label="Delivered"
            size="small"
            icon={<CheckCircleIcon sx={{ fontSize: '14px !important', color: '#16A34A !important' }} />}
            sx={{ bgcolor: '#DCFCE7', color: '#16A34A', fontWeight: 600, fontSize: 11, height: 22 }}
          />
        ) : (
          <Chip
            label="Failed"
            size="small"
            icon={<ErrorIcon sx={{ fontSize: '14px !important', color: '#DC2626 !important' }} />}
            sx={{ bgcolor: '#FEE2E2', color: '#DC2626', fontWeight: 600, fontSize: 11, height: 22 }}
          />
        )}
      </Box>

      {/* Row 2: subject */}
      <Typography sx={{ fontWeight: 600, fontSize: 14, color: 'text.primary', mb: 0.75 }}>
        {msg.subject}
      </Typography>

      {/* Row 3: message body */}
      <Box
        sx={{
          maxHeight: expanded ? 'none' : 80,
          overflow: 'hidden',
        }}
      >
        <Typography sx={{ fontSize: 13, color: 'text.secondary', lineHeight: 1.6 }}>
          {msg.message}
        </Typography>
      </Box>
      {isLong && (
        <Button
          size="small"
          variant="text"
          onClick={() => setExpanded((v) => !v)}
          sx={{
            fontSize: 12, color: '#F97316', textTransform: 'none', p: 0, mt: 0.5,
            minWidth: 0, '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
          }}
        >
          {expanded ? 'Show less' : 'Show more'}
        </Button>
      )}

      {/* Row 4: delivery error */}
      {msg.delivery_error && (
        <Typography sx={{ fontSize: 12, color: '#DC2626', mt: 1 }}>
          Delivery failed: {msg.delivery_error}
        </Typography>
      )}
    </Paper>
  )
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
  const [sendMessageOpen, setSendMessageOpen] = useState(false)
  const [activeTab, setActiveTab] = useState(0)
  const [messages, setMessages] = useState([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success', duration: 3000 })

  const showToast = (message, severity = 'success', duration = 3000) =>
    setToast({ open: true, message, severity, duration })

  const loadPatient = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/api/patients/${id}/`)
      setPatient(res.data)
    } catch (err) {
      if (err.response?.status === 404) {
        navigate('/not-found', { replace: true })
      }
    } finally {
      setLoading(false)
    }
  }

  const loadMessages = async () => {
    setMessagesLoading(true)
    try {
      const res = await api.get(`/api/chat/patients/${id}/messages/`)
      setMessages(Array.isArray(res.data) ? res.data : (res.data.results ?? []))
    } catch {
      setMessages([])
    } finally {
      setMessagesLoading(false)
    }
  }

  useEffect(() => {
    loadPatient()
    loadMessages()
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

  const handleSendMessageSuccess = () => {
    loadMessages()
    if (patient) showToast(`✅ Message sent to ${patient.email}`, 'success', 5000)
    setActiveTab(1)
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
  const canSendMessage = hasPermission('Patient:SendMessage')
  const hasEmail = Boolean(patient.email)

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
          sx={{ fontSize: 13, color: 'text.secondary', cursor: 'pointer', background: 'none', border: 'none', p: 0 }}
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
              sx={{ bgcolor: isDark ? 'rgba(249,115,22,0.15)' : '#FFF7ED', color: '#F97316', fontWeight: 600, fontSize: 12, mt: 0.75, height: 22 }}
            />
            {isSuperuser && patient.tenant_name && (
              <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.75 }}>
                {patient.tenant_name}
              </Typography>
            )}
          </Box>

          {/* Status + action buttons */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, alignItems: 'flex-end', flexShrink: 0 }}>
            {statusChip(patient.is_active)}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {/* Send Message button */}
              {canSendMessage && (
                hasEmail ? (
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<EmailIcon />}
                    onClick={() => setSendMessageOpen(true)}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 600,
                      borderRadius: 2,
                      background: 'linear-gradient(135deg, #F97316, #EA6C0A)',
                      color: '#fff',
                      boxShadow: 'none',
                      '&:hover': { background: 'linear-gradient(135deg, #EA6C0A, #D96309)', boxShadow: 'none' },
                    }}
                  >
                    Send Message
                  </Button>
                ) : (
                  <Tooltip
                    title="No email address on record. Update patient contact details first."
                    arrow
                    placement="top"
                  >
                    <span>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<EmailIcon />}
                        disabled
                        sx={{
                          textTransform: 'none',
                          fontWeight: 600,
                          borderRadius: 2,
                          borderColor: 'divider',
                          color: 'text.disabled',
                        }}
                      >
                        Send Message
                      </Button>
                    </span>
                  </Tooltip>
                )
              )}

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

      {/* Tabs: Overview | Message History */}
      <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{
            '& .MuiTabs-indicator': { bgcolor: '#F97316' },
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: 14 },
            '& .Mui-selected': { color: '#F97316 !important' },
          }}
        >
          <Tab label="Overview" value={0} />
          <Tab
            value={1}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <MarkEmailReadIcon sx={{ fontSize: 16 }} />
                <span>Message History</span>
                {messages.length > 0 && (
                  <Badge
                    badgeContent={messages.length}
                    sx={{
                      ml: 1,
                      '& .MuiBadge-badge': {
                        bgcolor: '#F97316',
                        color: '#fff',
                        fontSize: 10,
                        fontWeight: 700,
                        minWidth: 18,
                        height: 18,
                        position: 'static',
                        transform: 'none',
                      },
                    }}
                  >
                    <span />
                  </Badge>
                )}
              </Box>
            }
          />
        </Tabs>
      </Box>

      {/* Tab 0: Overview — existing two-column layout */}
      {activeTab === 0 && (
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
                      borderBottom: i < contactRows.length - 1 ? '1px solid' : 'none',
                      borderColor: 'divider',
                      alignItems: 'flex-start',
                    }}
                  >
                    <Box sx={{ color: 'text.secondary', display: 'flex', flexShrink: 0, mt: 0.15 }}>
                      {icon}
                    </Box>
                    <Typography sx={{ fontSize: 14, color: value ? 'text.primary' : 'text.secondary' }}>
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
                  <Typography sx={{ fontSize: 14, lineHeight: 1.8, color: 'text.secondary' }}>
                    {patient.notes}
                  </Typography>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 3 }}>
                    <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>
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
                      py: 1.5, borderBottom: '1px solid', borderColor: 'divider',
                    }}
                  >
                    <Typography sx={{ fontSize: 13, color: 'text.secondary', fontWeight: 500 }}>{label}</Typography>
                    <Typography sx={{ fontSize: 13, color: 'text.primary', fontWeight: 600 }}>{value}</Typography>
                  </Box>
                ))}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5 }}>
                  <Typography sx={{ fontSize: 13, color: 'text.secondary', fontWeight: 500 }}>Status</Typography>
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
                  {canSendMessage && hasEmail && (
                    <Button
                      variant="outlined"
                      fullWidth
                      startIcon={<EmailIcon />}
                      onClick={() => setSendMessageOpen(true)}
                      sx={{
                        textTransform: 'none', fontWeight: 600, justifyContent: 'flex-start',
                        borderColor: '#F97316', color: '#F97316', borderRadius: 2,
                        '&:hover': { bgcolor: '#FFF7ED', borderColor: '#EA6C0A' },
                      }}
                    >
                      Send Message
                    </Button>
                  )}
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
                      borderColor: 'divider', color: 'text.secondary', borderRadius: 2,
                    }}
                  >
                    Back to Patients
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Box>
        </Box>
      )}

      {/* Tab 1: Message History */}
      {activeTab === 1 && (
        <Box>
          {messagesLoading ? (
            // Loading skeletons
            [0, 1, 2].map((i) => (
              <Skeleton key={i} variant="rounded" height={110} sx={{ borderRadius: 2, mb: 1.5 }} />
            ))
          ) : messages.length === 0 ? (
            // Empty state
            <Box sx={{ textAlign: 'center', py: 10 }}>
              <EmailIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography sx={{ fontWeight: 600, fontSize: 16, color: 'text.primary', mb: 1 }}>
                No messages sent yet
              </Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: 14, mb: 3, maxWidth: 340, mx: 'auto' }}>
                Use Send Message to communicate with this patient via email
              </Typography>
              {canSendMessage && hasEmail && (
                <Button
                  variant="contained"
                  startIcon={<EmailIcon />}
                  onClick={() => setSendMessageOpen(true)}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    background: 'linear-gradient(135deg, #F97316, #EA6C0A)',
                    '&:hover': { background: 'linear-gradient(135deg, #EA6C0A, #D96309)' },
                  }}
                >
                  Send Message
                </Button>
              )}
            </Box>
          ) : (
            // Message list
            messages.map((msg) => <MessageItem key={msg.id} msg={msg} />)
          )}
        </Box>
      )}

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

      {/* Send Message Modal */}
      <SendMessageModal
        open={sendMessageOpen}
        onClose={() => setSendMessageOpen(false)}
        patient={patient}
        onSuccess={handleSendMessageSuccess}
      />

      {/* Toast notifications */}
      <Snackbar
        open={toast.open}
        autoHideDuration={toast.duration}
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
