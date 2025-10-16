import express, { type Request, type Response } from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { addPlayer, createRoom, reducer } from './game.js'
import type { ClientEvent, ServerEvent } from '../../../packages/shared/types.js'

const WEB_ORIGIN = process.env.WEB_ORIGIN || ''
const ALLOWED = ['http://localhost:3000','http://127.0.0.1:3000', 'https://monopoly-with-friends.vercel.app']
if (WEB_ORIGIN) ALLOWED.push(WEB_ORIGIN)
const app = express()
app.use(cors({ origin: ALLOWED, credentials: false }))
app.get('/health', (_req: Request, res: Response) => res.send('ok'))
app.get('/server', (_req, res) => res.send('monopoly server is up'));

const DEV_ENABLE_FLUSH = ['1', 'true', 'yes'].includes((process.env.DEV_ENABLE_FLUSH || '').toLowerCase())

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

// --- Turn timeout (30s) management per room -----------------------------
const turnTimers: Record<string, NodeJS.Timeout | null> = {}
const timerMeta: Record<string, { at: number; forId: string } | null> = {}
const lastActionAt: Record<string, number> = {}

function clearTurnTimer(rid: string) {
  if (turnTimers[rid]) { clearTimeout(turnTimers[rid]!); turnTimers[rid] = null }
  timerMeta[rid] = null
}

function scheduleTurnTimer(rid: string) {
  const state = rooms[rid] as any
  if (!state?.started) { clearTurnTimer(rid); return }
  const curId = state.order?.[state.turnIndex]
  if (!curId) { clearTurnTimer(rid); return }
  // Only schedule at fresh turn (before any roll)
  if (state.lastDice) { clearTurnTimer(rid); return }
  clearTurnTimer(rid)
  const at = Date.now()
  timerMeta[rid] = { at, forId: curId }
  // Auto-roll dice if player does nothing for 30s at the start of their turn
  turnTimers[rid] = setTimeout(() => autoRoll(rid, at, curId), 30_000)
}

function autoRoll(rid: string, at: number, forId: string) {
  const meta = timerMeta[rid]
  const state = rooms[rid] as any
  if (!meta || !state) return
  // Stale or wrong room/turn
  if (meta.at !== at || meta.forId !== forId) return
  if (!state.started) return
  const curId = state.order?.[state.turnIndex]
  if (curId !== forId) return
  // If player has taken any action since scheduling, don't auto-roll
  if ((lastActionAt[rid] || 0) > at) return
  // If dice were already rolled, no need to auto-roll
  if (state.lastDice) return
  try {
    const replies = reducer(state, curId, { type: 'roll' } as any)
    for (const r of replies) io.to(rid).emit('event', r)
  } finally {
    // After rolling, consider scheduling an after-roll auto end-turn timer
    scheduleTurnTimer(rid)
    scheduleAfterRollTimer(rid)
  }
}

if (DEV_ENABLE_FLUSH) {
  app.post('/dev/flush', (_req: Request, res: Response) => {
    const roomIds = Object.keys(rooms)
    for (const rid of roomIds) {
      clearTurnTimer(rid)
      delete turnTimers[rid]
      delete timerMeta[rid]
      delete lastActionAt[rid]
      delete rooms[rid]
    }
    res.json({ ok: true, deleted: roomIds.length })
  })
}

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

    // Mark last action time if current player is acting in an active game
    try {
      const st: any = rooms[roomId]
      if (st?.started) {
        const cur = st.order?.[st.turnIndex]
        if (cur && socket.id === cur) lastActionAt[roomId] = Date.now()
      }
    } catch {}

    const replies = reducer(rooms[roomId] as any, socket.id, evt)
    for (const r of replies) io.to(roomId).emit('event', r)

    // After any state change, (re)schedule the turn timer if applicable
    scheduleTurnTimer(roomId)
    // And schedule/clear auto-continue for pending cards
    scheduleCardTimer(roomId)
    // And manage post-roll auto end-turn timer
    scheduleAfterRollTimer(roomId)
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
      // If we removed someone who was up next/current, re-evaluate timer
      scheduleTurnTimer(roomId)
      scheduleCardTimer(roomId)
      scheduleAfterRollTimer(roomId)
    }
  })
})

const PORT = Number(process.env.PORT || 8787)
httpServer.listen(PORT, '0.0.0.0', () =>
  console.log(`Server on http://127.0.0.1:${PORT} (health: /health)`) 
)
// --- Pending card auto-continue timers -----------------------------------
const cardTimers: Record<string, NodeJS.Timeout | null> = {}
function clearCardTimer(rid: string) {
  if (cardTimers[rid]) { clearTimeout(cardTimers[rid]!); cardTimers[rid] = null }
}
function scheduleCardTimer(rid: string) {
  const state: any = rooms[rid]
  clearCardTimer(rid)
  if (!state?.started) return
  const pending = state?.pendingCard
  if (!pending) return
  cardTimers[rid] = setTimeout(() => {
    try {
      const replies = reducer(state, pending.playerId, { type: 'continueCard' } as any)
      for (const r of replies) io.to(rid).emit('event', r)
    } catch {}
  }, 30_000)
}

// --- After-roll auto end-turn timers -------------------------------------
const afterRollTimers: Record<string, NodeJS.Timeout | null> = {}
function clearAfterRollTimer(rid: string) {
  if (afterRollTimers[rid]) { clearTimeout(afterRollTimers[rid]!); afterRollTimers[rid] = null }
}
function scheduleAfterRollTimer(rid: string) {
  const state: any = rooms[rid]
  clearAfterRollTimer(rid)
  if (!state?.started) return
  const curId = state.order?.[state.turnIndex]
  if (!curId) return
  // Only schedule if dice have been rolled and it's a non-double turn,
  // and there are no blocking overlays (pending visit/card, auction)
  const d = state.lastDice
  if (!d || d.isDouble) return
  if (state.pendingVisit || state.pendingCard || (state.auction && state.auction.active)) return
  afterRollTimers[rid] = setTimeout(() => {
    try {
      // Re-check conditions
      const st: any = rooms[rid]
      if (!st?.started) return
      const nowCur = st.order?.[st.turnIndex]
      if (nowCur !== curId) return
      const dx = st.lastDice
      if (!dx || dx.isDouble) return
      if (st.pendingVisit || st.pendingCard || (st.auction && st.auction.active)) return
      const replies = reducer(st, nowCur, { type: 'endTurn' } as any)
      for (const r of replies) io.to(rid).emit('event', r)
    } catch {}
  }, 30_000)
}
