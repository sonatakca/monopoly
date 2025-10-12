import type {
  Board, BoardSpace, Player, RoomState, ClientEvent, ServerEvent,
  Property, Station, Utility, DeckCard
} from '../../../packages/shared/types.js'
import fs from 'node:fs'
import crypto from 'node:crypto'

const board: Board = JSON.parse(
  fs.readFileSync(new URL('../../../packages/shared/board.tr.json', import.meta.url), 'utf-8')
)

const START_CASH = 1500
const JAIL_SPACE = 10
const GO_SPACE = 0
const MAX_PLAYERS = 8

// --- helpers ---------------------------------------------------------
function isProp(x: BoardSpace): x is Property { return x.type === 'PROPERTY' }
function isStation(x: BoardSpace): x is Station { return x.type === 'STATION' }
function isUtility(x: BoardSpace): x is Utility { return x.type === 'UTILITY' }

function getSet(sp: Property) {
  const color = sp.color
  return board.spaces.filter(s => isProp(s) && s.color === color) as Property[]
}

function ownsSet(state: RoomState, p: Player, prop: Property) {
  const setIds = getSet(prop).map(s => s.id)
  return setIds.every(id => p.properties.includes(id)) &&
         setIds.every(id => !isMortgaged(id)) // no double rent if any mortgaged
  function isMortgaged(id: number) {
    const s = board.spaces[id]
    return (isProp(s) || isStation(s) || isUtility(s)) ? !!s.mortgaged : false
  }
}

function ownerOf(state: RoomState, spaceId: number): Player | undefined {
  return Object.values(state.players).find(pl => pl.properties.includes(spaceId))
}

function pay(from: Player, to: Player | 'bank', amount: number) {
  from.cash -= amount
  if (to !== 'bank') to.cash += amount
}

function credit(p: Player, amount: number) { p.cash += amount }

function move(p: Player, steps: number) {
  const prev = p.position
  p.position = (p.position + steps) % 40
  if (p.position < prev) p.cash += board.goAmount // passed GO
}

function goTo(p: Player, spaceId: number, { passGo }: { passGo?: boolean } = {}) {
  const prev = p.position
  p.position = spaceId
  if (passGo && (spaceId <= prev)) p.cash += board.goAmount
}

function sendToJail(p: Player) {
  p.inJail = true
  p.jailTurns = 0
  p.position = JAIL_SPACE
}

