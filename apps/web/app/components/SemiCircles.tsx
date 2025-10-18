"use client"

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Html } from '@react-three/drei'
import { ensureDevFlagsAPI, getDevFlag } from './dev/devFlags'
import bakedSemiCirclesRaw from '../../public/baked-in-content/semi-circle-zones.json'

type Edge = 'top' | 'bottom' | 'left' | 'right' | 'corner'
type Rect = { cx: number; cz: number; w: number; d: number; edge: Edge }

// Updated SemiTx to include all 3 axes for position and rotation
type SemiTx = {
  dx?: number; dy?: number; dz?: number;
  wScale?: number; dScale?: number;
  rotX?: number; rotY?: number; rotZ?: number;
  radius?: number; height?: number
}
type SemiMap = Record<string, SemiTx>

const SC_LS_KEY = 'monopoly.dev.semiCircles'

// --- NEW ---
// Default "perfect" style from your Tile 1 configuration
const DEFAULT_STYLE = {
  wScale: 1.2400000000000002,
  dScale: 1.12,
  height: 0.34992727272727225,
  radius: 0.40960000000000074,
  dy: -0.30414545454545455,
  rotX: 4.71238898038469,
  rotZ: 4.71238898038469
};

function readMap(): SemiMap {
  try {
    const raw = localStorage.getItem(SC_LS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as SemiMap
      // Migration step: handle old data from localStorage
      Object.keys(parsed).forEach(key => {
        const entry = parsed[key] as any;
        // Migrate old 'rot' field to 'rotY'
        if (entry.rot !== undefined && entry.rotY === undefined) {
          entry.rotY = entry.rot;
          delete entry.rot;
        }

        // --- UPDATED DEFAULTS ---
        // Set defaults for base position fields
        if (entry.dx === undefined) entry.dx = 0;
        if (entry.dz === undefined) entry.dz = 0;
        if (entry.rotY === undefined) entry.rotY = 0;

        // Set defaults for style fields
        if (entry.dy === undefined) entry.dy = DEFAULT_STYLE.dy;
        if (entry.rotX === undefined) entry.rotX = DEFAULT_STYLE.rotX;
        if (entry.rotZ === undefined) entry.rotZ = DEFAULT_STYLE.rotZ;
        if (entry.radius === undefined) entry.radius = DEFAULT_STYLE.radius;
        if (entry.height === undefined) entry.height = DEFAULT_STYLE.height;
        if (entry.wScale === undefined) entry.wScale = DEFAULT_STYLE.wScale;
        if (entry.dScale === undefined) entry.dScale = DEFAULT_STYLE.dScale;
      });
      return parsed;
    }
  } catch { }

  // Seed from baked semi-circle zones JSON.
  // This file is assumed to be in the correct SemiMap format
  // and contains all the "perfect" values.
  try {
    // We can just return a copy of the imported JSON object.
    // It's already in the SemiMap format.
    if (bakedSemiCirclesRaw && typeof bakedSemiCirclesRaw === 'object') {
      return { ...bakedSemiCirclesRaw } as SemiMap
    }
  } catch (err) {
    console.error('Failed to parse baked semi-circle zones:', err)
  }

  // Fallback to an empty map if the JSON is also malformed
  return {}
}
function writeMap(m: SemiMap) { try { localStorage.setItem(SC_LS_KEY, JSON.stringify(m)) } catch { } }



