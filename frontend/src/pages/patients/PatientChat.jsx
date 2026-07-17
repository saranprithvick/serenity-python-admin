import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Box, Typography, TextField, IconButton,
  Avatar, CircularProgress, Alert, Paper,
  Divider, Chip, Tooltip
} from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '@mui/material/styles'

const getSessionKey = () => {
  const cookies = document.cookie.split(';')
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=')
    if (name.trim() === 'sessionid') return value
  }
  return null
}

export default function PatientChat({ patient }) {
  const { user } = useAuth()
  const theme = useTheme()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [status, setStatus] = useState('connecting')
  const [error, setError] = useState(null)
  const wsRef = useRef(null)
  const bottomRef = useRef(null)
  const reconnectTimer = useRef(null)
  const mountedRef = useRef(true)
  const reconnectDelay = useRef(1000)

  const scrollToBottom = () => {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({
        behavior: 'smooth'
      })
    }, 100)
  }

  const cleanup = () => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current)
      reconnectTimer.current = null
    }
    if (wsRef.current) {
      const ws = wsRef.current
      wsRef.current = null
      ws.onopen = null
      ws.onmessage = null
      ws.onclose = null
      ws.onerror = null
      if (ws.readyState === WebSocket.OPEN ||
          ws.readyState === WebSocket.CONNECTING) {
        ws.close(1000, 'cleanup')
      }
    }
  }

  const connect = useCallback(() => {
    if (!mountedRef.current) return
    if (!patient?.id) return

    // Don't create new connection if one exists
    if (wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
       wsRef.current.readyState === WebSocket.CONNECTING)) {
      return
    }

    setStatus('connecting')
    setError(null)

    const sessionKey = getSessionKey()
    if (!sessionKey) {
      setStatus('offline')
      setError('Session not found. Please refresh.')
      return
    }

    const protocol = window.location.protocol
      === 'https:' ? 'wss' : 'ws'
    const wsUrl = (
      `${protocol}://127.0.0.1:8000` +
      `/ws/chat/patient/${patient.id}/` +
      `?session_key=${encodeURIComponent(sessionKey)}`
    )

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      if (!mountedRef.current) {
        ws.close(1000, 'unmounted')
        return
      }
      setStatus('live')
      setError(null)
      reconnectDelay.current = 1000
    }

    ws.onmessage = (event) => {
      if (!mountedRef.current) return
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'history') {
          setMessages(data.messages || [])
          scrollToBottom()
        } else if (data.type === 'message') {
          setMessages(prev => [...prev, data])
          scrollToBottom()
        } else if (data.type === 'error') {
          setError(data.message)
        }
      } catch {
        // ignore parse errors
      }
    }

    ws.onclose = (event) => {
      if (!mountedRef.current) return
      wsRef.current = null
      if (event.code === 1000) {
        // Clean close — don't reconnect
        setStatus('offline')
        return
      }
      if (event.code === 4001) {
        setStatus('offline')
        setError('Authentication failed.')
        return
      }
      if (event.code === 4003) {
        setStatus('offline')
        setError('Access denied to this patient.')
        return
      }
      // Unexpected close — reconnect with backoff
      setStatus('connecting')
      reconnectTimer.current = setTimeout(() => {
        if (mountedRef.current) {
          reconnectDelay.current = Math.min(
            reconnectDelay.current * 2, 10000)
          connect()
        }
      }, reconnectDelay.current)
    }

    ws.onerror = () => {
      // onclose will handle reconnection
      if (!mountedRef.current) return
      setStatus('connecting')
    }
  }, [patient?.id])

  useEffect(() => {
    mountedRef.current = true
    reconnectDelay.current = 1000

    // Small delay to avoid StrictMode double-invoke
    const timer = setTimeout(() => {
      if (mountedRef.current) connect()
    }, 100)

    return () => {
      mountedRef.current = false
      clearTimeout(timer)
      cleanup()
    }
  }, [connect])

  const sendMessage = () => {
    const text = input.trim()
    if (!text) return
    if (!wsRef.current ||
      wsRef.current.readyState !== WebSocket.OPEN) {
      setError('Not connected. Please wait...')
      return
    }
    wsRef.current.send(JSON.stringify({
      message: text
    }))
    setInput('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      e.stopPropagation()
      sendMessage()
    }
  }

  const formatTime = (isoString) => {
    if (!isoString) return ''
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const isOwnMessage = (msg) =>
    msg.sent_by_id === user?.id
  const isDark = theme.palette.mode === 'dark'

  const statusConfig = {
    live: {
      label: 'Live',
      bgcolor: '#DCFCE7',
      color: '#16A34A'
    },
    connecting: {
      label: 'Connecting...',
      bgcolor: '#FEF9C3',
      color: '#CA8A04'
    },
    offline: {
      label: 'Offline',
      bgcolor: '#FEE2E2',
      color: '#DC2626'
    }
  }

  const currentStatus = statusConfig[status]
    || statusConfig.offline

  return (
    <Box
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: 500,
        bgcolor: theme.palette.background.default,
        borderRadius: 2,
        border: `1px solid ${theme.palette.divider}`,
        overflow: 'hidden'
      }}>

      {/* Header */}
      <Box sx={{
        px: 2, py: 1.5,
        bgcolor: theme.palette.background.paper,
        borderBottom: `1px solid ${theme.palette.divider}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Typography fontWeight={600} fontSize={14}>
          Patient Discussion
        </Typography>
        <Chip
          size="small"
          label={currentStatus.label}
          sx={{
            bgcolor: currentStatus.bgcolor,
            color: currentStatus.color,
            fontWeight: 600,
            fontSize: 11,
            height: 22
          }}
        />
      </Box>

      {/* Error Banner */}
      {error && (
        <Alert
          severity="warning"
          sx={{ borderRadius: 0, py: 0.5, fontSize: 12 }}
          onClose={() => setError(null)}>
          {error === 'Authentication failed.'
            ? 'Please log in again to use chat.'
            : error === 'Access denied to this patient.'
            ? 'You do not have access to this patient.'
            : error.includes('Practitioner')
              || error.includes('AttributeError')
              || error.includes('Exception')
            ? 'A connection error occurred. Retrying...'
            : error}
        </Alert>
      )}

      {/* Messages Area */}
      <Box sx={{
        flex: 1,
        overflowY: 'auto',
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5
      }}>
        {status === 'connecting' &&
          messages.length === 0 && (
          <Box sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            flexDirection: 'column',
            gap: 2
          }}>
            <CircularProgress
              size={32}
              sx={{ color: '#F97316' }} />
            <Typography
              fontSize={13}
              color="text.secondary">
              Connecting to chat...
            </Typography>
          </Box>
        )}

        {status !== 'connecting' &&
          messages.length === 0 && (
          <Box sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            flexDirection: 'column',
            gap: 1
          }}>
            <Typography
              fontSize={13}
              color="text.secondary"
              textAlign="center">
              No messages yet.
              <br />
              Start the discussion about
              this patient.
            </Typography>
          </Box>
        )}

        {messages.map((msg, index) => {
          const own = isOwnMessage(msg)
          const prevMsg = messages[index - 1]
          const showName = !prevMsg
            || prevMsg.sent_by_id !== msg.sent_by_id

          return (
            <Box
              key={msg.id || index}
              sx={{
                display: 'flex',
                flexDirection: own
                  ? 'row-reverse' : 'row',
                alignItems: 'flex-end',
                gap: 1
              }}>
              {!own && (
                <Tooltip title={msg.sent_by_name}>
                  <Avatar sx={{
                    width: 28, height: 28,
                    bgcolor: '#F97316',
                    fontSize: 11,
                    fontWeight: 700,
                    opacity: showName ? 1 : 0,
                    flexShrink: 0
                  }}>
                    {msg.sent_by_initials}
                  </Avatar>
                </Tooltip>
              )}

              <Box sx={{
                maxWidth: '70%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: own
                  ? 'flex-end' : 'flex-start'
              }}>
                {showName && !own && (
                  <Typography
                    fontSize={11}
                    fontWeight={600}
                    color="text.secondary"
                    mb={0.3}
                    ml={0.5}>
                    {msg.sent_by_name}
                  </Typography>
                )}
                <Paper elevation={0} sx={{
                  px: 1.5, py: 1,
                  bgcolor: own
                    ? '#F97316'
                    : isDark
                      ? '#2D3748'
                      : '#F1F5F9',
                  color: own
                    ? '#FFFFFF'
                    : theme.palette.text.primary,
                  borderRadius: own
                    ? '12px 12px 4px 12px'
                    : '12px 12px 12px 4px',
                  wordBreak: 'break-word'
                }}>
                  <Typography
                    fontSize={13}
                    lineHeight={1.5}>
                    {msg.message}
                  </Typography>
                </Paper>
                <Typography
                  fontSize={10}
                  color="text.secondary"
                  mt={0.3}
                  mx={0.5}>
                  {formatTime(msg.sent_at)}
                </Typography>
              </Box>
            </Box>
          )
        })}
        <div ref={bottomRef} />
      </Box>

      {/* Input Area */}
      <Divider />
      <Box sx={{
        p: 1.5,
        bgcolor: theme.palette.background.paper,
        display: 'flex',
        gap: 1,
        alignItems: 'flex-end'
      }}>
        <TextField
          fullWidth
          multiline
          maxRows={4}
          size="small"
          placeholder={status === 'live'
            ? 'Type a message... (Enter to send)'
            : 'Connecting...'}
          value={input}
          onChange={(e) => {
            e.stopPropagation()
            setInput(e.target.value)
          }}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          onFocus={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          disabled={status !== 'live'}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 3,
              fontSize: 13,
              '&.Mui-focused fieldset': {
                borderColor: '#F97316'
              }
            }
          }}
        />
        <IconButton
          onClick={(e) => {
            e.stopPropagation()
            sendMessage()
          }}
          disabled={status !== 'live'
            || !input.trim()}
          sx={{
            bgcolor: status === 'live'
              && input.trim()
              ? '#F97316' : undefined,
            color: status === 'live'
              && input.trim()
              ? '#FFFFFF' : undefined,
            borderRadius: 2,
            p: 1,
            flexShrink: 0,
            '&:hover': {
              bgcolor: '#EA6C0A'
            },
            transition: 'all 0.2s ease'
          }}>
          <SendIcon fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  )
}
