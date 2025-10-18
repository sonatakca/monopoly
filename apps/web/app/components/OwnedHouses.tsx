"use client"

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import bakedHouseZonesRaw from '../../public/baked-in-content/house-hotel-zones.json'

type Edge = 'top' | 'bottom' | 'left' | 'right' | 'corner'
type Rect = { cx: number; cz: number; w: number; d: number; edge: Edge }

type HouseZoneSlotTx = { dx?: number; dz?: number }
type HouseZoneHotelTx = { dx?: number; dz?: number }
type HouseZoneTx = {
  dx?: number; dz?: number; wScale?: number; dScale?: number; rot?: number; modelYaw?: number;
  slots?: Record<string, HouseZoneSlotTx>;
  houseCount?: number;
  hotel?: HouseZoneHotelTx;
}
type HouseZonesMap = Record<string, HouseZoneTx>

const HOUSE_ZONES_LS = 'monopoly.dev.houseZones'

const BAKED_HOUSE_ZONES: HouseZonesMap = (() => {
  const map: HouseZonesMap = {}
  try {
    if (Array.isArray(bakedHouseZonesRaw)) {
      for (const entry of bakedHouseZonesRaw as any[]) {
        if (entry && typeof entry.tile === 'number') {
          map[String(entry.tile)] = entry.tx || {}
        }
      }
    }
  } catch { }
  return map
})()

function readHouseZones(): HouseZonesMap {
  let base: HouseZonesMap = { ...BAKED_HOUSE_ZONES }
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(HOUSE_ZONES_LS) : null
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        for (const k of Object.keys(parsed)) base[k] = { ...base[k], ...parsed[k] }
      }
    }
  } catch { }
  return base
}

// Match editPropertyZones overlay values exactly
const HOUSE_SCALE = 0.0125
const HOTEL_SCALE = 0.018
const HOUSE_Y_OFFSET = 0.08
const HOTEL_Y_OFFSET = 0.13

const HouseModel = ({ color = '#22c55e', ...props }) => {
  const geom = useLoader(STLLoader, '/models/Property%20Types/House.stl') as THREE.BufferGeometry
  const processedGeom = useMemo(() => {
    const g = geom.clone()
    g.computeVertexNormals(); g.computeBoundingBox()
    const bb = g.boundingBox as THREE.Box3
    g.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2)
    return g
  }, [geom])
  return (
    <group {...props}>
      <mesh castShadow receiveShadow geometry={processedGeom} rotation={[-Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color={color} metalness={0.15} roughness={0.55} />
      </mesh>
    </group>
  )
}

const HotelModel = ({ color = '#ef4444', ...props }) => {
  const geom = useLoader(STLLoader, '/models/Property%20Types/Hotel.stl') as THREE.BufferGeometry
  const processedGeom = useMemo(() => {
    const g = geom.clone()
    g.computeVertexNormals(); g.computeBoundingBox()
    const bb = g.boundingBox as THREE.Box3
    g.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2)
    return g
  }, [geom])
  return (
    <group {...props}>
      <mesh castShadow receiveShadow geometry={processedGeom} rotation={[-Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color={color} metalness={0.15} roughness={0.55} />
      </mesh>
    </group>
  )
}

export default function OwnedHouses({
  size,
  rectForHouse,
  players,
}: {
  size: number
  rectForHouse: (tile: number) => Rect
  players: Record<string, { houses?: Record<number, number>; hotels?: Record<number, number> }>
}) {
  const zones = useMemo(() => readHouseZones(), [])
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const onForce = () => setTick(v => v + 1)
    window.addEventListener('monopoly:forceRender', onForce)
    return () => window.removeEventListener('monopoly:forceRender', onForce)
  }, [])

  // Build per-tile counts from players; fallback to zones.houseCount if no owner data
  const counts = useMemo(() => {
    const m: Record<number, number> = {}
    try {
      Object.values(players || {}).forEach((pl: any) => {
        const houses = pl?.houses || {}
        const hotels = pl?.hotels || {}
        for (const k of Object.keys(houses)) {
          const id = Number(k); if (!Number.isFinite(id)) continue
          const h = houses[id] || 0
          if (h > 0) m[id] = Math.max(m[id] || 0, h)
        }
        for (const k of Object.keys(hotels)) {
          const id = Number(k); if (!Number.isFinite(id)) continue
          const has = hotels[id] ? 5 : 0
          if (has > 0) m[id] = 5
        }
      })
    } catch { }
    // Fallback from zones map if still empty
    if (Object.keys(m).length === 0) {
      for (const k of Object.keys(zones)) {
        const id = Number(k); if (!Number.isFinite(id)) continue
        const c = zones[k]?.houseCount || 0
        if (c > 0) m[id] = c
      }
    }
    return m
  }, [players, zones, tick])

  const tiles = useMemo(() => Object.keys(counts).map(Number).filter(n => counts[n] > 0), [counts])
  if (tiles.length === 0) return null

  return (
    <group>
      {tiles.map((ti) => {
        const rect = rectForHouse(ti)
        if (!rect || rect.edge === 'corner') return null
        const tx = zones[String(ti)] || {}
        const baseW = rect.w, baseD = rect.d
        const sx = baseW * (tx.wScale || 1)
        const sz = baseD * (tx.dScale || 1)
        const cx = rect.cx + (tx.dx || 0)
        const cz = rect.cz + (tx.dz || 0)
        const rotY = tx.rot || 0

        const houseCount = counts[ti] || 0
        const innerGap = 0.08 * sz
        const innerD = (sz - innerGap * 3) / 4
        const houseSlots = Array.from({ length: 4 }, (_, i) => ({ lx: 0, lz: -sz / 2 + innerD / 2 + i * (innerD + innerGap) }))
        const hotelTx = tx.hotel || {}

        // Match overlay yaw helper
        const yaw = zones[String(ti)]?.modelYaw || 0
        return (
          <group key={`owned-houses-${ti}`} position={[cx, 0.007, cz]} rotation={[0, rotY, 0]}>
            <Suspense fallback={null}>
              {houseCount > 0 && houseCount < 5 && (
                Array.from({ length: houseCount }).map((_, houseIdx) => {
                  const slot = houseSlots[houseIdx]; if (!slot) return null
                  const slotTx = tx.slots?.[String(houseIdx)] || {}
                  const position: [number, number, number] = [slot.lx + (slotTx.dx || 0), HOUSE_Y_OFFSET, slot.lz + (slotTx.dz || 0)]
                  return <HouseModel key={`house-${ti}-${houseIdx}`} position={position} rotation={[0, yaw, 0]} scale={HOUSE_SCALE} />
                })
              )}
              {houseCount === 5 && (
                <HotelModel position={[hotelTx.dx || 0, HOTEL_Y_OFFSET, hotelTx.dz || 0]} rotation={[0, yaw, 0]} scale={HOTEL_SCALE} />
              )}
            </Suspense>
          </group>
        )
      })}
    </group>
  )
}
