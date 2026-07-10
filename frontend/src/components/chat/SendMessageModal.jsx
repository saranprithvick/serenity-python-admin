import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import CloseIcon from '@mui/icons-material/Close'
import SendIcon from '@mui/icons-material/Send'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'

export default function SendMessageModal({ open, onClose, patient, onSuccess }) {
  const { user } = useAuth()
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)

  const senderName =
    [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim() || user?.email || ''

  const reset = () => {
    setSubject('')
    setMessage('')
    setError(null)
  }

  const handleClose = () => {
    if (sending) return
    reset()
    onClose()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!subject.trim() || !message.trim()) return
    setSending(true)
    setError(null)
    try {
      await api.post(`/api/chat/patients/${patient.id}/send-message/`, {
        subject: subject.trim(),
        message: message.trim(),
      })
      reset()
      onSuccess?.()
      onClose()
    } catch (err) {
      const status = err.response?.status
      if (status === 400) {
        setError(err.response?.data?.error || 'This patient has no email address')
      } else if (status === 403) {
        setError("You don't have permission to send messages")
      } else {
        setError('Failed to send message. Please check your connection.')
      }
    } finally {
      setSending(false)
    }
  }

  if (!patient) return null

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      {/* Header */}
      <DialogTitle sx={{ pb: 1.5, pr: 6, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography component="div" sx={{ fontWeight: 700, fontSize: '1.1rem', color: 'text.primary' }}>
          Send Message
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
            To: <strong style={{ color: theme.palette.text.primary }}>{patient.full_name}</strong>
          </Typography>
          <Chip
            label={patient.email}
            size="small"
            sx={{
              bgcolor: isDark ? 'rgba(34,197,94,0.15)' : '#F0FDF4',
              color: isDark ? '#4ADE80' : '#16A34A',
              fontWeight: 600,
              fontSize: 12,
              height: 22,
            }}
          />
        </Box>
        <IconButton
          onClick={handleClose}
          disabled={sending}
          size="small"
          sx={{
            position: 'absolute', top: 14, right: 14,
            color: 'text.secondary',
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ pt: 2.5 }}>
          <Stack spacing={2.5}>
            {error && (
              <Alert severity="error" sx={{ fontSize: 13 }}>
                {error}
              </Alert>
            )}

            {/* Subject */}
            <Box>
              <TextField
                label="Subject"
                placeholder="e.g. Prescription, Follow-up, Appointment reminder"
                required
                fullWidth
                size="small"
                value={subject}
                onChange={(e) => setSubject(e.target.value.slice(0, 200))}
                inputProps={{ maxLength: 200 }}
                disabled={sending}
              />
              <Typography sx={{ fontSize: 11, color: 'text.disabled', textAlign: 'right', mt: 0.5 }}>
                {subject.length}/200
              </Typography>
            </Box>

            {/* Message */}
            <Box>
              <TextField
                label="Message"
                placeholder="Write your message to the patient here..."
                required
                fullWidth
                multiline
                rows={6}
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 5000))}
                inputProps={{ maxLength: 5000 }}
                disabled={sending}
              />
              <Typography sx={{ fontSize: 11, color: 'text.disabled', textAlign: 'right', mt: 0.5 }}>
                {message.length}/5000
              </Typography>
            </Box>

            {/* Info box */}
            <Alert
              severity="info"
              sx={{
                fontSize: 13,
                bgcolor: isDark ? 'rgba(59,130,246,0.1)' : '#EFF6FF',
                color: 'text.secondary',
                border: '1px solid',
                borderColor: isDark ? 'rgba(59,130,246,0.25)' : 'rgba(59,130,246,0.2)',
                '& .MuiAlert-icon': { color: '#3B82F6' },
                '& strong': { color: 'text.primary' },
              }}
            >
              This message will be sent to <strong>{patient.email}</strong> and stored in the
              patient's record.
            </Alert>
          </Stack>
        </DialogContent>

        {/* Footer */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            px: 3,
            py: 2,
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
            Sending as {senderName}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              onClick={handleClose}
              disabled={sending}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                color: 'text.secondary',
                borderColor: 'divider',
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={sending || !subject.trim() || !message.trim()}
              startIcon={
                sending
                  ? <CircularProgress size={16} sx={{ color: 'inherit' }} />
                  : <SendIcon />
              }
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                background: 'linear-gradient(135deg, #F97316, #EA6C0A)',
                '&:hover': { background: 'linear-gradient(135deg, #EA6C0A, #D96309)' },
                '&.Mui-disabled': {
                  background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.12)',
                  color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.26)',
                },
              }}
            >
              {sending ? 'Sending...' : 'Send Message'}
            </Button>
          </Box>
        </Box>
      </form>
    </Dialog>
  )
}
