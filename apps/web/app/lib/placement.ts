// Helpers related to placement and zone keys

export function zoneKeyFor(tile: number, inJail: boolean | undefined): string {
  if (tile === 10) return inJail ? '10j' : '10v'
  return String(tile)
}

