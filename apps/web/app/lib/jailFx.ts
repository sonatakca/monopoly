import type * as THREE from 'three'
import { tween, wait } from './animator'

export type JailCtx = {
  token: THREE.Object3D
  getY: () => number
  setY: (y: number) => void
  setOpacity: (a: number) => void
  teleportToTile: (tileIndex: number, zoneKey?: '10j' | '10v') => void
}

/**
 * Simple client-side cinematic: rise + fade out at tile 30, teleport to tile 10 (10j),
 * then fall + fade in. Pure eye-candy; caller should trigger server-side sendToJail after.
 */
export async function goToJailCinematic(ctx: JailCtx) {
  const startY = ctx.getY()

  // rise + fade out
  await tween(600, (t) => {
    ctx.setY(startY + t * 2.0)
    ctx.setOpacity(1 - t)
  })

  await wait(200)

  // local teleport to jail area (visual only)
  ctx.teleportToTile(10, '10j')
  const newStartY = ctx.getY() + 2.0
  ctx.setY(newStartY)

  // fall + fade in
  await tween(600, (t) => {
    ctx.setY(newStartY - t * 2.0)
    ctx.setOpacity(t)
  })
}

