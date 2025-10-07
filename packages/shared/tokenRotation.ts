// Per-token initial rotation (Euler XYZ in radians).
// Keys must match model base filenames uppercased, e.g.:
//   "/models/Player Tokens/Car.stl" -> key "CAR"
// Adjust these to correct each STL's up-axis/orientation.

export const CAR_ROTATION: [number, number, number] = [-Math.PI / 2, 0, 0]
export const DOG_ROTATION: [number, number, number] = [-Math.PI / 2, 0, 0]
export const HAT_ROTATION: [number, number, number] = [-Math.PI / 2, 0, 0]
export const SHOE_ROTATION: [number, number, number] = [-Math.PI / 2, 0, 0]

export const DEFAULT_TOKEN_ROTATION: Record<string, [number, number, number]> = {
  CAR: CAR_ROTATION,
  DOG: DOG_ROTATION,
  HAT: HAT_ROTATION,
  SHOE: SHOE_ROTATION,
}

