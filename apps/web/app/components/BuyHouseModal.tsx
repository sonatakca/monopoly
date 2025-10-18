"use client"

import React, { useMemo, useState } from 'react'
import board from '@shared/board.tr.json'
import PropertyCard from './PropertyCard'
import HouseIcon from './icons/House.svg'

export default function BuyHouseModal({
  open,
  tiles,
  houses,
  hotels,
  onSelect,
  onClose,
}: {
  open: boolean
  tiles: number[]
  houses?: Record<number, number>
  hotels?: Record<number, number>
  onSelect: (tileId: number) => void
  onClose: () => void
}) {
  if (!open) return null
  const list = tiles.slice()
  const houseCount = useMemo(() => houses || {}, [houses])
  const [hoverKey, setHoverKey] = useState<string | null>(null)
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', zIndex: 70, pointerEvents: 'auto' }}>
      <div style={{ background: 'rgba(17,24,39,0.8)', border: '1px solid rgba(255,255,255,0.14)', color: '#fff', borderRadius: 12, width: 520, maxWidth: '96vw', boxShadow: '0 14px 48px rgba(0,0,0,0.5)' }}>
        <div style={{ padding: 12, borderBottom: '1px solid rgba(255,255,255,0.14)', fontWeight: 900 }}>Ev Al</div>
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 360, overflow: 'auto' }}>
          {list.length ? list.map((id) => {
            const sp: any = (board as any).spaces?.[id]
            const name = sp?.name || `Tile ${id}`
            const cost = sp?.houseCost != null ? sp.houseCost : null
            const count = Math.max(0, Math.min(4, (houseCount?.[id] || 0)))
            return (
              <div key={id}
                style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', color: '#fff', padding: 8, borderRadius: 10 }}>
                <div style={{ flex: '0 0 auto' }}>
                  <PropertyCard id={id} side={'f'} width={120} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, lineHeight: '18px' }}>{name}{cost != null ? ` • ${cost}` : ''}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {Array.from({ length: 4 }).map((_, i) => {
                      const key = `${id}-${i}`
                      const active = i < count
                      const isHover = hoverKey === key
                      const opacity = active ? 1 : (isHover ? 0.7 : 0.25)
                      return (
                        <img
                          key={i}
                          src={HouseIcon.src}
                          alt="house"
                          onMouseEnter={() => setHoverKey(key)}
                          onMouseLeave={() => setHoverKey(prev => (prev === key ? null : prev))}
                          onClick={(e) => { e.stopPropagation(); onSelect(id) }}
                          style={{ width: 50, height: 'auto', opacity, cursor: 'pointer', transition: 'opacity 120ms ease' }}
                        />
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          }) : (
            <div style={{ opacity: 0.8 }}>Uygun arsa yok</div>
          )}
        </div>
        <div style={{ padding: 12, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.18)', color: '#fff', padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }}>Kapat</button>
        </div>
      </div>
    </div>
  )
}
