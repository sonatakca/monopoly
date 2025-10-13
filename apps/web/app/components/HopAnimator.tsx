"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

export type HopStep = { to: [number, number, number]; yaw: number }

type Props = {
  startDelayMs?: number
  steps: HopStep[]
  startAt: number
  stepMs?: number
  hopHeight?: number
  // Scale only the last hop's duration (e.g., 1.6 for 60% slower)
  lastStepScale?: number
  // Scale only the last hop's height (e.g., 1.5 for 50% higher)
  lastHopScale?: number
  // Called when a segment finishes (index of the finished segment)
  onSegmentEnd?: (segIndex: number) => void
  onStart?: () => void
  onDone?: () => void
  children: React.ReactNode
}

export default function HopAnimator({ steps, startAt, startDelayMs = 0, stepMs = 2600, hopHeight = 0.28, lastStepScale = 1, lastHopScale = 1, onSegmentEnd, onStart, onDone, children }: Props) {
  const groupRef = useRef<THREE.Group>(null)
  const posRef = useRef<[number, number, number] | null>(null)
  const yawRef = useRef<number>(0)
  const lastSeqRef = useRef<string>("")
  const startedRef = useRef(false)
  const segRef = useRef<number>(-1)

  const key = useMemo(() => steps.map(s => `${s.to[0].toFixed(3)}:${s.to[2].toFixed(3)}`).join("|"), [steps])

  useEffect(() => {
    // Reset when steps change meaningfully
    if (lastSeqRef.current !== key) {
      lastSeqRef.current = key
      startedRef.current = false
      segRef.current = -1
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
    const segments = Math.max(0, steps.length - 1)
    if (segments <= 0) return

    const timeline = now - (startAt + (startDelayMs || 0))
    if (timeline < 0) return // waiting to start

    if (!startedRef.current) { startedRef.current = true; onStart?.() }

    const lastIndex = segments - 1
    const lastScale = Math.max(0.0001, lastStepScale || 1)
    const baseSegments = Math.max(0, segments - 1)
    const baseDuration = baseSegments * stepMs
    const lastDuration = segments > 0 ? stepMs * lastScale : 0
    const totalDuration = baseDuration + lastDuration

    if (timeline >= totalDuration) {
      // Signal end of the last segment if not already
      if (segRef.current !== lastIndex) {
        if (segRef.current >= 0) onSegmentEnd?.(segRef.current)
        segRef.current = lastIndex
        onSegmentEnd?.(lastIndex)
      }
      const last = steps[steps.length - 1]
      posRef.current = last.to
      yawRef.current = last.yaw
      if (groupRef.current) {
        groupRef.current.position.set(last.to[0], last.to[1], last.to[2])
        groupRef.current.rotation.y = last.yaw
      }
      onDone?.()
      return
    }

    let seg = 0
    let tRaw = 0
    if (timeline < baseDuration) {
      seg = Math.min(baseSegments - 1, Math.floor(timeline / stepMs))
      tRaw = Math.min(1, (timeline - seg * stepMs) / stepMs)
    } else {
      seg = lastIndex
      const localMs = stepMs * lastScale
      tRaw = Math.min(1, (timeline - baseDuration) / localMs)
    }
    if (seg !== segRef.current) {
      if (segRef.current >= 0) onSegmentEnd?.(segRef.current)
      segRef.current = seg
    }
    const t = 1 - Math.pow(1 - tRaw, 3)

    const from = steps[seg]
    const to = steps[seg + 1]
    const nx = from.to[0] + (to.to[0] - from.to[0]) * t
    const nz = from.to[2] + (to.to[2] - from.to[2]) * t
    const baseY = to.to[1]
    const distXZ = Math.hypot(to.to[0] - from.to[0], to.to[2] - from.to[2])
    const heightScale = seg === lastIndex ? (lastHopScale || 1) : 1
    const hop = distXZ < 1e-5 ? 0 : hopHeight * heightScale
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

    if (seg === lastIndex && tRaw >= 1) {
      onDone?.()
    }
  })

  return (
    <group ref={groupRef}>
      {children}
    </group>
  )
}

