import { io } from 'socket.io-client'

// Default to the Render deployment when we're in production, otherwise assume
// local development (which still prefers overriding via NEXT_PUBLIC_SOCKET_URL).
const DEFAULT_REMOTE = 'https://monopoly-socket-server.onrender.com'
const DEFAULT_LOCAL = 'http://127.0.0.1:8787'

const url =
  process.env.NEXT_PUBLIC_SOCKET_URL ??
  (process.env.NODE_ENV === 'production' ? DEFAULT_REMOTE : DEFAULT_LOCAL)

// Force websocket (skip polling that’s failing)
// If you deploy later, you can remove the transports override.
export const socket = io(url, {
  transports: ['websocket'],
  withCredentials: false,
})

socket.on('connect', () => console.log('[socket] connected:', socket.id))
socket.on('disconnect', (reason) => console.warn('[socket] disconnected:', reason))
socket.on('connect_error', (err) => console.error('[socket] connect_error:', err?.message || err))
