import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { useTheme } from '@mui/material/styles'

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
}) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogContent sx={{ pt: 3.5, pb: 1, textAlign: 'center' }}>
        <Box
          sx={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            bgcolor: isDark ? 'rgba(239,68,68,0.15)' : '#FEF2F2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 2.5,
          }}
        >
          <WarningAmberIcon sx={{ fontSize: 40, color: '#EF4444' }} />
        </Box>
        <DialogTitle
          component="div"
          sx={{ fontWeight: 700, fontSize: '1.05rem', p: 0, mb: 1, color: 'text.primary', textAlign: 'center' }}
        >
          {title}
        </DialogTitle>
        <DialogContentText sx={{ fontSize: '0.9rem', color: 'text.secondary', textAlign: 'center' }}>
          {message}
        </DialogContentText>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, pt: 1.5, flexDirection: 'column', gap: 1 }}>
        <Button
          onClick={onConfirm}
          variant="contained"
          fullWidth
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            py: 1.25,
            background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
            color: '#fff',
            boxShadow: '0 1px 2px rgba(239,68,68,0.4)',
            '&:hover': {
              background: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
              boxShadow: '0 4px 8px rgba(239,68,68,0.4)',
            },
          }}
        >
          {confirmLabel}
        </Button>
        <Button
          onClick={onClose}
          variant="outlined"
          fullWidth
          sx={{
            textTransform: 'none',
            color: 'text.secondary',
            borderColor: 'divider',
            py: 1.25,
            '&:hover': { borderColor: 'text.disabled', bgcolor: 'action.hover' },
          }}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
}
