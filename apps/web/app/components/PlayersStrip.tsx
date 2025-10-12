"use client"
import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { Player, RoomState } from '@shared/types'
import PlayerCard from './PlayerCard'

type Props = {
  players: Record<string, Player>
  order: string[]
  currentId?: string | null
  style?: React.CSSProperties
}

export default function PlayersStrip({ players, order, currentId, style }: Props) {
  const list = useMemo(() => order.map(id => players[id]).filter(Boolean), [players, order])
  // 8 slots across the bottom; center the players within those slots
  const SLOTS = 8
  const GAP = 10 // px between columns (keep in sync with grid.gap)
  const BASE_W = 300 // design width of PlayerCard before scaling

  const offset = Math.max(0, Math.floor((SLOTS - list.length) / 2))
  const cells: (typeof list[number] | null)[] = Array.from({ length: SLOTS }, () => null)
  for (let i = 0; i < list.length && (i + offset) < SLOTS; i++) cells[i + offset] = list[i]

  // Measure container width to scale cards proportionally to panel width
  const ref = useRef<HTMLDivElement>(null)
  const [slotW, setSlotW] = useState<number>(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const total = el.clientWidth
      const gaps = GAP * (SLOTS - 1)
      const sw = Math.max(0, (total - gaps) / SLOTS)
      setSlotW(sw)
    }
    update()
    const ro = (typeof ResizeObserver !== 'undefined') ? new ResizeObserver(update) : null
    if (ro) ro.observe(el)
    window.addEventListener('resize', update)
    return () => { if (ro) ro.disconnect(); window.removeEventListener('resize', update) }
  }, [])
  const scale = useMemo(() => {
    if (!slotW) return 1
    return Math.max(0.5, Math.min(1.6, slotW / BASE_W))
  }, [slotW])

  const grid: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${SLOTS}, 1fr)`,
    alignItems: 'end',
    gap: GAP,
    width: '100%',
  }
  const cell: React.CSSProperties = { display: 'flex', justifyContent: 'center', alignItems: 'end' }
  const wrapper: React.CSSProperties = { width: BASE_W, transform: `scale(${scale})`, transformOrigin: 'bottom center' }
  return (
    <div ref={ref} style={{ ...grid, ...style }}>
      {cells.map((p, i) => (
        <div key={i} style={cell}>
          {p ? (
            <div style={wrapper}>
              <PlayerCard player={p} orderIndex={i} isCurrent={currentId ? p.id === currentId : false} />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}
