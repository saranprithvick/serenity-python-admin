import { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import SearchIcon from '@mui/icons-material/Search'

export default function DataGrid({ rows = [], columns = [], loading, onAdd, addLabel = 'Add', title }) {
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter(row =>
      Object.values(row).some(v => String(v ?? '').toLowerCase().includes(q))
    )
  }, [rows, search])

  const paged = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)

  const handleSearchChange = (e) => {
    setSearch(e.target.value)
    setPage(0)
  }

  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      {/* Header row */}
      <Box
        sx={{
          px: 2.5,
          pt: 2,
          pb: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem', color: '#1e2a3b' }}>
          {title}
        </Typography>
        {onAdd && (
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon sx={{ fontSize: '1rem !important' }} />}
            onClick={onAdd}
            sx={{ textTransform: 'none', fontSize: '0.82rem' }}
          >
            {addLabel}
          </Button>
        )}
      </Box>

      <CardContent sx={{ pt: 0, pb: '8px !important' }}>
        {/* Search bar */}
        <TextField
          size="small"
          placeholder="Search…"
          value={search}
          onChange={handleSearchChange}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{ mb: 1.5, width: 260 }}
        />

        {/* Table */}
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 400 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f8fafc' }}>
                {columns.map((col) => (
                  <TableCell
                    key={col.field}
                    sx={{
                      width: col.flex ? undefined : col.width,
                      ...(col.flex ? { flex: col.flex } : {}),
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      color: 'text.secondary',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      py: 1,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {col.headerName}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={columns.length} align="center" sx={{ py: 5, border: 0 }}>
                    <CircularProgress size={28} />
                  </TableCell>
                </TableRow>
              ) : paged.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    align="center"
                    sx={{ py: 5, color: 'text.disabled', fontSize: '0.85rem', border: 0 }}
                  >
                    No records found
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((row, i) => (
                  <TableRow
                    key={row.id ?? i}
                    hover
                    sx={{ '&:last-child td': { border: 0 } }}
                  >
                    {columns.map((col) => (
                      <TableCell
                        key={col.field}
                        sx={{
                          width: col.flex ? undefined : col.width,
                          py: 0.875,
                          fontSize: '0.85rem',
                          color: '#374151',
                        }}
                      >
                        {col.renderCell
                          ? col.renderCell({ row, value: row[col.field] })
                          : (row[col.field] ?? '—')}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={filtered.length}
          page={page}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[10, 25, 50]}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10))
            setPage(0)
          }}
          sx={{ borderTop: '1px solid', borderColor: 'divider', mt: 0.5 }}
        />
      </CardContent>
    </Card>
  )
}
