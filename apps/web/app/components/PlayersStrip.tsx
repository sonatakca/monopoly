'use client'
import React, { useMemo } from 'react'
import type { Player } from '@shared/types'
import PlayerCard from './PlayerCard'

type Props = {
  players: Record<string, Player>
  order: string[]
  currentId?: string | null
  style?: React.CSSProperties
  activityKey?: number | string
  onCardRectsChange?: (map: Record<string, DOMRect>) => void
  isFullscreen?: boolean
  onInitiateTrade?: (playerId: string) => void
}

export default function PlayersStrip({
  players,
  order,
  currentId,
  style,
  activityKey,
  onCardRectsChange,
  isFullscreen,
  onInitiateTrade
}: Props) {
  const list = useMemo(() => order.map(id => players[id]).filter(Boolean), [players, order])

  // 8 slots across the bottom; center the players within those slots
  const SLOTS = 8
  const offset = Math.max(0, Math.floor((SLOTS - list.length) / 2))
  const cells: (typeof list[number] | null)[] = Array.from({ length: SLOTS }, () => null)
  for (let i = 0; i < list.length && (i + offset) < SLOTS; i++) cells[i + offset] = list[i]

  // Measure container to compute exact px column width
  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const [w, setW] = React.useState(0)
  React.useEffect(() => {
    if (!rootRef.current) return
    const ro = new ResizeObserver(([entry]) => setW(entry.contentRect.width))
    ro.observe(rootRef.current)
    return () => ro.disconnect()
  }, [])

  const GAP = 0
  const colW = Math.max(1, Math.floor((w - GAP * (SLOTS - 1)) / SLOTS))

  // Scale relative to a design width (the card will set width: DESIGN_CARD_W and scale from there)
  const DESIGN_CARD_W = 222
  const baseScale = colW / DESIGN_CARD_W
  const layoutScale = Math.max(0.6, Math.min(1.3, baseScale))

  const grid: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${SLOTS}, ${colW}px)`,
    justifyContent: 'center',
    alignItems: 'end',
    gap: isFullscreen ? 0 : 0,
    width: '100%',
  }
  const cell: React.CSSProperties = { display: 'flex', justifyContent: 'center', alignItems: 'end', marginBottom: 10 }

  const refs = React.useRef<Record<number, HTMLDivElement | null>>({})
  const lastMapRef = React.useRef<Record<string, DOMRect> | null>(null)

  React.useEffect(() => {
    if (!onCardRectsChange) return

    const computeMap = (): Record<string, DOMRect> => {
      const map: Record<string, DOMRect> = {}
      cells.forEach((p, i) => {
        if (!p) return
        const el = refs.current[i]
        if (!el) return
        const child = el.firstElementChild as HTMLElement | null
        const rect = (child && child.getBoundingClientRect) ? child.getBoundingClientRect() : el.getBoundingClientRect()
        map[p.id] = rect
      })
      return map
    }

    const map = computeMap()
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
          if (Math.abs(r1.left - r2.left) > eps || Math.abs(r1.top - r2.top) > eps || Math.abs(r1.width - r2.width) > eps || Math.abs(r1.height - r2.height) > eps) {
            changed = true; break
          }
        }
      }
    }
    if (changed) { lastMapRef.current = map; onCardRectsChange(map) }

    let raf = 0
    const recalc = () => onCardRectsChange?.(computeMap())
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; recalc() }) }

    window.addEventListener('resize', recalc)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('resize', recalc)
      window.removeEventListener('scroll', onScroll as any)
      if (raf) cancelAnimationFrame(raf)
    }
    // ensure the effect re-runs when cell membership changes
  }, [cells.map(p => p?.id).join('|'), onCardRectsChange])

  return (
    <div ref={rootRef} style={{ ...grid, ...style }}>
      {cells.map((p, i) => (
        <div key={i} style={cell} ref={el => { refs.current[i] = el }}>
          {p ? (
            <PlayerCard
              player={p}
              orderIndex={i}
              isCurrent={currentId ? p.id === currentId : false}
              activityKey={currentId && p.id === currentId ? activityKey : undefined}
              isFullscreen={isFullscreen}
              layoutScale={layoutScale}   // ← wired scale
              designWidthPx={DESIGN_CARD_W}
              totalPlayers={list.length}
              onInitiateTrade={onInitiateTrade}
            />
          ) : null}
        </div>
      ))}
    </div>
  )
}