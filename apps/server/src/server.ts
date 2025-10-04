import express, { type Request, type Response } from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { addPlayer, createRoom, reducer } from './game.js'
import type { ClientEvent, ServerEvent } from '../../../packages/shared/types.js'

const WEB_ORIGIN = process.env.WEB_ORIGIN || ''
const ALLOWED = ['http://localhost:3000','http://127.0.0.1:3000']
if (WEB_ORIGIN) ALLOWED.push(WEB_ORIGIN)
const app = express()
app.use(cors({ origin: ALLOWED, credentials: false }))
app.get('/health', (_req: Request, res: Response) => res.send('ok'))

// List rooms with at least one player
app.get('/rooms', (_req: Request, res: Response) => {
  try {
    const list = Object.values(rooms).map((r) => {
      const playerEntries = Object.entries(r.players || {})
      const players = playerEntries.map(([id, p]: any) => ({ id, name: p.name }))
      const readyCount = Object.values((r as any).ready || {}).filter(Boolean).length
      return {
        roomId: (r as any).roomId,
        started: !!r.started,
        playerCount: players.length,
        readyCount,
        players,
      }
    }).filter((x) => x.playerCount > 0)
    res.json({ rooms: list })
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message || e) })
  }
})

const httpServer = createServer(app)
const io = new Server(httpServer, { cors: { origin: ALLOWED } })

const rooms: Record<string, ReturnType<typeof createRoom>> = {}

io.on('connection', (socket) => {
  console.log('[io] connection:', socket.id)
  let roomId = ''
  let name = ''

  socket.on('event', (evt: ClientEvent | any) => {
    if (evt.type === 'join') {
      const nextRoomId = evt.roomId?.trim() || 'oda-1'
      name = evt.name?.trim() || 'Oyuncu'
      // If already in a different room, remove from previous room's state
      if (roomId && nextRoomId !== roomId && rooms[roomId]) {
        const prev = rooms[roomId]
        if (prev.players[socket.id]) {
          delete prev.players[socket.id]
          ;(prev as any).order = (prev as any).order.filter((x: string) => x !== socket.id)
          if ((prev as any).ready) delete (prev as any).ready[socket.id]
          if ((prev as any).adminId === socket.id) {
            (prev as any).adminId = (prev as any).order[0] || ''
          }
          io.to(roomId).emit('event', { type: 'state', state: prev } as ServerEvent)
        }
      }

      roomId = nextRoomId
      rooms[roomId] ??= createRoom(roomId)
      const err = addPlayer(rooms[roomId] as any, socket.id, name)
      if (err) { socket.emit('event', { type: 'error', text: err } as ServerEvent); return }
      socket.join(roomId)
      io.to(roomId).emit('event', { type: 'state', state: rooms[roomId] } as ServerEvent)
      return
    }
    if (!rooms[roomId]) return

    // admin-only helpers coming from client:
    if (evt.type === 'readyToggle' || evt.type === 'kick') {
      // handled inside reducer in game.ts now (we forward the event there also ok)
    }

    const replies = reducer(rooms[roomId] as any, socket.id, evt)
    for (const r of replies) io.to(roomId).emit('event', r)
  })

  socket.on('disconnect', () => {
    const state = rooms[roomId]
    if (!state) return
    // Clean up player on disconnect
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

const PORT = Number(process.env.PORT || 8787)
httpServer.listen(PORT, '0.0.0.0', () =>
  console.log(`Server on http://127.0.0.1:${PORT} (health: /health)`) 
)
