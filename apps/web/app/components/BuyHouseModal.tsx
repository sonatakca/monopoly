"use client"

import React, { useMemo, useState } from 'react'
import board from '@shared/board.tr.json'
import PropertyCard from './PropertyCard'
import HouseIcon from './icons/House.svg'
import { colorOf } from './propertyTemplate'
import { SET_COLORS } from './playerColors'
import MonopolyMoney from './icons/MonopolyMoney'
import Tippy from '@tippyjs/react'
import 'tippy.js/dist/tippy.css'
import { followCursor } from 'tippy.js'
import { Center } from '@react-three/drei'

export default function BuyHouseModal({
  open,
  tiles,
  houses,
  hotels,
  owned,
  cash,
  onConfirm,
  onSelect,
  onClose,
}: {
  open: boolean
  tiles: number[]
  houses?: Record<number, number>
  hotels?: Record<number, number>
  owned?: number[]
  cash?: number
  onConfirm?: (plan: Record<number, number>) => void
  onSelect: (tileId: number) => void
  onClose: () => void
}) {
  if (!open) return null
  const list = tiles.slice()
  const houseCount = useMemo(() => houses || {}, [houses])
  const [hoverKey, setHoverKey] = useState<string | null>(null)
  const [plan, setPlan] = useState<Record<number, number>>({})
  const colorOrder = ['brown', 'lightblue', 'pink', 'orange', 'red', 'yellow', 'green', 'darkblue']
  const groups = useMemo(() => {
    // Show full color sets that the player owns, with all properties side-by-side.
    const spaces: any[] = (board as any).spaces || []
    const ownedSet = new Set(owned || [])
    const byColor: Record<string, number[]> = {}
    spaces.forEach((s: any, idx: number) => {
      if (s?.type === 'PROPERTY' && s?.color) {
        const c = String(s.color)
        if (!byColor[c]) byColor[c] = []
        byColor[c].push(idx)
      }
    })
    const ordered: Array<{ color: string; tiles: number[] }> = []
    for (const c of colorOrder) {
      const ids = (byColor[c] || []).sort((a, b) => a - b)
      if (ids.length && ids.every(id => ownedSet.has(id))) ordered.push({ color: c, tiles: ids })
    }
    return ordered
  }, [owned])

  // Eligible tiles as determined by game rules (even-building, mortgage, etc.)
  const buyableSet = useMemo(() => new Set(list), [list])
  // Helper: current count including planned purchases
  const currentCount = (id: number) => (houseCount?.[id] || 0) + (plan[id] || 0)

  const costOf = (id: number): number => {
    try { return Number(((board as any).spaces?.[id]?.houseCost) || 0) } catch { return 0 }
  }
  const totalPlanCost = useMemo(() => {
    return Object.entries(plan).reduce((sum, [id, n]) => sum + costOf(Number(id)) * (Number(n) || 0), 0)
  }, [plan])

  // Cache color -> tile ids mapping
  const groupTilesByColor: Record<string, number[]> = useMemo(() => {
    const m: Record<string, number[]> = {}
    const spaces: any[] = (board as any).spaces || []
    spaces.forEach((s: any, idx: number) => {
      if (s?.type === 'PROPERTY' && s?.color) {
        const c = String(s.color)
        if (!m[c]) m[c] = []
        m[c].push(idx)
      }
    })
    return m
  }, [])

  // Determine if a tile is eligible for the next house with current plan applied (even-building rule)
  const isTileEligibleNext = (id: number) => {
    try {
      const sp: any = (board as any).spaces?.[id]
      if (!sp || sp.type !== 'PROPERTY') return false
      if (sp.mortgaged) return false
      if ((hotels as any)?.[id]) return false
      const color = String(sp.color || '')
      const setTiles = (groupTilesByColor[color] || []).filter(ti => (owned || []).includes(ti))
      if (!setTiles.length) return false
      const levels = setTiles.map(ti => ((hotels as any)?.[ti] ? 5 : currentCount(ti)))
      const minLevel = Math.min(...levels)
      const thisLevel = currentCount(id)
      return thisLevel === minLevel && thisLevel < 4
    } catch { return false }
  }

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', zIndex: 70, pointerEvents: 'none' }}>
      <div style={{ background: 'rgba(17,24,39,0.8)', border: '1px solid rgba(255,255,255,0.14)', color: '#fff', borderRadius: 12, width: 600, maxWidth: '96vw', boxShadow: '0 14px 48px rgba(0, 0, 0, 0.5)', pointerEvents: 'auto', margin: '0, auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderBottom: '1px solid rgba(255,255,255,0.14)' }}>
          <div style={{ fontWeight: 900 }}>Ev Al</div>
          <button
            onClick={() => {
              if (onConfirm) {
                onConfirm(plan)
              } else {
                Object.entries(plan).forEach(([id, n]) => {
                  const times = Math.max(0, Number(n) || 0)
                  for (let i = 0; i < times; i++) onSelect(Number(id))
                })
              }
              onClose()
            }}
            disabled={(Object.values(plan).reduce((a, b) => a + (b || 0), 0) <= 0) || (cash != null && totalPlanCost > cash)}
            style={{
              background: 'linear-gradient(135deg, #22c55e, rgba(255,255,255,0.07) 70%)',
              border: '1px solid rgba(255,255,255,0.14)',
              color: '#fff',
              padding: '6px 12px',
              borderRadius: 10,
              fontWeight: 900,
              cursor: (Object.values(plan).reduce((a, b) => a + (b || 0), 0) > 0 && !(cash != null && totalPlanCost > cash)) ? 'pointer' : 'not-allowed',
              opacity: (Object.values(plan).reduce((a, b) => a + (b || 0), 0) > 0 && !(cash != null && totalPlanCost > cash)) ? 1 : 0.5
            }}
          >Onayla</button>
        </div>
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 360, overflowY: 'auto', overflowX: 'auto' }}>
          {groups.length ? groups.map(({ color: c, tiles }) => (
            <div
              key={c}
              style={{
                display: 'flex',
                flexDirection: 'row',
                gap: 12,
                alignItems: 'flex-start',
                flexWrap: 'nowrap',        // keep all cards on one row
                // remove per-row horizontal scroll; parent handles it
                justifyContent: 'center',
                minWidth: 'fit-content',
                paddingBottom: 4,
              }}
            >              {tiles.map((id) => {
              const sp: any = (board as any).spaces?.[id]
              const name = sp?.name || `Tile ${id}`
              const cost = sp?.houseCost != null ? sp.houseCost : null
              const count = Math.max(0, Math.min(4, currentCount(id)))
              return (
                <div
                  key={id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.14)',
                    color: '#fff',
                    padding: 8,
                    borderRadius: 10,
                    flex: '0 0 170px',      // fixed basis to keep cards side-by-side
                  }}
                >                  <div style={{ display: 'grid', placeItems: 'center' }}>
                    <PropertyCard id={id} side={'f'} width={150} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div title={name} style={{ fontWeight: 800, fontSize: 13, lineHeight: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                    {cost != null && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 900 }}>
                        <MonopolyMoney size={16} color="#fff" />
                        <span>{new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(cost)}</span>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                    {Array.from({ length: 4 }).map((_, i) => {
                      const key = `${id}-${i}`
                      const baseline = houseCount?.[id] || 0
                      const planned = plan[id] || 0
                      const filled = i < count
                      const isNext = i === count
                      const eligible = isTileEligibleNext(id) && buyableSet.has(id)
                      const canAddBase = isNext && eligible
                      const remaining = cash != null ? (cash - totalPlanCost) : Infinity
                      const canAfford = remaining >= costOf(id)
                      const canAdd = canAddBase && canAfford
                      // Even removal: only allow removing the last planned house if this tile is currently at the max level in its color set
                      const color = String((board as any).spaces?.[id]?.color || '')
                      const setTiles = (groupTilesByColor[color] || []).filter(ti => (owned || []).includes(ti))
                      const levels = setTiles.map(ti => ((hotels as any)?.[ti] ? 5 : currentCount(ti)))
                      const maxLevel = levels.length ? Math.max(...levels) : 0
                      const minLevelSet = levels.length ? Math.min(...levels) : 0
                      const thisTotal = currentCount(id)
                      const isLastPlannedIdx = i === (baseline + planned - 1)
                      const canRemove = planned > 0 && isLastPlannedIdx && (thisTotal === maxLevel)
                      const isHover = hoverKey === key
                      const opacity = filled ? 1 : (canAdd || canRemove) ? (isHover ? 0.8 : 0.3) : 0.3
                      const cursor = (canAdd || canRemove) ? 'pointer' : 'not-allowed'
                      // Allow hover for all to show cursor feedback; clicks only handled when allowed
                      const pointer = 'auto'
                      // Tooltip for not-allowed cases
                      let denyReason: string | null = null
                      if (!(canAdd || canRemove)) {
                        if (!filled) {
                          // Not filled (trying to add but blocked)
                          if (isNext && !canAddBase) {
                            const spAny: any = (board as any).spaces?.[id]
                            if (spAny?.mortgaged) denyReason = 'İpotekli mülk'
                            else if ((hotels as any)?.[id]) denyReason = 'Bu mülkte otel var'
                            else if (thisTotal >= 4) denyReason = 'Maksimum 4 ev'
                            else if (thisTotal > minLevelSet) denyReason = 'Önce renk setindeki diğer arsaları eşitleyin'
                            else denyReason = 'Kural gereği uygun değil'
                          } else if (isNext && !canAfford) {
                            denyReason = 'Yetersiz bakiye'
                          } else if (!isNext) {
                            denyReason = 'Önce soldaki evi ekleyin'
                          }
                        } else {
                          // Filled (trying to remove but blocked)
                          const baseline = houseCount?.[id] || 0
                          const planned = plan[id] || 0
                          const lastPlannedIdx = baseline + planned - 1
                          if (planned === 0) {
                            denyReason = 'Mevcut ev; kaldırılamaz'
                          } else if (i < lastPlannedIdx) {
                            denyReason = 'Önce en sağdaki planlanan evi kaldırın'
                          } else if (thisTotal !== maxLevel) {
                            denyReason = 'Önce renk setindeki en yüksek seviyedeki arsadan kaldırın'
                          } else {
                            denyReason = 'Kural gereği uygun değil'
                          }
                        }
                      }

                      const imgEl = (
                        <img
                          key={i}
                          src={HouseIcon.src}
                          alt="house"
                          onMouseEnter={() => setHoverKey(key)}
                          onMouseLeave={() => setHoverKey(prev => (prev === key ? null : prev))}
                          onClick={(e) => {
                            if (canAdd) {
                              e.stopPropagation()
                              setPlan(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }))
                              return
                            }
                            if (canRemove) {
                              e.stopPropagation()
                              setPlan(prev => ({ ...prev, [id]: Math.max(0, (prev[id] || 0) - 1) }))
                              return
                            }
                            // locked: do nothing
                            e.stopPropagation()
                          }}
                          style={{ width: 30, height: 'auto', opacity, cursor, transition: 'opacity 120ms ease', pointerEvents: pointer as any }}
                        />
                      )
                      return denyReason ? (
                        <Tippy key={`${id}-${i}-tip`} content={denyReason} followCursor={true} plugins={[followCursor]} offset={[0, 12]} arrow={false} theme="custom">
                          {imgEl}
                        </Tippy>
                      ) : imgEl
                    })}
                  </div>
                </div>
              )
            })}
            </div>
          )) : (
            <div style={{ opacity: 0.8 }}>Uygun arsa yok</div>
          )}
        </div>
        <div style={{ padding: 12, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.18)', color: '#fff', padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }}>Kapat</button>
        </div>
      </div>
    </div >
  )
}
