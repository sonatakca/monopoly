import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { addPlayer, createRoom, reducer } from './game.js'
import type { ClientEvent, ServerEvent } from '../../../packages/shared/types.js'

const app = express()
app.use(cors())
const httpServer = createServer(app)
const io = new Server(httpServer, { cors: { origin: '*' } })

const rooms: Record<string, ReturnType<typeof createRoom>> = {}

io.on('connection', (socket) => {
  let roomId = ''
  let name = ''

  socket.on('event', (evt: ClientEvent) => {
    if (evt.type === 'join') {
      roomId = evt.roomId
      name = evt.name
      rooms[roomId] ??= createRoom(roomId)
      addPlayer(rooms[roomId], socket.id, name)
      socket.join(roomId)
      io.to(roomId).emit('event', { type: 'state', state: rooms[roomId] } as ServerEvent)
      return
    }

    const state = rooms[roomId]
    if (!state) return

    const replies = reducer(state, socket.id, evt)
    for (const r of replies) io.to(roomId).emit('event', r)
  })

  socket.on('disconnect', () => {
    // TODO: soft-disconnect/reconnect window instead of removing players immediately
  })
})

httpServer.listen(8787, () => console.log('Server on http://localhost:8787'))
