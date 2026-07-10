import { Avatar, Box, Card, List, ListItem, Skeleton, Typography } from '@mui/material'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import PersonIcon from '@mui/icons-material/Person'
import { timeAgo } from '../../utils/timeAgo'

export default function ActivityFeed({ activities = [], loading = false, showTenant = false }) {
  return (
    <Card>
      <Box sx={{ px: 2.5, pt: 2.5, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography sx={{ fontSize: 15, fontWeight: 600, color: 'text.primary' }}>Team Activity</Typography>
        <Typography
          component="a"
          href="#"
          onClick={(e) => e.preventDefault()}
          sx={{ fontSize: 12, color: '#F97316', textDecoration: 'none', fontWeight: 500, '&:hover': { textDecoration: 'underline' } }}
        >
          View all
        </Typography>
      </Box>

      {loading ? (
        <Box sx={{ px: 2.5, pb: 2 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
              <Skeleton variant="circular" width={36} height={36} />
              <Box sx={{ flex: 1 }}>
                <Skeleton width="80%" height={16} />
                <Skeleton width="50%" height={13} sx={{ mt: 0.5 }} />
              </Box>
            </Box>
          ))}
        </Box>
      ) : activities.length === 0 ? (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>No recent activity</Typography>
        </Box>
      ) : (
        <List dense disablePadding sx={{ px: 1.5, pb: 1.5 }}>
          {activities.map((item, i) => (
            <ListItem
              key={i}
              disablePadding
              sx={{ py: 0.75, display: 'flex', alignItems: 'flex-start', gap: 1.5 }}
            >
              <Avatar
                sx={{
                  width: 36,
                  height: 36,
                  bgcolor: item.type === 'user_created' ? '#3B82F6' : '#10B981',
                  flexShrink: 0,
                }}
              >
                {item.type === 'user_created'
                  ? <PersonAddIcon sx={{ fontSize: 18 }} />
                  : <PersonIcon sx={{ fontSize: 18 }} />}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  sx={{ fontSize: 13, fontWeight: 500, color: 'text.primary', lineHeight: 1.4, wordBreak: 'break-word' }}
                >
                  {item.description}
                </Typography>
                {showTenant && (
                  <Typography sx={{ fontSize: 11, color: 'text.secondary', lineHeight: 1.3 }}>
                    {item.tenant}
                  </Typography>
                )}
              </Box>
              <Typography sx={{ fontSize: 11, color: 'text.disabled', flexShrink: 0, pt: 0.2 }}>
                {timeAgo(item.time)}
              </Typography>
            </ListItem>
          ))}
        </List>
      )}
    </Card>
  )
}
