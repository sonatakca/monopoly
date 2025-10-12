import board from '@shared/board.tr.json'

// Build canonical template: 22 properties grouped by set color (board order), then 4 stations, then 2 utilities.
// Export a flat array of tile ids.

function buildTemplate(): number[] {
  const spaces: any[] = (board as any).spaces || []
  const order: number[] = []
  const colorOrder = ['brown', 'lightblue', 'pink', 'orange', 'red', 'yellow', 'green', 'darkblue']
  for (const color of colorOrder) {
    const ids = spaces
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s && s.type === 'PROPERTY' && s.color === color)
      .map(({ i }) => i)
    ids.sort((a, b) => a - b)
    order.push(...ids)
  }
  const stations = spaces
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s && s.type === 'STATION')
    .map(({ i }) => i)
    .sort((a, b) => a - b)
  const utils = spaces
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s && s.type === 'UTILITY')
    .map(({ i }) => i)
    .sort((a, b) => a - b)
  order.push(...stations, ...utils)
  return order
}

export const PROPERTY_TEMPLATE: number[] = buildTemplate()

export type SpaceKind = 'PROPERTY' | 'STATION' | 'UTILITY' | 'OTHER'
export function kindOf(id: number): SpaceKind {
  try {
    const s: any = (board as any).spaces?.[id]
    if (!s) return 'OTHER'
    if (s.type === 'PROPERTY' || s.type === 'STATION' || s.type === 'UTILITY') return s.type
    return 'OTHER'
  } catch { return 'OTHER' }
}

export function colorOf(id: number): string | null {
  try {
    const s: any = (board as any).spaces?.[id]
    return s?.color || null
  } catch { return null }
}

export function isMortgaged(id: number): boolean {
  try {
    const s: any = (board as any).spaces?.[id]
    return !!s?.mortgaged
  } catch { return false }
}

export function nameOf(id: number): string {
  try {
    return String((board as any).spaces?.[id]?.name || `#${id}`)
  } catch { return `#${id}` }
}

