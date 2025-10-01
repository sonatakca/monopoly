import { io } from 'socket.io-client'

// Use 127.0.0.1 to avoid some localhost resolution quirks on Windows
const url = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://127.0.0.1:8787'

// Force websocket (skip polling that’s failing)
// If you deploy later, you can remove the transports override.
export const socket = io(url, {
  transports: ['websocket'],
  withCredentials: false,
})

socket.on('connect', () => console.log('[socket] connected:', socket.id))
socket.on('disconnect', (reason) => console.warn('[socket] disconnected:', reason))
socket.on('connect_error', (err) => console.error('[socket] connect_error:', err?.message || err))
