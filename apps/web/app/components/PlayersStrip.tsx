"use client"
import React, { useMemo } from 'react'
import type { Player, RoomState } from '@shared/types'
import PlayerCard from './PlayerCard'

type Props = {
  players: Record<string, Player>
  order: string[]
  currentId?: string | null
  style?: React.CSSProperties
  activityKey?: number | string
  onCardRectsChange?: (map: Record<string, DOMRect>) => void
}

export default function PlayersStrip({ players, order, currentId, style, activityKey, onCardRectsChange }: Props) {
  const list = useMemo(() => order.map(id => players[id]).filter(Boolean), [players, order])
  // 8 slots across the bottom; center the players within those slots
  const SLOTS = 8
  const offset = Math.max(0, Math.floor((SLOTS - list.length) / 2))
  const cells: (typeof list[number] | null)[] = Array.from({ length: SLOTS }, () => null)
  for (let i = 0; i < list.length && (i + offset) < SLOTS; i++) cells[i + offset] = list[i]

  const grid: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${SLOTS}, 1fr)`,
    alignItems: 'end',
    gap: 6,
    width: '100%',
  }
  const cell: React.CSSProperties = { display: 'flex', justifyContent: 'center', alignItems: 'end' }
  const refs = React.useRef<Record<number, HTMLDivElement | null>>({})
  const lastMapRef = React.useRef<Record<string, DOMRect> | null>(null)
  React.useEffect(() => {
    if (!onCardRectsChange) return
    const map: Record<string, DOMRect> = {}
    cells.forEach((p, i) => {
      if (!p) return
      const el = refs.current[i]
      if (!el) return
      const child = el.firstElementChild as HTMLElement | null
      const rect = (child && child.getBoundingClientRect) ? child.getBoundingClientRect() : el.getBoundingClientRect()
      map[p.id] = rect
    })
    // Only call when rects meaningfully change
    const prev = lastMapRef.current
    let changed = false
    if (!prev) changed = true
    else {
      const a = Object.keys(prev), b = Object.keys(map)
      if (a.length !== b.length) changed = true
      else {
        for (const k of b) {
          const r1 = prev[k], r2 = map[k]
          if (!r1 || !r2) { changed = true; break }
          const eps = 0.5
          if (Math.abs(r1.left - r2.left) > eps || Math.abs(r1.top - r2.top) > eps || Math.abs(r1.width - r2.width) > eps || Math.abs(r1.height - r2.height) > eps) { changed = true; break }
        }
      }
    }
    if (changed) { lastMapRef.current = map; onCardRectsChange(map) }
    const recalc = () => {
      const m: Record<string, DOMRect> = {}
      cells.forEach((p, i) => {
        if (!p) return
        const el = refs.current[i]
        if (!el) return
        const child = el.firstElementChild as HTMLElement | null
        const rect = (child && child.getBoundingClientRect) ? child.getBoundingClientRect() : el.getBoundingClientRect()
        m[p.id] = rect
      })
      onCardRectsChange(m)
    }
    let raf = 0
    const onScroll = () => {
      if (raf) return; raf = requestAnimationFrame(() => { raf = 0; recalc() })
    }
    window.addEventListener('resize', recalc)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('resize', recalc)
      window.removeEventListener('scroll', onScroll as any)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [cells.map(p => p?.id).join('|'), onCardRectsChange])

  return (
    <div style={{ ...grid, ...style }}>
      {cells.map((p, i) => (
        <div key={i} style={cell} ref={el => (refs.current[i] = el)}>
          {p ? (
            <PlayerCard
              player={p}
              orderIndex={i}
              isCurrent={currentId ? p.id === currentId : false}
              activityKey={currentId && p.id === currentId ? activityKey : undefined}
            />
          ) : null}
        </div>
      ))}
    </div>
  )
}
