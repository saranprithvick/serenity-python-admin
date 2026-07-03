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
      disableEscapeKeyDown={loading}
    >
      <DialogTitle
        sx={{
          fontWeight: 700,
          fontSize: '1.125rem',
          borderBottom: '1px solid',
          borderColor: 'divider',
          pb: 2,
        }}
      >
        {title}
      </DialogTitle>

      <form onSubmit={onSubmit}>
        <DialogContent sx={{ pt: 2.5 }}>{children}</DialogContent>

        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid', borderColor: 'divider', gap: 1 }}>
          <Button
            onClick={onClose}
            disabled={loading}
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
            type="submit"
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={14} sx={{ color: 'inherit' }} /> : null}
            sx={{
              textTransform: 'none',
              minWidth: 80,
              bgcolor: '#F97316',
              borderRadius: 2,
              fontWeight: 600,
              '&:hover': { bgcolor: '#EA6C0A' },
            }}
          >
            {loading ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
