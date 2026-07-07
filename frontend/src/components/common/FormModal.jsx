import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'

export default function FormModal({ open, onClose, title, onSubmit, loading, children }) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

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
          background: isDark
            ? 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)'
            : 'linear-gradient(135deg, #F8FAFC 0%, #FFFFFF 100%)',
          borderLeft: '4px solid #F97316',
          pl: '20px',
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
              borderRadius: 2,
              fontWeight: 600,
              px: 3,
              py: 1.5,
            }}
          >
            {loading ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
