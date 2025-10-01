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
  hotelCost: number // often same as houseCost
  mortgage: number
}

export type Station = SpaceBase & {
  type: 'STATION'
  price: number
  rentByOwned: [number, number, number, number]
  mortgage: number
}

export type Utility = SpaceBase & {
  type: 'UTILITY'
  price: number
  rentMultiplier: { one: number; two: number } // dice sum * multiplier
  mortgage: number
}

export type Tax = SpaceBase & { type: 'TAX'; amount: number }

export type BoardSpace = SpaceBase | Property | Station | Utility | Tax

export type Board = {
  currency: 'TRY'
  goAmount: number // 200 by default
  spaces: BoardSpace[] // length 40
}

export type Player = {
  id: string
  name: string
  cash: number
  position: number // 0..39
  jailTurns: number
  inJail: boolean
  getOutOfJail: number // held cards
  bankrupt: boolean
  properties: number[] // space ids
  houses: Record<number, 0|1|2|3|4>
  hotels: Record<number, 0|1>
}

export type RoomState = {
  roomId: string
  started: boolean
  seed: string
  turnIndex: number
  order: string[]
  players: Record<string, Player>
  deck: { chance: number[]; community: number[] }
}

export type ClientEvent =
  | { type: 'join'; name: string; roomId: string }
  | { type: 'start' }
  | { type: 'roll' }
  | { type: 'buy' }
  | { type: 'endTurn' }

export type ServerEvent =
  | { type: 'state'; state: RoomState }
  | { type: 'msg'; text: string }
  | { type: 'error'; text: string }
