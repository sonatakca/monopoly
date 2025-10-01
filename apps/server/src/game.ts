import type { Board, BoardSpace, Player, RoomState, ClientEvent, ServerEvent } from '../../../packages/shared/types.js'
import fs from 'node:fs'
import crypto from 'node:crypto'

const board: Board = JSON.parse(fs.readFileSync(new URL('../../../packages/shared/board.tr.json', import.meta.url), 'utf-8'))

export function createRoom(roomId: string): RoomState {
  return {
    roomId,
    started: false,
    seed: crypto.randomBytes(8).toString('hex'),
    turnIndex: 0,
    order: [],
    players: {},
    deck: { chance: [], community: [] } // TODO: seed decks
  }
}

const START_CASH = 1500

export function addPlayer(state: RoomState, id: string, name: string) {
  if (state.started) throw new Error('Game started')
  if (state.players[id]) return
  state.players[id] = {
    id, name, cash: START_CASH, position: 0, inJail: false, jailTurns: 0, getOutOfJail: 0,
    bankrupt: false, properties: [], houses: {}, hotels: {}
  }
}

export function start(state: RoomState) {
  if (state.started) return
  state.started = true
  state.order = Object.keys(state.players)
  state.turnIndex = 0
}

function passGO(p: Player) { p.cash += board.goAmount }

function move(p: Player, steps: number) {
  const prev = p.position
  p.position = (p.position + steps) % 40
  if (p.position < prev) passGO(p)
}

function pay(from: Player, to: Player | 'bank', amount: number) {
  from.cash -= amount
  if (to !== 'bank') to.cash += amount
}

function ownerOf(state: RoomState, spaceId: number): Player | undefined {
  return Object.values(state.players).find(pl => pl.properties.includes(spaceId))
}

function landOn(state: RoomState, p: Player, space: BoardSpace, log: string[]) {
  switch (space.type) {
    case 'PROPERTY': {
      const owner = ownerOf(state, space.id)
      if (!owner) { log.push(`${p.name} satın alabilir: ${space.name} (${(space as any).price}₺)`) }
      else if (owner.id !== p.id) {
        const amount = (space as any).rent.base // TODO: set/house/hotel bonuses
        pay(p, owner, amount)
        log.push(`${p.name}, ${owner.name}'a kira ödedi: ${amount}₺`) }
      break
    }
    case 'STATION': {
      const owner = ownerOf(state, space.id)
      if (!owner) { log.push(`${p.name} istasyonu satın alabilir: ${space.name} (${(space as any).price}₺)`) }
      else if (owner.id !== p.id) {
        const ownedCount = Object.values(state.players).find(x => x.id === owner.id)!.properties
          .filter(pid => (board.spaces[pid] as any).type === 'STATION').length
        const rent = (space as any).rentByOwned[Math.max(0, Math.min(ownedCount-1, 3))]
        pay(p, owner, rent)
        log.push(`${p.name}, ${owner.name}'a istasyon kirası ödedi: ${rent}₺`) }
      break
    }
    case 'UTILITY': {
      const owner = ownerOf(state, space.id)
      if (!owner) { log.push(`${p.name} hizmeti satın alabilir: ${space.name} (${(space as any).price}₺)`) }
      else if (owner.id !== p.id) {
        // placeholder; actual rent uses dice sum and whether both utilities are owned
        const rent = 20
        pay(p, owner, rent)
        log.push(`${p.name}, ${owner.name}'a hizmet bedeli ödedi: ${rent}₺`) }
      break
    }
    case 'TAX': {
      const amount = (space as any).amount
      pay(p, 'bank', amount)
      log.push(`${p.name}, vergi ödedi: ${amount}₺`)
      break
    }
    case 'GO_TO_JAIL': {
      p.inJail = true
      p.position = 10
      log.push(`${p.name} hapse gitti.`)
      break
    }
    case 'CHANCE': log.push(`${p.name} Şans kartı çekti.`); break
    case 'COMMUNITY': log.push(`${p.name} Topluluk kartı çekti.`); break
    case 'FREE_PARKING': log.push(`${p.name} Bedava Park'ta dinleniyor.`); break
    case 'JAIL': log.push(`${p.name} Hapishane'de ziyarette.`); break
  }
}

export function reducer(state: RoomState, playerId: string, evt: ClientEvent): ServerEvent[] {
  const out: ServerEvent[] = []
  const log: string[] = []

  if (evt.type === 'start') { start(state); out.push({ type: 'msg', text: 'Oyun başladı!' }) }

  if (!state.started) return [...out, { type: 'state', state }]

  const curId = state.order[state.turnIndex]
  if (playerId !== curId) return [...out, { type: 'error', text: 'Sıran değil' }, { type: 'state', state }]

  const me = state.players[playerId]

  switch (evt.type) {
    case 'roll': {
      const d1 = 1 + Math.floor(Math.random()*6)
      const d2 = 1 + Math.floor(Math.random()*6)
      const sum = d1 + d2
      log.push(`${me.name} zar attı: ${d1}+${d2} = ${sum}`)
      move(me, sum)
      landOn(state, me, board.spaces[me.position], log)
      break
    }
    case 'buy': {
      const space = board.spaces[me.position]
      if ('price' in (space as any)) {
        const price = (space as any).price as number
        if (me.cash >= price && !ownerOf(state, space.id)) {
          me.cash -= price
          me.properties.push(space.id)
          log.push(`${me.name}, satın aldı: ${space.name} (${price}₺)`) }
        else log.push(`Satın alma mümkün değil.`)
      }
      break
    }
    case 'endTurn': {
      state.turnIndex = (state.turnIndex + 1) % state.order.length
      log.push('Sıradaki oyuncu!')
      break
    }
  }

  for (const m of log) out.push({ type: 'msg', text: m })
  out.push({ type: 'state', state })
  return out
}