// --- decks (minimal but functional) ----------------------------------
function makeDeck(seed: string): { chance: DeckCard[]; community: DeckCard[] } {
  // Şans (Chance) 0..15
  const chance: DeckCard[] = [
    { id:'sans0',  kind:'move', to: 24, passGo:true, text:'İlerle: 24 (GO’dan geçersen 200 al)'} ,
    { id:'sans1',  kind:'nearestUtilityPayTenDice', text:'En yakın kamu kuruluşuna; sahipse zar×10 öde' },
    { id:'sans2',  kind:'move', to: GO_SPACE, passGo:true, text:'Başlangıca ilerle +200' },
    { id:'sans3',  kind:'nearestStationDoubleRent', text:'En yakın istasyona; sahipse 2× kira öde' },
    { id:'sans4',  kind:'nearestStationDoubleRent', text:'En yakın istasyona; sahipse 2× kira öde' },
    { id:'sans5',  kind:'move', to: 37, passGo:false, text:'37’ye ilerle; 200 alma' },
    { id:'sans6',  kind:'gotojail', text:'Kodes’e git; 200 alma' },
    { id:'sans7',  kind:'money', amount: 50, text:'+50' },
    { id:'sans8',  kind:'moveSteps', steps: -3, text:'3 adım geri' },
    { id:'sans9',  kind:'money', amount: -15, text:'-15' },
    { id:'sans10', kind:'payEach', amount: 50, text:'Her oyuncuya 50 öde' },
    { id:'sans11', kind:'feePerHouseHotel', perHouse: 25, perHotel: 100, text:'Her ev 25, her otel 100 öde' },
    { id:'sans12', kind:'money', amount: 50, text:'+50' },
    { id:'sans13', kind:'money', amount: 150, text:'+150' },
    { id:'sans14', kind:'move', to: 11, passGo:true, text:'11’e ilerle; GO’dan geçersen 200' },
    { id:'sans15', kind:'move', to: 35, passGo:true, text:'35’e ilerle; GO’dan geçersen 200' },
  ]
  // Kamu Fonu (Community Chest) 0..15
  const community: DeckCard[] = [
    { id:'kamufonu0',  kind:'money', amount: 50, text:'+50' },
    { id:'kamufonu1',  kind:'feePerHouseHotel', perHouse: 25, perHotel: 100, text:'Ev başı 25, otel başı 100 öde' },
    { id:'kamufonu2',  kind:'move', to: GO_SPACE, passGo:true, text:'Başlangıca ilerle +200' },
    { id:'kamufonu3',  kind:'money', amount: -50, text:'-50' },
    { id:'kamufonu4',  kind:'money', amount: -100, text:'-100' },
    { id:'kamufonu5',  kind:'money', amount: -50, text:'-50' },
    { id:'kamufonu6',  kind:'money', amount: 25, text:'+25' },
    { id:'kamufonu7',  kind:'money', amount: 10, text:'+10' },
    { id:'kamufonu8',  kind:'money', amount: 200, text:'+200' },
    { id:'kamufonu9',  kind:'money', amount: 50, text:'+50' },
    { id:'kamufonu10', kind:'collectFromEach', amount: 10, text:'Her oyuncudan +10 al' },
    { id:'kamufonu11', kind:'money', amount: 100, text:'+100' },
    { id:'kamufonu12', kind:'money', amount: 20, text:'+20' },
    { id:'kamufonu13', kind:'money', amount: 100, text:'+100' },
    { id:'kamufonu14', kind:'money', amount: 100, text:'+100' },
    { id:'kamufonu15', kind:'gotojail', text:'Direkt kodes; 200 alma' },
  ]
  // deterministic shuffle
  const rng = crypto.createHash('sha256').update(seed).digest()
  function shuffle<T>(arr: T[]): T[] {
    const a = arr.slice()
    for (let i=a.length-1; i>0; i--) {
      const r = rng[i % rng.length] / 255
      const j = Math.floor(r * (i+1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }
  return { chance: shuffle(chance), community: shuffle(community) }
}

// --- room lifecycle ---------------------------------------------------
export function createRoom(roomId: string): RoomState & {
  ready: Record<string, boolean>,
  phase: 'lobby' | 'play' | 'order',
  adminId: string
} {
  const seed = crypto.randomBytes(8).toString('hex')
  return {
    roomId,
    started: false,
    seed,
    turnIndex: 0,
    order: [],
    players: {},
    deck: makeDeck(seed),
    bank: { houses: 32, hotels: 12 },
    auction: { active: false, spaceId: null, participants: [], highestBid: 0, highestBidder: null, minIncrement: 10 },
    lastDice: null,
    // extensions:
    ready: {},
    phase: 'lobby',
    adminId: '',
    pendingVisit: undefined,
  } as any
}

export function addPlayer(state: any, id: string, name: string): string | null {
  if (state.started) return 'Game started'
  const liveIds = Object.keys(state.players)
  if (liveIds.length >= MAX_PLAYERS) return 'Oda dolu (en fazla 8).'
  if (state.players[id]) return null

  state.players[id] = {
    id, name, cash: START_CASH, position: 0,
    inJail: false, jailTurns: 0, getOutOfJail: 0,
    bankrupt: false, properties: [], houses: {}, hotels: {}
  }
  state.ready[id] = false
  state.order.push(id)
  if (!state.adminId) state.adminId = id
  return null
}

export function toggleReady(state: any, id: string) {
  if (!state.players[id]) return
  state.ready[id] = !state.ready[id]
}

export function kick(state: any, adminId: string, targetId: string): string | null {
  if (state.adminId !== adminId) return 'Yalnızca admin oyuncu atabilir.'
  if (!state.players[targetId]) return 'Oyuncu bulunamadı.'
  // remove from order, ready, players
  state.order = state.order.filter((x: string) => x !== targetId)
  delete state.players[targetId]
  delete state.ready[targetId]
  // if admin kicked self (not via UI), rotate admin
  if (state.adminId === targetId) {
    state.adminId = state.order[0] || ''
  }
  return null
}

export function canStart(state: any): boolean {
  const ids = state.order.filter((id: string) => !!state.players[id])
  if (ids.length < 2) return false
  return ids.every((id: string) => state.ready[id])
}

export function start(state: any, byId: string): string | null {
  // Allow game to start automatically when everyone is ready; no admin gate
  if (!canStart(state)) return 'Herkes hazır olmalı ve en az 2 oyuncu gerekir.'
  state.started = true
  state.phase = 'order'
  // Server-authoritative order roll
  const entries = (state.order as string[]).filter((id: string) => !!state.players[id]).map((id: string) => {
    const d1 = 1 + Math.floor(Math.random() * 6)
    const d2 = 1 + Math.floor(Math.random() * 6)
    const sum = d1 + d2
    const hi = Math.max(d1, d2)
    const name = (state.players[id]?.name || '').toLowerCase()
    return { id, name, d1, d2, sum, hi }
  })
  // Sort by: sum desc, highest single die desc, name asc (deterministic)
  entries.sort((a, b) => (b.sum - a.sum) || (b.hi - a.hi) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  state.order = entries.map(e => e.id)
  state.turnIndex = 0
  state.phase = 'play'
  // Announce results
  ;(state as any)._orderRoll = entries.map(e => ({ id: e.id, name: state.players[e.id]?.name, d1: e.d1, d2: e.d2, sum: e.sum }))
  return null
}

// --- core rules -------------------------------------------------------
function current(state: RoomState) { return state.players[state.order[state.turnIndex]] }

function nextTurn(state: RoomState) {
  let i = state.turnIndex
  for (let step = 0; step < state.order.length; step++) {
    i = (i + 1) % state.order.length
    if (!state.players[state.order[i]].bankrupt) {
      state.turnIndex = i
      break
    }
  }
  state.lastDice = null
}

function chargeOrBankrupt(state: RoomState, debtor: Player, recipient: Player | 'bank', amount: number, log: string[]) {
  if (debtor.cash >= amount) { pay(debtor, recipient, amount); return }
  debtor.bankrupt = true
  if (recipient !== 'bank') {
    recipient.cash += Math.max(0, debtor.cash)
    debtor.cash = 0
    for (const pid of debtor.properties) recipient.properties.push(pid)
    recipient.getOutOfJail += debtor.getOutOfJail
    debtor.properties = []
    debtor.getOutOfJail = 0
  }
  log.push(`${debtor.name} iflas etti.`)
}

function rentDue(state: RoomState, space: BoardSpace, diceSum: number): number {
  if (isProp(space)) {
    const owner = ownerOf(state, space.id)
    if (!owner || space.mortgaged) return 0
    const hotels = owner.hotels[space.id] || 0
    const houses = owner.houses[space.id] || 0
    if (hotels === 1) return space.rent.hotel
    if (houses > 0) {
      return [0, space.rent.house1, space.rent.house2, space.rent.house3, space.rent.house4][houses]
    }
    return ownsSet(state, owner, space) ? space.rent.withSet : space.rent.base
  }
  if (isStation(space)) {
    const owner = ownerOf(state, space.id)
    if (!owner || space.mortgaged) return 0
    const count = owner.properties.filter(pid => isStation(board.spaces[pid])).length
    return space.rentByOwned[Math.max(0, Math.min(count-1, 3))]
  }
  if (isUtility(space)) {
    const owner = ownerOf(state, space.id)
    if (!owner || space.mortgaged) return 0
    const hasBoth = owner.properties.filter(pid => isUtility(board.spaces[pid])).length === 2
    const mult = hasBoth ? space.rentMultiplier.two : space.rentMultiplier.one
    return mult * diceSum
  }
  return 0
}

function beginAuction(state: RoomState, spaceId: number) {
  const live = state.order.filter(id => !state.players[id].bankrupt)
  state.auction = {
    active: true, spaceId, participants: live.slice(), highestBid: 0, highestBidder: null, minIncrement: 10
  }
}

function placeBid(state: RoomState, bidderId: string, amount: number, log: string[]) {
  const a = state.auction
  if (!a.active || a.spaceId == null) return
  if (!a.participants.includes(bidderId)) return
  if (amount < a.highestBid + a.minIncrement) return
  const bidder = (state as any).players[bidderId]
  if (bidder.cash < amount) return
  a.highestBid = amount
  a.highestBidder = bidderId
  log.push(`${bidder.name} açık arttırma teklifi verdi: ${amount}₺`)
}

function passBid(state: RoomState, pid: string, log: string[]) {
  const a = state.auction
  if (!a.active) return
  a.participants = a.participants.filter(x => x !== pid)
  log.push(`${(state as any).players[pid].name} ihaleden çekildi.`)
  if (a.participants.length === 0 && a.highestBidder) {
    const winner = (state as any).players[a.highestBidder]
    const space = board.spaces[a.spaceId!]
    winner.cash -= a.highestBid
    winner.properties.push(space.id)
    log.push(`${winner.name} kazandı: ${space.name} (${a.highestBid}₺)`)
    state.auction = { active:false, spaceId:null, participants:[], highestBid:0, highestBidder:null, minIncrement:10 }
  }
}

function canBuildHouse(state: RoomState, p: Player, prop: Property) {
  if (!ownsSet(state, p, prop)) return false
  if (prop.mortgaged) return false
  if ((state as any).bank.houses <= 0) return false
  const set = getSet(prop)
  const levels = set.map(s => (p.hotels[s.id] ? 5 : (p.houses[s.id] || 0)))
  const thisLevel = p.houses[prop.id] || 0
  const minLevel = Math.min(...levels)
  return thisLevel === minLevel && thisLevel < 4 && !(p.hotels[prop.id])
}
function canBuyHotel(state: RoomState, p: Player, prop: Property) {
  if (!ownsSet(state, p, prop)) return false
  if (prop.mortgaged) return false
  if ((state as any).bank.hotels <= 0) return false
  const set = getSet(prop)
  if (!set.every(s => (p.houses[s.id] || 0) === 4)) return false
  return (p.hotels[prop.id] || 0) === 0
}

function landOn(state: RoomState, p: Player, space: BoardSpace, log: string[]) {
  switch (space.type) {
    case 'PROPERTY':
    case 'STATION':
    case 'UTILITY': {
      const owner = ownerOf(state, space.id)
      if (!owner) {
        log.push(`${p.name} satın alabilir: ${space.name} (${(space as any).price}₺) — ya da ihaleye çıkarın.`)
      } else if (owner.id !== p.id) {
        const dice = (state as any).lastDice?.sum ?? 0
        const due = rentDue(state, space, dice)
        if (due > 0) {
          chargeOrBankrupt(state, p, owner, due, log)
          log.push(`${p.name}, ${owner.name}'a kira ödedi: ${due}₺`)
        }
      }
      break
    }
    case 'TAX': {
      const amount = (space as any).amount
      chargeOrBankrupt(state, p, 'bank', amount, log)
      log.push(`${p.name}, vergi ödedi: ${amount}₺`)
      break
    }
    case 'GO_TO_JAIL': {
      sendToJail(p); log.push(`${p.name} hapse gitti.`); break
    }
    case 'CHANCE': drawCard(state, p, 'chance', log); break
    case 'COMMUNITY': drawCard(state, p, 'community', log); break
    case 'FREE_PARKING': log.push(`${p.name} Bedava Park'ta.`); break
    case 'JAIL': log.push(`${p.name} Hapishane'de ziyarette.`); break
    case 'GO': break
  }
}

function applyCardEffect(state: any, p: Player, card: DeckCard, log: string[]) {
  switch (card.kind) {
    case 'money': {
      if (card.amount >= 0) credit(p, card.amount); else pay(p, 'bank', -card.amount)
      return
    }
    case 'move': {
      goTo(p, card.to, { passGo: !!card.passGo })
      ;(state as any).pendingVisit = { playerId: p.id, spaceId: p.position, diceSum: (state as any).lastDice?.sum || 0, ts: Date.now() }
      return
    }
    case 'moveSteps': {
      move(p, card.steps)
      ;(state as any).pendingVisit = { playerId: p.id, spaceId: p.position, diceSum: (state as any).lastDice?.sum || 0, ts: Date.now() }
      return
    }
    case 'gotojail': {
      sendToJail(p)
      return
    }
    case 'getoutofjail': {
      p.getOutOfJail++
      return
    }
    case 'feePerHouseHotel': {
      const houses = Object.values(p.houses || {}).reduce<number>((a, b) => a + (b as number), 0)
      const hotels = Object.values(p.hotels || {}).reduce<number>((a, b) => a + (b as number), 0)
      const amt = (card.perHouse * houses) + (card.perHotel * hotels)
      if (amt > 0) pay(p, 'bank', amt)
      return
    }
    case 'nearestUtilityPayTenDice': {
      const utils = board.spaces.filter(s => s.type === 'UTILITY').map(s => s.id).sort((a,b)=>a-b)
      const dest = utils.find(id => id > p.position) ?? utils[0]
      const passGo = dest <= p.position
      goTo(p, dest, { passGo })
      const owner = ownerOf(state, dest)
      if (owner && owner.id !== p.id && !(board.spaces[dest] as any).mortgaged) {
        const d1 = 1 + Math.floor(Math.random() * 6)
        const d2 = 1 + Math.floor(Math.random() * 6)
        const fee = 10 * (d1 + d2)
        chargeOrBankrupt(state, p, owner, fee, log)
      }
      return
    }
    case 'nearestStationDoubleRent': {
      const stations = board.spaces.filter(s => s.type === 'STATION').map(s => s.id).sort((a,b)=>a-b)
      const dest = stations.find(id => id > p.position) ?? stations[0]
      const passGo = dest <= p.position
      goTo(p, dest, { passGo })
      const owner = ownerOf(state, dest)
      if (owner && owner.id !== p.id && !(board.spaces[dest] as any).mortgaged) {
        const due = rentDue(state, board.spaces[dest], (state.lastDice?.sum || 0))
        chargeOrBankrupt(state, p, owner, due * 2, log)
      }
      return
    }
    case 'collectFromEach': {
      for (const other of Object.values<Player>(state.players)) {
        if (other.id === p.id || other.bankrupt) continue
        if (other.cash >= card.amount) { pay(other, p, card.amount) }
        else { chargeOrBankrupt(state, other, p, card.amount, log) }
      }
      return
    }
    case 'payEach': {
      for (const other of Object.values<Player>(state.players)) {
        if (other.id === p.id || other.bankrupt) continue
        chargeOrBankrupt(state, p, other, card.amount, log)
      }
      return
    }
  }
}

function drawCard(state: any, p: Player, which: 'chance'|'community', log: string[]) {
  if (state.pendingCard) return // avoid re-entrancy
  const deck: DeckCard[] = state.deck[which]
  const card = deck.shift()!
  deck.push(card) // place at end immediately to keep queue ordering
  // Publish pending card; parse numeric suffix for PNG index
  let idx = -1
  try { const m = String(card.id).match(/(\d+)$/); idx = m ? Number(m[1]) : -1 } catch {}
  const now = Date.now()
  state.pendingCard = { deck: which, card, index: Math.max(0, idx), playerId: p.id, ts: now }
  state.lastCard = { deck: which, index: Math.max(0, idx), ts: now }
  log.push(`${p.name} kart çekti.`)
}

// --- reducer ----------------------------------------------------------
export function reducer(state: any, playerId: string, evt: ClientEvent | any): ServerEvent[] {
  const out: ServerEvent[] = []
  const log: string[] = []

  if (evt.type === 'start') {
    const err = start(state, playerId)
    if (err) out.push({ type: 'error', text: err })
    else {
      out.push({ type: 'msg', text: 'Oyun başladı! Başlangıç sırası belirleniyor…' })
      const res: any[] = (state as any)._orderRoll || []
      if (res.length) {
        const lines = res.map(e => `${e.name}: ${e.d1}+${e.d2}=${e.sum}`)
        out.push({ type: 'msg', text: `Sıra: ${lines.join(' | ')}` })
        delete (state as any)._orderRoll
      }
    }
    return [...out, { type: 'state', state }]
  }

  if (evt.type === 'readyToggle') {
    toggleReady(state, playerId)
    // Auto-start when everyone is ready and at least 2 players
    if (!state.started && canStart(state)) {
      const err = start(state, playerId)
      if (err) return [{ type: 'error', text: err }, { type: 'state', state }]
      const res: any[] = (state as any)._orderRoll || []
      const out: ServerEvent[] = []
      out.push({ type: 'msg', text: 'Oyun başladı! Başlangıç sırası belirleniyor…' })
      if (res.length) {
        const lines = res.map(e => `${e.name}: ${e.d1}+${e.d2}=${e.sum}`)
        out.push({ type: 'msg', text: `Sıra: ${lines.join(' | ')}` })
        delete (state as any)._orderRoll
      }
      out.push({ type: 'state', state })
      return out
    }
    return [{ type: 'state', state }]
  }

  if (evt.type === 'kick') {
    const err = kick(state, playerId, evt.playerId)
    if (err) out.push({ type:'error', text: err })
    else out.push({ type:'msg', text: 'Oyuncu atıldı.' })
    return [...out, { type: 'state', state }]
  }

  if (!state.started) return [...out, { type: 'state', state }]

  // Block critical actions while a card is pending (until continued)
  if (state.pendingCard && (evt.type === 'roll' || evt.type === 'endTurn')) {
    return [...out, { type: 'error', text: 'Kart etkin: Devam Et ile onaylayın.' }, { type: 'state', state }]
  }

  // Bidding exception
  if (evt.type === 'bid' || evt.type === 'passBid') {
    if (!state.auction.active) return [...out, { type:'state', state }]
    if (evt.type === 'bid') placeBid(state, playerId, evt.amount, log)
    else passBid(state, playerId, log)
    for (const m of log) out.push({ type:'msg', text:m })
    out.push({ type:'state', state }); return out
  }

  const curId = state.order[state.turnIndex]
  // Handle deferred card continuation
  if (evt.type === 'continueCard') {
    const pending = state.pendingCard
    if (!pending) return [{ type: 'state', state }]
    if (pending.playerId !== playerId) return [{ type: 'error', text: 'Sıran değil' }, { type: 'state', state }]
    const mePlayer = state.players[playerId]
    if (!mePlayer) return [{ type: 'state', state }]
    applyCardEffect(state, mePlayer, pending.card, log)
    state.pendingCard = undefined
    out.push({ type: 'state', state })
    return out
  }
  const me = state.players[playerId]
  const isCur = (playerId === curId)
  if (!isCur) return [...out, { type: 'error', text: 'Sıran değil' }, { type: 'state', state }]

  const mePlayer = me

  switch (evt.type) {
    case 'roll': {
      if (mePlayer.inJail) {
        const d1 = 1 + Math.floor(Math.random()*6)
        const d2 = 1 + Math.floor(Math.random()*6)
        state.lastDice = { d1, d2, sum: d1+d2, isDouble: d1===d2 }
        log.push(`${mePlayer.name} (hapiste) zar attı: ${d1}+${d2}`)
        if (d1 === d2) {
          mePlayer.inJail = false
          mePlayer.jailTurns = 0
          move(mePlayer, d1+d2)
          ;(state as any).pendingVisit = { playerId: mePlayer.id, spaceId: mePlayer.position, diceSum: (state as any).lastDice.sum, ts: Date.now() }
        } else {
          mePlayer.jailTurns++
          if (mePlayer.jailTurns >= 3) {
            chargeOrBankrupt(state, mePlayer, 'bank', 50, log)
            mePlayer.inJail = false
            mePlayer.jailTurns = 0
            move(mePlayer, d1+d2)
            ;(state as any).pendingVisit = { playerId: mePlayer.id, spaceId: mePlayer.position, diceSum: (state as any).lastDice.sum, ts: Date.now() }
          } else {
            log.push(`${mePlayer.name} hapiste kalıyor (${mePlayer.jailTurns}/3).`)
          }
        }
        break
      }

      const d1 = 1 + Math.floor(Math.random()*6)
      const d2 = 1 + Math.floor(Math.random()*6)
      const isDouble = d1===d2
      state.lastDice = { d1, d2, sum: d1+d2, isDouble }
      ;(mePlayer as any)._doubles = ((mePlayer as any)._doubles || 0) + (isDouble ? 1 : - (mePlayer as any)._doubles || 0)
      log.push(`${mePlayer.name} zar attı: ${d1}+${d2} = ${d1+d2}${isDouble?' (çift)':''}`)

      if (isDouble && (mePlayer as any)._doubles >= 3) {
        sendToJail(mePlayer); (mePlayer as any)._doubles = 0
        log.push(`${mePlayer.name} üçüncü çift ile hapse gitti.`)
        break
      }

      move(mePlayer, d1+d2)
      ;(state as any).pendingVisit = { playerId: mePlayer.id, spaceId: mePlayer.position, diceSum: (state as any).lastDice.sum, ts: Date.now() }
      break
    }

    case 'buy': {
      const sp = board.spaces[mePlayer.position]
      if (!('price' in (sp as any))) { log.push('Satın alınacak bir yer yok.'); break }
      const owner = ownerOf(state, sp.id)
      if (owner) { log.push('Burası zaten alınmış.'); break }
      const price = (sp as any).price as number
      if (mePlayer.cash < price) { log.push('Yetersiz bakiye.'); break }
      mePlayer.cash -= price
      mePlayer.properties.push(sp.id)
      log.push(`${mePlayer.name} satın aldı: ${sp.name} (${price}₺)`)
      break
    }

    case 'decline': {
      const sp = board.spaces[mePlayer.position]
      if (!('price' in (sp as any))) break
      const owner = ownerOf(state, sp.id)
      if (owner) break
      beginAuction(state, sp.id)
      log.push(`${sp.name} ihaleye açıldı (min adım 10₺).`)
      break
    }

    case 'payJail': {
      if (!mePlayer.inJail) { log.push('Hapiste değilsin.'); break }
      chargeOrBankrupt(state, mePlayer, 'bank', 50, log)
      mePlayer.inJail = false
      mePlayer.jailTurns = 0
      log.push(`${mePlayer.name} 50₺ ödeyerek çıktı.`)
      break
    }

    case 'useGetOutCard': {
      if (!mePlayer.inJail || mePlayer.getOutOfJail <= 0) { log.push('Kullanılabilir kart yok.'); break }
      mePlayer.getOutOfJail--
      mePlayer.inJail = false
      mePlayer.jailTurns = 0
      log.push(`${mePlayer.name} Hapisten Çık kartını kullandı.`)
      break
    }

    case 'endTurn': {
      nextTurn(state)
      log.push('Sıradaki oyuncu!')
      break
    }

    // Client signals arrival: resolve the space effects now
    case 'arrived': {
      const pv = (state as any).pendingVisit
      if (!pv) break
      if (pv.playerId !== playerId) break
      const pl = state.players[playerId]
      if (!pl) break
      landOn(state, pl, board.spaces[pv.spaceId], log)
      ;(state as any).pendingVisit = undefined
      break
    }
    default: break
  }

  for (const m of log) out.push({ type: 'msg', text: m })
  out.push({ type: 'state', state })
  return out
}