export default function SemiCircles({
  size,
  rectForTile,
}: {
  size: number
  rectForTile: (tile: number) => Rect
}) {
  ensureDevFlagsAPI()
  const enabled = getDevFlag('editSemiCircles' as any)
  const [map, setMap] = useState<SemiMap>(() => readMap())
  const [visible, setVisible] = useState<boolean>(false)
  const [selected, setSelected] = useState<number | null>(null)
  // New state to track the current editing axis
  const [editAxis, setEditAxis] = useState<'x' | 'y' | 'z'>('y')

  // Tiles present in baked zones
  // Tiles present in baked zones
  const tiles: number[] = useMemo(() => {
    try {
      // Get keys from the new JSON object and parse them as numbers
      return Object.keys(bakedSemiCirclesRaw).map(Number).filter(n => !isNaN(n))
    } catch { return [] }
  }, [])

  // Key controls for selected tile
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (!selected && selected !== 0) return
      const k = e.key.toLowerCase()
      const step = (e.shiftKey ? 0.06 : 0.02) * (size / 11)
      const rotStep = e.shiftKey ? Math.PI / 12 : Math.PI / 36
      const scaleStep = 0.04
      const id = String(selected)

      // --- UPDATED DEFAULTS ---
      // Ensure all new fields have defaults
      const cur = map[id] || {
        dx: 0,
        dy: DEFAULT_STYLE.dy,
        dz: 0,
        wScale: DEFAULT_STYLE.wScale,
        dScale: DEFAULT_STYLE.dScale,
        rotX: DEFAULT_STYLE.rotX,
        rotY: 0,
        rotZ: DEFAULT_STYLE.rotZ,
        radius: DEFAULT_STYLE.radius,
        height: DEFAULT_STYLE.height
      }
      let next: SemiTx | null = null

      // --- Axis Selection ---
      if (k === '1') { setEditAxis('x'); return }
      else if (k === '2') { setEditAxis('y'); return }
      else if (k === '3') { setEditAxis('z'); return }

      // --- Movement (WASD) ---
      // 'y' axis (default): Move on XZ plane
      // 'x' axis: Move on YZ plane
      // 'z' axis: Move on XY plane
      if (k === 'w') {
        if (editAxis === 'y') next = { ...cur, dz: (cur.dz || 0) - step } // Move +Z
        else if (editAxis === 'x') next = { ...cur, dz: (cur.dz || 0) + step } // Move +Z
        else if (editAxis === 'z') next = { ...cur, dy: (cur.dy || 0) + step } // Move +Y
      } else if (k === 's') {
        if (editAxis === 'y') next = { ...cur, dz: (cur.dz || 0) + step } // Move -Z
        else if (editAxis === 'x') next = { ...cur, dz: (cur.dz || 0) - step } // Move -Z
        else if (editAxis === 'z') next = { ...cur, dy: (cur.dy || 0) - step } // Move -Y
      } else if (k === 'a') {
        if (editAxis === 'y') next = { ...cur, dx: (cur.dx || 0) - step } // Move -X
        else if (editAxis === 'x') next = { ...cur, dy: (cur.dy || 0) - step } // Move -Y
        else if (editAxis === 'z') next = { ...cur, dx: (cur.dx || 0) - step } // Move -X
      } else if (k === 'd') {
        if (editAxis === 'y') next = { ...cur, dx: (cur.dx || 0) + step } // Move +X
        else if (editAxis === 'x') next = { ...cur, dy: (cur.dy || 0) + step } // Move +Y
        else if (editAxis === 'z') next = { ...cur, dx: (cur.dx || 0) + step } // Move +X
      }

      // --- Rotation (RF) ---
      // Rotates around the currently selected axis
      else if (k === 'r') {
        if (editAxis === 'x') next = { ...cur, rotX: (cur.rotX || 0) + rotStep }
        else if (editAxis === 'y') next = { ...cur, rotY: (cur.rotY || 0) + rotStep }
        else if (editAxis === 'z') next = { ...cur, rotZ: (cur.rotZ || 0) + rotStep }
      } else if (k === 'f') {
        if (editAxis === 'x') next = { ...cur, rotX: (cur.rotX || 0) - rotStep }
        else if (editAxis === 'y') next = { ...cur, rotY: (cur.rotY || 0) - rotStep }
        else if (editAxis === 'z') next = { ...cur, rotZ: (cur.rotZ || 0) - rotStep }
      }

      // --- 90-deg Snap Rotate (E) ---
      // Rotates 90 degrees on the currently selected axis
      else if (k === 'e') {
        const ninetyDeg = Math.PI / 2
        if (editAxis === 'x') next = { ...cur, rotX: (cur.rotX || 0) + ninetyDeg }
        else if (editAxis === 'y') next = { ...cur, rotY: (cur.rotY || 0) + ninetyDeg }
        else if (editAxis === 'z') next = { ...cur, rotZ: (cur.rotZ || 0) + ninetyDeg }
      }

      // --- Other controls (unchanged) ---
      else if (k === 't') next = { ...cur, wScale: Math.max(0.2, (cur.wScale || 1) + scaleStep) }
      else if (k === 'g') next = { ...cur, wScale: Math.max(0.2, (cur.wScale || 1) - scaleStep) }
      else if (k === 'y') next = { ...cur, dScale: Math.max(0.2, (cur.dScale || 1) + scaleStep) }
      else if (k === 'h') next = { ...cur, dScale: Math.max(0.2, (cur.dScale || 1) - scaleStep) }
      else if (k === 'i') next = { ...cur, radius: Math.max(0.01, (cur.radius || 1) + step) }
      else if (k === 'k') next = { ...cur, radius: Math.max(0.01, (cur.radius || 1) - step) }
      else if (k === 'u') next = { ...cur, height: Math.max(0.001, (cur.height || 0.01) + step * 0.5) }
      else if (k === 'j') next = { ...cur, height: Math.max(0.001, (cur.height || 0.01) - step * 0.5) }
      else if (k === 'm') { setVisible(true); return }
      else if (k === 'n') { setVisible(false); return }

      if (next) {
        const nm = { ...map, [id]: next }
        setMap(nm); writeMap(nm)
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, selected, map, size, editAxis]) // *** Add editAxis to dependency array ***

  if (!enabled) return null


  useEffect(() => {
    if (!enabled) {
      // Clean up if dev flags are disabled
      if ((window as any).getSemiCircleData) {
        delete (window as any).getSemiCircleData
      }
      return
    }

    // Attach function to window
    ; (window as any).getSemiCircleData = () => {
      console.log('SemiCircle Data Map:', map)
      return map
    }

    // Cleanup function to remove it when component unmounts
    return () => {
      if ((window as any).getSemiCircleData) {
        delete (window as any).getSemiCircleData
      }
    }
  }, [map, enabled]) // Re-attaches if map or enabled status changes


  // Render interactive zones and optional semicircles
  return (
    <group>
      {tiles.map((ti) => {
        const rect = rectForTile(ti)
        if (rect.edge === 'corner') return null

        // --- UPDATED DEFAULTS ---
        // Pull all properties with defaults
        const tx = map[String(ti)] || {
          dx: 0,
          dy: DEFAULT_STYLE.dy,
          dz: 0,
          wScale: DEFAULT_STYLE.wScale,
          dScale: DEFAULT_STYLE.dScale,
          rotX: DEFAULT_STYLE.rotX,
          rotY: 0,
          rotZ: DEFAULT_STYLE.rotZ,
          radius: DEFAULT_STYLE.radius,
          height: DEFAULT_STYLE.height
        }

        const baseW = rect.w, baseD = rect.d
        const sx = baseW * (tx.wScale || 1)
        const sz = baseD * (tx.dScale || 1)

        // --- Calculate final position ---
        let cx = rect.cx + (tx.dx || 0)
        let cz = rect.cz + (tx.dz || 0)

        // Original offset logic for scaling the *plane*
        const dw = (sx - baseW) / 2
        const dd = (sz - baseD) / 2
        switch (rect.edge) {
          case 'bottom': cx += dw; cz += dd; break
          case 'top': cx += dw; cz -= dd; break
          case 'left': cz += dw; cx += dd; break
          case 'right': cx += dw; cx -= dd; break
        }

        const height = tx.height || 0.01;
        const baseY = 0.008; // Base y position on the board
        const cy = baseY + (tx.dy || 0); // Final y position including offset
        const isSel = selected === ti

        const radius = tx.radius || Math.min(sx, sz) * 0.40;

        // --- Semicircle Position & Rotation ---
        // Position the cylinder's *center*
        const pos: [number, number, number] = [cx, cy + height / 2, cz]
        const rotX = tx.rotX || 0
        const rotY = tx.rotY || 0
        const rotZ = tx.rotZ || 0

        // --- Clickable Zone Position & Rotation ---
        // Stays flat on the board, but respects dx/dz and yaw (rotY)
        const clickZonePos: [number, number, number] = [cx, baseY, cz]
        // Only apply Y-axis rotation to the flat clickable zone
        const clickZoneRot: [number, number, number] = [0, tx.rotY || 0, 0]

        return (
          <group key={`sc-${ti}`}>
            {/* clickable zone */}
            <group
              position={clickZonePos}
              rotation={clickZoneRot}
              onPointerDown={(e: any) => { e.stopPropagation(); setSelected(ti) }}
            >
              <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
                <planeGeometry args={[sx, sz]} />
                <meshBasicMaterial color={isSel ? '#22c55e' : '#60a5fa'} transparent opacity={isSel ? 0.35 : 0.2} depthWrite={false} />
              </mesh>
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0001, 0]} renderOrder={4}>
                <planeGeometry args={[sx, sz]} />
                <meshBasicMaterial color={isSel ? '#ffffff' : '#111827'} wireframe transparent opacity={0.6} depthWrite={false} />
              </mesh>
              <Html center distanceFactor={12} position={[0, 0.0015, 0]}>
                <div style={{ background: 'rgba(0,0,0,0.1)', minWidth: 30, color: '#fff', padding: '0px 0px', fontSize: 11, borderRadius: 6 }}>
                  {/* Show current axis mode ONLY if selected */}
                  SC {ti} {isSel && `[${editAxis.toUpperCase()}]`}
                </div>
              </Html>
            </group>

            {/* linked semicircle (now filled) */}
            {visible && (
              // 1. This group handles position and all 3 rotations (X, Y, Z)
              <group position={pos} rotation={[rotX, rotY, rotZ]}>
                {/* 2. This mesh rotates the cylinder to lie flat *locally* */}
                <mesh rotation={[-Math.PI / 2, 0, 0]}>
                  <cylinderGeometry
                    args={[
                      radius, // radiusTop
                      radius, // radiusBottom
                      height, // height
                      32,     // radialSegments (for smoothness)
                      1,      // heightSegments
                      false,  // openEnded (false to have top/bottom caps)
                      0,      // thetaStart (start angle of the semicircle)
                      Math.PI // thetaLength (length of the semicircle arc)
                    ]}
                  />
                  <meshStandardMaterial color={'#e11d48'} roughness={0.5} metalness={0.2} side={2} />
                </mesh>
              </group>
            )}
          </group>
        )
      })}
    </group>
  )
}