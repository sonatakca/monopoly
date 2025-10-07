// Named per-token constants. Keys must match model base filenames (uppercased).
// Example: "/models/Player Tokens/Shoe.stl" -> key "SHOE"

// Vertical offsets (scene units) above the board
export const CAR_Y = -0.17
export const DOG_Y = -0.10
export const HAT_Y = -0.15
export const SHOE_Y = -0.17

// Optional per-token uniform scale multipliers (applied on top of fitSize)
export const CAR_SCALE = 1.0
export const DOG_SCALE = 1.0
export const HAT_SCALE = 0.8
export const SHOE_SCALE = 1.0

// Mappings consumed by Board3D. Do not remove keys in use.
export const DEFAULT_TOKEN_GAPS_Y: Record<string, number> = {
  CAR: CAR_Y,
  DOG: DOG_Y,
  HAT: HAT_Y,
  SHOE: SHOE_Y,
}

export const DEFAULT_TOKEN_SCALES: Record<string, number> = {
  CAR: CAR_SCALE,
  DOG: DOG_SCALE,
  HAT: HAT_SCALE,
  SHOE: SHOE_SCALE,
}
