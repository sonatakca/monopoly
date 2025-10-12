"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

export type HopStep = { to: [number, number, number]; yaw: number }

type Props = {
  steps: HopStep[]
  startAt: number
  stepMs?: number
  hopHeight?: number
  onStart?: () => void
  onDone?: () => void
  children: React.ReactNode
}

export default function HopAnimator({ steps, startAt, stepMs = 2600, hopHeight = 0.28, onStart, onDone, children }: Props) {
  const groupRef = useRef<THREE.Group>(null)
  const posRef = useRef<[number, number, number] | null>(null)
  const yawRef = useRef<number>(0)
  const lastSeqRef = useRef<string>("")
  const startedRef = useRef(false)

  const key = useMemo(() => steps.map(s => `${s.to[0].toFixed(3)}:${s.to[2].toFixed(3)}`).join("|"), [steps])

  useEffect(() => {
    // Reset when steps change meaningfully
    if (lastSeqRef.current !== key) {
      lastSeqRef.current = key
      startedRef.current = false
      // Initialize to first position if available
      if (steps.length) {
        posRef.current = steps[0].to
        yawRef.current = steps[0].yaw
        if (groupRef.current) {
          groupRef.current.position.set(steps[0].to[0], steps[0].to[1], steps[0].to[2])
          groupRef.current.rotation.y = steps[0].yaw
        }
      }
    }
  }, [key, steps])

  useFrame(() => {
    const now = performance.now()
    const total = Math.max(0, steps.length - 1)
    if (total <= 0) return

    const timeline = now - startAt
    if (timeline < 0) return // waiting to start

    if (!startedRef.current) { startedRef.current = true; onStart?.() }

    // Determine which segment we're in
    const seg = Math.min(total - 1, Math.floor(timeline / stepMs))
    const tRaw = Math.min(1, (timeline - seg * stepMs) / stepMs)
    const t = 1 - Math.pow(1 - tRaw, 3) // ease-out cubic

    const from = steps[seg]
    const to = steps[seg + 1]
    const nx = from.to[0] + (to.to[0] - from.to[0]) * t
    const nz = from.to[2] + (to.to[2] - from.to[2]) * t
    const baseY = to.to[1]
    const distXZ = Math.hypot(to.to[0] - from.to[0], to.to[2] - from.to[2])
    const hop = distXZ < 1e-5 ? 0 : hopHeight
    const ny = baseY + Math.sin(Math.PI * t) * hop

    const wrap = (a: number) => (a + Math.PI * 3) % (Math.PI * 2) - Math.PI
    const dy = wrap(to.yaw - from.yaw)
    const yaw = wrap(from.yaw + dy * t)

    posRef.current = [nx, ny, nz]
    yawRef.current = yaw
    if (groupRef.current) {
      groupRef.current.position.set(nx, ny, nz)
      groupRef.current.rotation.y = yaw
    }

    if (seg >= total - 1 && tRaw >= 1) {
      onDone?.()
    }
  })

  return (
    <group ref={groupRef}>
      {children}
    </group>
  )
}
