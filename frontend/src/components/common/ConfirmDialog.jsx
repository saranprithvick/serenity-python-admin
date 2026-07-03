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

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogContent sx={{ pt: 3, pb: 1, textAlign: 'center' }}>
        <Box sx={{ mb: 2 }}>
          <WarningAmberIcon sx={{ fontSize: 48, color: '#F97316' }} />
        </Box>
        <DialogTitle
          component="div"
          sx={{ fontWeight: 700, fontSize: '1rem', p: 0, mb: 1, color: 'text.primary' }}
        >
          {title}
        </DialogTitle>
        <DialogContentText sx={{ fontSize: '0.9rem', color: 'text.secondary' }}>
          {message}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1, justifyContent: 'center' }}>
        <Button
          onClick={onClose}
          variant="outlined"
          sx={{
            textTransform: 'none',
            color: 'text.secondary',
            borderColor: 'divider',
            '&:hover': { borderColor: 'text.disabled', bgcolor: 'action.hover' },
          }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={onConfirm}
          sx={{
            textTransform: 'none',
            bgcolor: '#EF4444',
            fontWeight: 600,
            '&:hover': { bgcolor: '#DC2626' },
          }}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
