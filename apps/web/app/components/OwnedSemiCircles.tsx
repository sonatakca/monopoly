"use client"

import React, { useMemo } from 'react'
import * as THREE from 'three'
import bakedSemiCirclesRaw from '../../public/baked-in-content/semi-circle-zones.json'

type Edge = 'top' | 'bottom' | 'left' | 'right' | 'corner'
type Rect = { cx: number; cz: number; w: number; d: number; edge: Edge }

type SemiTx = {
  dx?: number; dy?: number; dz?: number;
  wScale?: number; dScale?: number;
  rotX?: number; rotY?: number; rotZ?: number;
  radius?: number; height?: number
}
type SemiMap = Record<string, SemiTx>

const SC_LS_KEY = 'monopoly.dev.semiCircles'

const DEFAULT_STYLE: Required<Pick<SemiTx, 'wScale' | 'dScale' | 'height' | 'radius' | 'dy' | 'rotX' | 'rotZ'>> = {
  wScale: 1.2400000000000002,
  dScale: 1.12,
  height: 0.34992727272727225,
  radius: 0.40960000000000074,
  dy: -0.30414545454545455,
  rotX: 4.71238898038469,
  rotZ: 4.71238898038469,
}

function readMap(): SemiMap {
  // Start from baked zones as baseline
  let base: SemiMap = {}
  try {
    if (bakedSemiCirclesRaw && typeof bakedSemiCirclesRaw === 'object') {
      base = { ...bakedSemiCirclesRaw } as SemiMap
    }
  } catch { }

  // Merge localStorage overrides on top (per-tile), never discard baked keys
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(SC_LS_KEY) : null
    if (raw) {
      const parsed = JSON.parse(raw) as SemiMap
      for (const k of Object.keys(parsed || {})) {
        const fromBaked = base[k] || {}
        const fromLS = parsed[k] || {}
        base[k] = { ...fromBaked, ...fromLS }
      }
    }
  } catch { }

  // Migrate and fill defaults for all entries
  try {
    Object.keys(base).forEach(k => {
      const e: any = base[k]
      if (e.rot !== undefined && e.rotY === undefined) { e.rotY = e.rot; delete e.rot }
      if (e.dx === undefined) e.dx = 0
      if (e.dz === undefined) e.dz = 0
      if (e.rotY === undefined) e.rotY = 0
      if (e.dy === undefined) e.dy = DEFAULT_STYLE.dy
      if (e.rotX === undefined) e.rotX = DEFAULT_STYLE.rotX
      if (e.rotZ === undefined) e.rotZ = DEFAULT_STYLE.rotZ
      if (e.radius === undefined) e.radius = DEFAULT_STYLE.radius
      if (e.height === undefined) e.height = DEFAULT_STYLE.height
      if (e.wScale === undefined) e.wScale = DEFAULT_STYLE.wScale
      if (e.dScale === undefined) e.dScale = DEFAULT_STYLE.dScale
    })
  } catch { }

  return base
}

export default function OwnedSemiCircles({
  size,
  rectForTile,
  ownedTiles,
  color = '#e11d48',
  colorByTile,
}: {
  size: number
  rectForTile: (tile: number) => Rect
  ownedTiles: Set<number>
  color?: string
  colorByTile?: Record<number, string>
}) {
  const map = useMemo(() => readMap(), [])

  // Only consider tiles present in the map and owned
  const tiles: number[] = useMemo(() => {
    try {
      return Object.keys(map).map(Number).filter(n => !isNaN(n) && ownedTiles.has(n))
    } catch { return [] }
  }, [map, ownedTiles])

  if (tiles.length === 0) return null

  // Cache gradient textures per color
  const gradientForColor = useMemo(() => {
    const cache = new Map<string, THREE.Texture>()
    function hexToRgb(hex: string): { r: number; g: number; b: number } {
      const s = hex.replace('#', '')
      const n = parseInt(s.length === 3 ? s.split('').map(c => c + c).join('') : s, 16)
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
    }
    function make(texColor: string): THREE.Texture {
      if (cache.has(texColor)) return cache.get(texColor) as THREE.Texture
      const { r, g, b } = hexToRgb(texColor)
      const w = 4, h = 64
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
      const grad = ctx.createLinearGradient(0, 0, 0, h)
      // Top: solid, Bottom: ~60% (like #xx99)
      grad.addColorStop(0, `rgba(${r},${g},${b},1)`)
      grad.addColorStop(1, `rgba(${r},${g},${b},1)`)
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, w, h)
      const tex = new THREE.CanvasTexture(canvas)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.needsUpdate = true
      cache.set(texColor, tex)
      return tex
    }
    return make
  }, [])

  return (
    <group>
      {tiles.map((ti) => {
        const rect = rectForTile(ti)
        if (!rect || rect.edge === 'corner') return null

        const tx = map[String(ti)] || {}

        const baseW = rect.w, baseD = rect.d
        const sx = baseW * (tx.wScale ?? DEFAULT_STYLE.wScale)
        const sz = baseD * (tx.dScale ?? DEFAULT_STYLE.dScale)

        // Base position with per-tile offsets
        let cx = rect.cx + (tx.dx || 0)
        let cz = rect.cz + (tx.dz || 0)

        // Adjust for scaled plane relative to tile edge
        const dw = (sx - baseW) / 2
        const dd = (sz - baseD) / 2
        switch (rect.edge) {
          case 'bottom': cx += dw; cz += dd; break
          case 'top': cx += dw; cz -= dd; break
          case 'left': cz += dw; cx += dd; break
          case 'right': cx += dw; cx -= dd; break
        }

        const height = tx.height ?? DEFAULT_STYLE.height
        const baseY = 0.008
        const cy = baseY + (tx.dy ?? DEFAULT_STYLE.dy)

        const radius = tx.radius ?? Math.min(sx, sz) * 0.40

        // Final placement and rotation
        // Slight epsilon above computed placement to avoid any z-fighting with board plane
        const pos: [number, number, number] = [cx, cy + height / 2 + 0.001, cz]
        const rotX = tx.rotX ?? DEFAULT_STYLE.rotX
        const rotY = tx.rotY ?? 0
        const rotZ = tx.rotZ ?? DEFAULT_STYLE.rotZ

        const tileColor = (colorByTile && colorByTile[ti]) || color
        const mapTex = gradientForColor(tileColor)
        return (
          <group key={`owned-sc-${ti}`} position={pos} rotation={[rotX, rotY, rotZ]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
              <cylinderGeometry
                args={[
                  radius, // radiusTop
                  radius, // radiusBottom
                  height, // height
                  32,     // radialSegments
                  1,      // heightSegments
                  false,  // openEnded
                  0,      // thetaStart
                  Math.PI // thetaLength (semi-circle)
                ]}
              />
              <meshStandardMaterial
                color={'#ffffff'}
                map={mapTex as any}
                // transparent
                roughness={0.5}
                metalness={0.2}
                side={2}
              />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}
