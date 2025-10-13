"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"

type ReelProps = {
  target: 1 | 2 | 3 | 4 | 5 | 6
  trigger?: number | string
  durationMs?: number
  delayMs?: number
  size?: number
  onDone?: () => void
}

function DiceSvg({ value, size = 28, faceColor = "#fff", pipColor = "#111", stroke = "#111" }: { value: 1 | 2 | 3 | 4 | 5 | 6; size?: number; faceColor?: string; pipColor?: string; stroke?: string }) {
  const r = Math.max(2, Math.round(size * 0.083))
  const s = size
  const pad = Math.round(size * 0.22)
  const tl = { x: pad, y: pad }
  const tr = { x: s - pad, y: pad }
  const bl = { x: pad, y: s - pad }
  const br = { x: s - pad, y: s - pad }
  const mid = { x: s / 2, y: s / 2 }
  const ml = { x: pad, y: s / 2 }
  const mr = { x: s - pad, y: s / 2 }
  const pips: Array<{ x: number; y: number }> = []
  switch (value) {
    case 1: pips.push(mid); break
    case 2: pips.push(tl, br); break
    case 3: pips.push(tl, mid, br); break
    case 4: pips.push(tl, tr, bl, br); break
    case 5: pips.push(tl, tr, bl, br, mid); break
    case 6: pips.push(tl, ml, bl, tr, mr, br); break
  }
  const corner = Math.round(s * 0.18)
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} role="img" aria-label={`Dice ${value}`}>
      <rect x={1} y={1} width={s - 2} height={s - 2} rx={corner} ry={corner} fill={faceColor} stroke={stroke} strokeWidth={2} />
      {pips.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={r} fill={pipColor} />
      ))}
    </svg>
  )
}

function SlotReel({ target, trigger, durationMs = 1200, delayMs = 0, size = 28, onDone }: ReelProps) {
  const [value, setValue] = useState<number>(target)
  const [spinning, setSpinning] = useState(false)
  const timersRef = useRef<number[]>([])

  const face = <DiceSvg value={value as any} size={size} faceColor="#fff" pipColor="#111" stroke="#111" />

  useEffect(() => {
    // Clear any previous schedule
    timersRef.current.forEach((id) => clearTimeout(id))
    timersRef.current = []

    // Build an easing schedule of step intervals from fast -> slow
    const total = Math.max(600, durationMs)
    const steps = 20
    const minI = 40
    const maxI = 220
    const intervals: number[] = []
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1)
      const ease = 1 - Math.pow(1 - t, 2) // ease-out quad
      intervals.push(Math.round(minI + (maxI - minI) * ease))
    }
    // Normalize to total
    const sum = intervals.reduce((a, b) => a + b, 0)
    const scale = (total - delayMs) / sum
    const scaled = intervals.map((x) => Math.max(10, Math.round(x * scale)))

    // Random starting point; last value is target
    const start = Math.floor(Math.random() * 6) + 1
    let cur = start
    setValue(cur as any)
    setSpinning(true)

    let acc = delayMs
    for (let i = 0; i < scaled.length; i++) {
      const id = window.setTimeout(() => {
        if (i < scaled.length - 1) {
          cur = ((cur % 6) + 1)
          setValue(cur as any)
        } else {
          // Final landing: target
          setValue(target)
          setSpinning(false)
          onDone?.()
        }
      }, acc) as any
      timersRef.current.push(id)
      acc += scaled[i]
    }

    return () => {
      timersRef.current.forEach((id) => clearTimeout(id))
      timersRef.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger, target, durationMs, delayMs])

  return (

    <div style={{ transition: spinning ? "transform 120ms ease" : "none", transform: spinning ? `translateY(${Math.random() * 6 - 3}px)` : "translateY(0)", filter: spinning ? "blur(0.4px)" : "none" }}>
      {face}
    </div>
  )
}

export default function DiceSlots({ d1, d2, trigger, align = "center" as const, size = 280 }: { d1: 1 | 2 | 3 | 4 | 5 | 6; d2: 1 | 2 | 3 | 4 | 5 | 6; trigger?: number | string; align?: "left" | "center" | "right"; size?: number }) {
  const wrap: React.CSSProperties = useMemo(
    () => ({ display: "flex", gap: 10, alignItems: "center", justifyContent: align, width: "100%" }),
    [align]
  )
  return (
    <div style={wrap}>
      <SlotReel target={d1} trigger={trigger} durationMs={1500} delayMs={0} size={size} />
      <SlotReel target={d2} trigger={trigger} durationMs={2300} delayMs={120} size={size} />
    </div>
  )
}
