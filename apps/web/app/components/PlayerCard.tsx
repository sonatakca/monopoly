"use client"
import React, { useEffect, useMemo, useRef, useState } from 'react'
import MonopolyMoney from './icons/MonopolyMoney'
import { SET_COLORS, NEUTRAL, STATION_COLOR, UTILITY_COLOR, PLAYER_DOTS } from './playerColors'
import { PROPERTY_TEMPLATE, kindOf, colorOf, isMortgaged, nameOf } from './propertyTemplate'
import board from '@shared/board.tr.json'
import type { Player } from '@shared/types'

type Props = {
  player: Player
  orderIndex?: number
  isCurrent?: boolean
  activityKey?: number | string
  isFullscreen?: boolean
}

function Money({ value }: { value: number }) {
  const text = useMemo(() => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value), [value])
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <MonopolyMoney size={14} />
      <span>{text}</span>
    </span>
  )
}

export default function PlayerCard({ player, orderIndex = 0, isCurrent = false, activityKey, isFullscreen }: Props) {
  const owned = useMemo(() => new Set<number>(player.properties || []), [player.properties])
  const dot = PLAYER_DOTS[(orderIndex || 0) % PLAYER_DOTS.length]
  const dim = !!player.bankrupt
  // 30s progress indicator for the top gradient line when current player is active
  const barRef = useRef<HTMLDivElement | null>(null)
  const pillFillRef = useRef<HTMLDivElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)
  // Money delta indicator (+ green / - red)
  const lastCashRef = useRef<number | null>(null)
  const [cashDelta, setCashDelta] = useState<number | null>(null)
  const deltaTimer = useRef<number | null>(null)

  useEffect(() => {
    // Only animate when this player is current
    if (!isCurrent) {
      // Reset and stop when not current
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      startRef.current = null
      if (barRef.current) barRef.current.style.transform = 'scaleX(1)'
      if (pillFillRef.current) pillFillRef.current.style.transform = 'scaleX(1)'
      return
    }

    // Start a 30s countdown that shrinks the bar
    startRef.current = performance.now()
    const duration = 30000 // 30 seconds
    const startFrac = 0.68   // begin shrinking when 70% time remains
    const endFrac = 0.315     // finish shrinking when 30% remains

    const tick = (now: number) => {
      if (!startRef.current) return
      const elapsed = now - startRef.current
      const remaining = Math.max(0, duration - elapsed)
      const p = remaining / duration // 1 -> 0 (full time window)
      // Bar: direct full-window scale (100 -> 0)
      const barScale = Math.max(0, Math.min(1, p))
      // Pill: map p in [startFrac..endFrac] to [1..0], clamp outside
      let pillScale = (p - endFrac) / (startFrac - endFrac)
      if (pillScale > 1) pillScale = 1
      else if (pillScale < 0) pillScale = 0
      if (barRef.current) barRef.current.style.transform = `scaleX(${barScale})`
      if (pillFillRef.current) pillFillRef.current.style.transform = `scaleX(${pillScale})`
      if (remaining > 0) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        rafRef.current = null
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [isCurrent, player?.id, activityKey])

  // Show a transient money delta when player.cash changes
  useEffect(() => {
    if (lastCashRef.current == null) {
      lastCashRef.current = player.cash
      return
    }
    const prev = lastCashRef.current
    if (player.cash !== prev) {
      const change = player.cash - prev
      lastCashRef.current = player.cash
      if (change !== 0) {
        setCashDelta((prevDelta) => {
          if (prevDelta == null) return change
          if ((prevDelta >= 0 && change >= 0) || (prevDelta < 0 && change < 0)) return prevDelta + change
          return change
        })
        if (deltaTimer.current) window.clearTimeout(deltaTimer.current)
        deltaTimer.current = window.setTimeout(() => setCashDelta(null), 1800) as any
      }
    }
    return () => { if (deltaTimer.current) window.clearTimeout(deltaTimer.current) }
  }, [player.cash])

  // Counts for station and utility (for tiny icons next to money)
  const stationIds: number[] = useMemo(() => (board as any).spaces.map((s: any, i: number) => s?.type === 'STATION' ? i : -1).filter((v: number) => v >= 0), [])
  const utilIds: number[] = useMemo(() => (board as any).spaces.map((s: any, i: number) => s?.type === 'UTILITY' ? i : -1).filter((v: number) => v >= 0), [])
  const stationCount = useMemo(() => stationIds.filter((id: number) => owned.has(id)).length, [stationIds, owned])
  const utilCount = useMemo(() => utilIds.filter((id: number) => owned.has(id)).length, [utilIds, owned])



  function useFullscreen(override?: boolean) {
    const [full, setFull] = React.useState<boolean>(!!override)

    React.useEffect(() => {
      if (typeof override === 'boolean') { setFull(override); return }
      if (typeof document === 'undefined') return

      const getIsFull = () => {
        const d: any = document
        return !!(d.fullscreenElement || d.webkitFullscreenElement || d.msFullscreenElement)
      }
      const onChange = () => setFull(getIsFull())

      onChange() // init
      document.addEventListener('fullscreenchange', onChange)
      document.addEventListener('webkitfullscreenchange', onChange as any)
      document.addEventListener('msfullscreenchange', onChange as any)
      return () => {
        document.removeEventListener('fullscreenchange', onChange)
        document.removeEventListener('webkitfullscreenchange', onChange as any)
        document.removeEventListener('msfullscreenchange', onChange as any)
      }
    }, [override])

    return full
  }
  const full = useFullscreen(isFullscreen)

  const frame: React.CSSProperties = {
    width: '100%',
    position: 'relative',
    padding: 8,
    paddingTop: isCurrent ? 20 : 8,
    // Scale smaller in windowed mode; full size in fullscreen
    scale: full ? '1' : '0.8',
    transformOrigin: 'bottom center',
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'linear-gradient(180deg, rgba(17,24,39,0.55) 0%, rgba(15,23,42,0.48) 100%)',
    color: '#fff',
    backdropFilter: 'blur(10px)',
    boxShadow: isCurrent ? `0 0 0 3px rgba(99,102,241,0.35) inset, 0 10px 30px rgba(0,0,0,0.45)` : '0 10px 30px rgba(0,0,0,0.35)',
    opacity: dim ? 0.4 : 1,
  }

  const headerBar: React.CSSProperties = {
    height: 26,
    borderRadius: 12,
    padding: '0 8px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: `linear-gradient(180deg, ${dot}cc 0%, ${dot}90 100%)`,
    border: '1px solid rgba(255,255,255,0.25)'
  }
  const avatar: React.CSSProperties = { width: 16, height: 16, borderRadius: 99, background: '#fff', border: `2px solid ${dot}` }
  const name: React.CSSProperties = { flex: 1, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: 0.3 }

  const moneyRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, fontWeight: 800 }
  const moneyLeft: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 6px', borderRadius: 8, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)' }
  // (deltaChip removed; inline override used instead)
  const badge: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, opacity: 0.9 }

  const boardBand: React.CSSProperties = {
    marginTop: 6,
    padding: 6,
    borderRadius: 10,
    background: 'linear-gradient(180deg, rgba(2,6,23,0.55) 0%, rgba(2,6,23,0.75) 100%)',
    border: '1px solid rgba(255,255,255,0.10)'
  }
  // 2 rows x 14 columns like the screenshot
  const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(14, 1fr)', gap: 3 }

  return (
    <div style={frame} aria-label={`Oyuncu: ${player.name}`}>
      {isCurrent && (() => {
        // compute contrast for text color based on the header color
        const hex = String(dot || '#7c3aed')
        const toRgb = (h: string) => { const m = h.replace('#', ''); const r = parseInt(m.slice(0, 2), 16), g = parseInt(m.slice(2, 4), 16), b = parseInt(m.slice(4, 6), 16); return { r, g, b } }
        const rgb = toRgb(hex.length === 3 ? `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}` : hex)
        const lum = (() => { const s = [rgb.r, rgb.g, rgb.b].map(v => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4) }); return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2] })()
        const text = lum > 0.65 ? '#111827' : '#ffffff'
        return (
          <>
            {/* Status pill */}
            <div
              style={{
                position: 'absolute',
                top: -7,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 5,
              }}
            >
              <div
                style={{
                  position: 'relative',
                  padding: '2px 8px',
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: 0.3,
                  color: text,
                  // Grey fallback background that shows as the fill shrinks
                  background: 'rgba(0,0,0,0.5)',
                  border: '0px solid rgba(255,255,255,0.4)',
                  // boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
                  overflow: 'hidden',
                }}
              >
                <div
                  ref={pillFillRef}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: `linear-gradient(0deg, ${dot}, ${dot}99)`,
                    transformOrigin: 'left center',
                    transform: 'scaleX(1)',
                    willChange: 'transform',
                  }}
                />
                <span style={{ position: 'relative' }}>Oynuyor</span>
              </div>
            </div>

            {/* Top gradient line, clipped to the card's rounded corners */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 14,         // match your card radius
                overflow: 'hidden',       // clip the thin strip to the curve
                pointerEvents: 'none',
                zIndex: 4,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  height: 4,              // can stay thin
                  width: '100%',
                  transformOrigin: 'left center',
                  transform: 'scaleX(1)',
                  willChange: 'transform',
                  background: `linear-gradient(90deg, ${dot}, ${dot}aa, ${dot})`,
                }}
                ref={barRef}
              />
            </div>
          </>
        )

      })()}
      <div style={headerBar}>
        <span style={avatar} />
        <div style={name} title={player.name}>{player.name}</div>
      </div>
      <div style={moneyRow}>
        <span style={moneyLeft} aria-label={`${player.cash} para`}>
          <MonopolyMoney size={18} color="#ffd54f" />
          <span style={{ color: cashDelta != null ? (cashDelta >= 0 ? '#34d399' : '#f87171') : undefined }}>
            {cashDelta != null
              ? `${cashDelta >= 0 ? '+' : '-'}${new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Math.abs(cashDelta))}`
              : new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(player.cash)}
          </span>
        </span>
        <span style={badge} title={`İstasyon: ${stationCount}`}>
          <svg width="16" height="12" viewBox="0 0 24 16"><rect x="2" y="8" width="20" height="6" rx="1" fill="#ddd" /><rect x="5" y="3" width="4" height="5" fill="#bbb" /><rect x="11" y="3" width="4" height="5" fill="#bbb" /></svg>
          <b>{stationCount}</b>
        </span>
        <span style={badge} title={`Kamu: ${utilCount}`}>
          <svg width="14" height="14" viewBox="0 0 24 24"><path d="M13 2L3 14h7l-1 8 10-12h-7z" fill="#cfd8dc" /></svg>
          <b>{utilCount}</b>
        </span>
      </div>
      {/* money delta indicator merged into balance display */}
      <div style={boardBand}>
        <div style={grid}>
          {PROPERTY_TEMPLATE.map((id: number) => {
            const kind = kindOf(id)
            const ownedByMe = owned.has(id)
            const mort = ownedByMe && isMortgaged(id)
            const setColor = colorOf(id)
            const bg = ownedByMe
              ? (kind === 'PROPERTY' ? (SET_COLORS[String(setColor)] || NEUTRAL)
                : (kind === 'STATION' ? STATION_COLOR : UTILITY_COLOR))
              : NEUTRAL
            const opacity = ownedByMe ? 1 : 0.6
            const chip: React.CSSProperties = {
              width: 8, height: 8,
              borderRadius: 2,
              background: bg,
              opacity,
              border: '1px solid rgba(0,0,0,0.65)',
              position: 'relative',
            }
            const label = `${nameOf(id)}${mort ? ' — (ipotekli)' : ownedByMe ? '' : ''}`
            return (
              <div key={id} title={label} aria-label={label} style={chip}>
                {mort && (
                  <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.7) 0 1px, transparent 1px 3px)' }} />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
