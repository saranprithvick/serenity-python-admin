import { useMemo, useState } from 'react'
import {
  Box,
  Card,
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
import InboxIcon from '@mui/icons-material/Inbox'
import SearchIcon from '@mui/icons-material/Search'

export default function DataGrid({ rows = [], columns = [], loading }) {
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
    <Card variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
      {/* Toolbar */}
      <Box
        sx={{
          px: 2, py: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
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
          sx={{ width: 280 }}
        />
      </Box>

      {/* Table */}
      <TableContainer sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: 400 }}>
          <TableHead>
            <TableRow>
              {columns.map((col) => (
                <TableCell
                  key={col.field}
                  sx={{
                    width: col.flex ? undefined : col.width,
                    fontWeight: 600,
                    fontSize: '0.8125rem',
                    color: 'text.primary',
                    bgcolor: 'background.default',
                    borderBottom: '2px solid',
                    borderColor: 'divider',
                    py: 1.25,
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
                <TableCell colSpan={columns.length} align="center" sx={{ py: 6, border: 0 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            ) : paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 6, border: 0 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                    <InboxIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
                    <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', color: 'text.primary' }}>
                      No records found
                    </Typography>
                    <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                      {search.trim() ? 'Try adjusting your search' : 'No data available yet'}
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              paged.map((row, i) => (
                <TableRow
                  key={row.id ?? i}
                  sx={{
                    bgcolor: i % 2 === 1 ? 'background.default' : 'background.paper',
                    '&:hover': { bgcolor: 'rgba(249,115,22,0.06)' },
                    '&:last-child td': { border: 0 },
                  }}
                >
                  {columns.map((col) => (
                    <TableCell
                      key={col.field}
                      sx={{
                        width: col.flex ? undefined : col.width,
                        fontSize: '0.875rem',
                        color: 'text.primary',
                        height: 52,
                        py: 0,
                        verticalAlign: 'middle',
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
        sx={{ borderTop: '1px solid', borderColor: 'divider' }}
      />
    </Card>
  )
}
