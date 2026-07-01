import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material'

export default function FormModal({ open, onClose, title, onSubmit, loading, children }) {
  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      // Prevent accidental close while saving
      disableEscapeKeyDown={loading}
    >
      <DialogTitle sx={{ fontWeight: 600, fontSize: '1rem', pb: 1 }}>{title}</DialogTitle>

      <form onSubmit={onSubmit}>
        <DialogContent sx={{ pt: 1 }}>{children}</DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={onClose} disabled={loading} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={14} sx={{ color: 'inherit' }} /> : null}
            sx={{ textTransform: 'none', minWidth: 80 }}
          >
            {loading ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
