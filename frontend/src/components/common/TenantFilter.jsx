import { useEffect, useState } from 'react'
import { Box, FormControl, InputLabel, MenuItem, Select } from '@mui/material'
import api from '../../api/axios'

export default function TenantFilter({ selectedTenant, onChange, show }) {
  const [tenants, setTenants] = useState([])

  useEffect(() => {
    if (!show) return
    api.get('/api/tenants/').then((res) => {
      const list = res.data.results ?? res.data
      setTenants([...list].sort((a, b) => a.id - b.id))
    }).catch(() => {})
  }, [show])

  if (!show) return null

  return (
    <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
      <FormControl size="small" sx={{ width: 240 }}>
        <InputLabel>Filter by Tenant</InputLabel>
        <Select
          label="Filter by Tenant"
          value={selectedTenant}
          onChange={(e) => onChange(e.target.value)}
        >
          <MenuItem value="all">All Tenants</MenuItem>
          {tenants.map((t) => (
            <MenuItem key={t.id} value={t.id}>{t.id} — {t.name}</MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  )
}
