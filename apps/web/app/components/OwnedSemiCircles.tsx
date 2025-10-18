"use client"

import React, { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
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

  // Animation state: first-seen timestamps and refs per tile
  const appearStartRef = useRef<Record<number, number>>({})
  const groupRefs = useRef<Record<number, THREE.Group | null>>({})
  const matRefs = useRef<Record<number, THREE.MeshStandardMaterial | null>>({})
  const tilesRef = useRef<number[]>(tiles)
  // Track previous colors and tiles to detect transfers
  const prevColorsRef = useRef<Record<number, string>>({})
  const prevTilesRef = useRef<Set<number>>(new Set())
  // Outgoing animation data when ownership changes hands or is removed
  const outAnimsRef = useRef<Record<number, { start: number; color: string }>>({})
  const outGroupRefs = useRef<Record<number, THREE.Group | null>>({})
  const outMatRefs = useRef<Record<number, THREE.MeshStandardMaterial | null>>({})

  useEffect(() => {
    tilesRef.current = tiles
    const now = performance.now()
    for (const ti of tiles) {
      if (appearStartRef.current[ti] == null) appearStartRef.current[ti] = now
    }
    // Cleanup timestamps for tiles no longer owned to allow re-animate if reacquired later
    for (const key of Object.keys(appearStartRef.current)) {
      const k = Number(key)
      if (!tiles.includes(k)) delete appearStartRef.current[k]
    }
    // Detect removed tiles and trigger outgoing animation
    const prevTiles = prevTilesRef.current
    const prevColors = prevColorsRef.current
    prevTiles.forEach((ti) => {
      if (!tiles.includes(ti)) {
        const prevColor = prevColors[ti] || color
        outAnimsRef.current[ti] = { start: now, color: prevColor }
      }
    })
    // Detect color changes for still-owned tiles and trigger outgoing + restart incoming
    for (const ti of tiles) {
      const newColor = (colorByTile && colorByTile[ti]) || color
      const prevColor = prevColors[ti]
      if (prevColor && prevColor !== newColor) {
        outAnimsRef.current[ti] = { start: now, color: prevColor }
        // Start incoming immediately to crossfade with outgoing (smoother)
        appearStartRef.current[ti] = now
      }
    }
    // Update prev snapshots
    prevColorsRef.current = Object.fromEntries(tiles.map((ti) => [ti, (colorByTile && colorByTile[ti]) || color]))
    prevTilesRef.current = new Set(tiles)
  }, [tiles])

  const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
  const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3)
  const easeInCubic = (x: number) => x * x * x
  const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)

  useFrame(() => {
    const now = performance.now()
    const duration = 520 // ms
    const list = tilesRef.current
    for (const ti of list) {
      const start = appearStartRef.current[ti] || now
      const raw = (now - start) / duration
      if (raw <= 0) {
        const g0 = groupRefs.current[ti]
        const m0 = matRefs.current[ti]
        if (g0) g0.scale.setScalar(0.8)
        if (m0) m0.opacity = 0
        continue
      }
      const p = clamp01(raw)
      const s = 0.85 + 0.15 * easeOutCubic(p)
      const g = groupRefs.current[ti]
      const m = matRefs.current[ti]
      if (g) g.scale.setScalar(s)
      if (m) m.opacity = easeInOutCubic(p)
    }
    // Animate outgoing (reverse) and clean up after finish
    const outKeys = Object.keys(outAnimsRef.current)
    for (const key of outKeys) {
      const ti = Number(key)
      const rec = outAnimsRef.current[ti]
      if (!rec) continue
      const p = clamp01((now - rec.start) / duration)
      const g = outGroupRefs.current[ti]
      const m = outMatRefs.current[ti]
      const s = 1.0 - 0.15 * easeInOutCubic(p)
      if (g) g.scale.setScalar(Math.max(0.0001, s))
      if (m) m.opacity = 1.0 - easeInOutCubic(p)
      if (p >= 1) {
        delete outAnimsRef.current[ti]
        if (outGroupRefs.current[ti]) outGroupRefs.current[ti] = null
        if (outMatRefs.current[ti]) outMatRefs.current[ti] = null
      }
    }
  })

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

        // Final placement and rotation — match edit tool exactly
        const pos: [number, number, number] = [cx, cy + height / 2, cz]
        const rotX = tx.rotX ?? DEFAULT_STYLE.rotX
        const rotY = tx.rotY ?? 0
        const rotZ = tx.rotZ ?? DEFAULT_STYLE.rotZ

        const tileColor = (colorByTile && colorByTile[ti]) || color
        const mapTex = gradientForColor(tileColor)
        return (
          <group key={`owned-sc-${ti}`} position={pos} rotation={[rotX, rotY, rotZ]} ref={el => { groupRefs.current[ti] = el }}>
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
                opacity={0}
                ref={el => { matRefs.current[ti] = el as any }}
              />
            </mesh>
          </group>
        )
      })}
      {/* Outgoing reverse-animating semicircles (color the previous owner) */}
      {Object.keys(outAnimsRef.current).map((key) => {
        const ti = Number(key)
        if (Number.isNaN(ti)) return null
        const rect = rectForTile(ti)
        if (!rect || rect.edge === 'corner') return null
        const tx = map[String(ti)] || {}
        const baseW = rect.w, baseD = rect.d
        const sx = baseW * (tx.wScale ?? DEFAULT_STYLE.wScale)
        const sz = baseD * (tx.dScale ?? DEFAULT_STYLE.dScale)
        let cx = rect.cx + (tx.dx || 0)
        let cz = rect.cz + (tx.dz || 0)
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
        const pos: [number, number, number] = [cx, cy + height / 2 + 0.001, cz]
        const rotX = tx.rotX ?? DEFAULT_STYLE.rotX
        const rotY = tx.rotY ?? 0
        const rotZ = tx.rotZ ?? DEFAULT_STYLE.rotZ
        const rec = outAnimsRef.current[ti]
        const outColor = rec?.color || color
        const outTex = gradientForColor(outColor)
        return (
          <group key={`owned-sc-out-${ti}`} position={pos} rotation={[rotX, rotY, rotZ]} ref={el => { outGroupRefs.current[ti] = el }}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
              <cylinderGeometry args={[radius, radius, height, 32, 1, false, 0, Math.PI]} />
              <meshStandardMaterial
                color={'#ffffff'}
                map={outTex as any}
                transparent
                roughness={0.5}
                metalness={0.2}
                side={2}
                opacity={1}
                ref={el => { outMatRefs.current[ti] = el as any }}
              />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}
