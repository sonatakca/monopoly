import * as THREE from 'three'
import { tween, easeInOutQuad } from './animator'

export type ResolveTarget = (tileIndex: number) => THREE.Vector3

/**
 * Run a hop route for a token Object3D. The token is animated in place; caller provides
 * a resolver that maps a tile index into a world-space Vector3 target.
 */
export async function runRoute(
  token: THREE.Object3D,
  path: number[],
  resolve: ResolveTarget,
  hopMs = 220,
) {
  for (let i = 0; i < path.length; i++) {
    const targetTile = path[i]
    const start = token.position.clone()
    const endV = resolve(targetTile)
    const end = new THREE.Vector3(endV.x, endV.y, endV.z)
    const baseY = end.y

    await tween(hopMs, (t) => {
      const e = easeInOutQuad(t)
      token.position.lerpVectors(start, end, e)
      // add a light hop arc
      const yArc = Math.sin(t * Math.PI) * 0.25
      token.position.y = baseY + yArc
    })
  }
  // small settle (optional)
  await tween(120, (t) => {
    token.rotation.z = (1 - t) * 0.06
  })
}

