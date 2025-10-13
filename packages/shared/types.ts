export type Currency = 'TRY' | 'GBP' | 'USD'

export type Color =
  | 'brown' | 'lightblue' | 'pink' | 'orange'
  | 'red' | 'yellow' | 'green' | 'darkblue'

export type SpaceType =
  | 'GO' | 'PROPERTY' | 'STATION' | 'UTILITY'
  | 'TAX' | 'CHANCE' | 'COMMUNITY' | 'JAIL'
  | 'GO_TO_JAIL' | 'FREE_PARKING'

export type SpaceBase = {
  id: number // 0..39 clockwise from GO
  type: SpaceType
  name: string
}

export type Property = SpaceBase & {
  type: 'PROPERTY'
  color: Color
  price: number
  rent: {
    base: number
    withSet: number
    house1: number
    house2: number
    house3: number
    house4: number
    hotel: number
  }
  houseCost: number
  hotelCost: number
  mortgage: number
  mortgaged?: boolean
}

export type Station = SpaceBase & {
  type: 'STATION'
  price: number
  rentByOwned: [number, number, number, number]
  mortgage: number
  mortgaged?: boolean
}

export type Utility = SpaceBase & {
  type: 'UTILITY'
  price: number
  rentMultiplier: { one: number; two: number } // dice sum * multiplier
  mortgage: number
  mortgaged?: boolean
}

export type Tax = SpaceBase & { type: 'TAX'; amount: number }

export type BoardSpace = SpaceBase | Property | Station | Utility | Tax

export type Board = {
  currency: Currency
  goAmount: number // 200 by default (rules)
  spaces: BoardSpace[] // length 40
}

export type Player = {
  id: string
  name: string
  cash: number
  position: number // 0..39
  inJail: boolean
  jailTurns: number // number of turns spent in jail trying for doubles (0..3)
  getOutOfJail: number // held cards
  bankrupt: boolean
  properties: number[] // owned space ids (PROPERTY/STATION/UTILITY)
  houses: Record<number, 0|1|2|3|4>
  hotels: Record<number, 0|1>
}

export type DeckCard =
  | { id: string; kind: 'money'; amount: number; text: string }
  | { id: string; kind: 'move'; to: number; passGo?: boolean; text: string }
  | { id: string; kind: 'moveSteps'; steps: number; text: string }
  | { id: string; kind: 'gotojail'; text: string }
  | { id: string; kind: 'getoutofjail'; text: string }
  | { id: string; kind: 'feePerHouseHotel'; perHouse: number; perHotel: number; text: string }
  | { id: string; kind: 'nearestUtilityPayTenDice'; text: string }
  | { id: string; kind: 'nearestStationDoubleRent'; text: string }
  | { id: string; kind: 'collectFromEach'; amount: number; text: string }
  | { id: string; kind: 'payEach'; amount: number; text: string }

export type Auction = {
  active: boolean
  spaceId: number | null
  participants: string[] // player ids still in
  highestBid: number
  highestBidder: string | null
  minIncrement: number
}

export type Bank = {
  houses: number // 32
  hotels: number // 12
}

export type Dice = { d1: number; d2: number; sum: number; isDouble: boolean }

export type RoomState = {
  roomId: string
  started: boolean
  seed: string
  turnIndex: number
  order: string[]
  players: Record<string, Player>
  deck: { chance: DeckCard[]; community: DeckCard[] }
  bank: Bank
  auction: Auction
  lastDice: Dice | null
  // Last drawn deck card (legacy 3D display hook)
  lastCard?: { deck: 'chance' | 'community'; index: number; ts: number }
  // Pending card awaiting client confirmation (deferred effect)
  pendingCard?: { deck: 'chance' | 'community'; card: DeckCard; index: number; playerId: string; ts: number }
  // Pending land-on resolution awaiting client arrival (defers rent/tax/cards until hop finishes)
  pendingVisit?: { playerId: string; spaceId: number; diceSum: number; passedGo?: boolean; ts: number }
}

export type ClientEvent =
  | { type: 'join'; name: string; roomId: string }
  | { type: 'start' }
  | { type: 'roll' }
  | { type: 'buy' }
  | { type: 'decline' }               // triggers auction per rules
  | { type: 'endTurn' }
  | { type: 'bid'; amount: number }
  | { type: 'passBid' }
  | { type: 'payJail' }
  | { type: 'useGetOutCard' }
  | { type: 'buildHouse'; spaceId: number }
  | { type: 'sellHouse'; spaceId: number }
  | { type: 'buyHotel'; spaceId: number }
  | { type: 'sellHotel'; spaceId: number }
  | { type: 'mortgage'; spaceId: number }
  | { type: 'unmortgage'; spaceId: number }
  // NEW:
  | { type: 'readyToggle' }
  | { type: 'kick'; playerId: string }
  | { type: 'continueCard' }
  // Client signals movement animation finished; server applies landOn now
  | { type: 'arrived' }

export type ServerEvent =
  | { type: 'state'; state: RoomState }
  | { type: 'msg'; text: string }
  | { type: 'error'; text: string }

