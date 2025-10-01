import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { addPlayer, createRoom, reducer } from './game.js'
import type { ClientEvent, ServerEvent } from '../../../packages/shared/types.js'

const app = express()
app.use(cors({ origin: ['http://localhost:3000','http://127.0.0.1:3000'], credentials: false }))
app.get('/health', (_req, res) => res.send('ok'))

const httpServer = createServer(app)
const io = new Server(httpServer, { cors: { origin: ['http://localhost:3000','http://127.0.0.1:3000'] } })

const rooms: Record<string, ReturnType<typeof createRoom>> = {}

io.on('connection', (socket) => {
  console.log('[io] connection:', socket.id)
  let roomId = ''
  let name = ''

  socket.on('event', (evt: ClientEvent | any) => {
    if (evt.type === 'join') {
      roomId = evt.roomId?.trim() || 'oda-1'
      name = evt.name?.trim() || 'Oyuncu'
      rooms[roomId] ??= createRoom(roomId)
      const err = addPlayer(rooms[roomId] as any, socket.id, name)
      if (err) { socket.emit('event', { type: 'error', text: err } as ServerEvent); return }
      socket.join(roomId)
      io.to(roomId).emit('event', { type: 'state', state: rooms[roomId] } as ServerEvent)
      return
    }
    if (!rooms[roomId]) return

    const replies = reducer(rooms[roomId] as any, socket.id, evt)
    for (const r of replies) io.to(roomId).emit('event', r)
  })

  socket.on('disconnect', () => {
    const state = rooms[roomId]
    if (!state) return
    if (state.players[socket.id]) {
      delete state.players[socket.id]
      ;(state as any).order = (state as any).order.filter((x: string) => x !== socket.id)
      if ((state as any).ready) delete (state as any).ready[socket.id]
      if ((state as any).adminId === socket.id) {
        (state as any).adminId = (state as any).order[0] || ''
      }
      io.to(roomId).emit('event', { type: 'state', state } as ServerEvent)
    }
  })
})

httpServer.listen(8787, '0.0.0.0', () =>
  console.log('Server on http://127.0.0.1:8787 (health: /health)')
)
