"use client"

import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { RoomState, Player } from '@shared/types'
import board from '@shared/board.tr.json'
import PropertyCard from './PropertyCard'
import GameButtons, { MetallicActionButton } from './GameButtons'


export type AuctionOverlayProps = {
  state?: RoomState | null
  meId: string | null
  accentColor?: string
  send: (e: any) => void
  isFullscreen?: boolean
}

type Stage = 'hidden' | 'start' | 'going' | 'finished'

export default function AuctionOverlay({ state, meId, accentColor = '#3b82f6', send, isFullscreen }: AuctionOverlayProps) {
  const st = state ?? null
  if (!st) return null
  const a = st.auction
  const [stage, setStage] = useState<Stage>('hidden')
  const [visible, setVisible] = useState(false)

  const startUntilRef = useRef<number>(0)
  const finishUntilRef = useRef<number>(0)
  const deadlineRef = useRef<number>(0)
  const sentFinalizeRef = useRef<boolean>(false)
  const rafRef = useRef<number | null>(null)
  const [nowTick, setNowTick] = useState(0)

  const highestKey = `${a.highestBid}:${a.highestBidder ?? ''}`
  const lastKeyRef = useRef<string>('')
  const hasBidRef = useRef<boolean>(false)

  const me = meId ? st.players[meId] : null
  const participants = a.participants || []
  const isParticipant = !!(me && participants.includes(me.id))
  const isHighest = !!(me && a.highestBidder === me.id)
  const canBid10 = !!(me && isParticipant && me.cash >= (a.highestBid + Math.max(10, a.minIncrement)))
  const canBid100 = !!(me && isParticipant && me.cash >= (a.highestBid + 100))

  const space = useMemo(() => {
    try { return (a.spaceId != null ? (board as any).spaces?.[a.spaceId] : null) } catch { return null }
  }, [a.spaceId])

  // Stage transitions
  useEffect(() => {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    if (a.active && stage === 'hidden') {
      startUntilRef.current = now + 5000
      setStage('start')
      setVisible(true)
      // New auction: reset bid tracking and timers
      hasBidRef.current = false
      lastKeyRef.current = ''
      deadlineRef.current = 0
      sentFinalizeRef.current = false
    }
    if (!a.active && (stage === 'start' || stage === 'going')) {
      finishUntilRef.current = now + 2000
      setStage('finished')
    }
  }, [a.active, stage])

  // Ticks
  useEffect(() => {
    const step = () => {
      const t = typeof performance !== 'undefined' ? performance.now() : Date.now()
      setNowTick(t)
      if (stage === 'start' && t >= startUntilRef.current) {
        setStage('going')
      } else if (stage === 'finished' && t >= finishUntilRef.current) {
        setStage('hidden')
        setVisible(false)
      }
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [stage])

  // Deadline after first/new highest bid
  useEffect(() => {
    if (stage !== 'going') return
    if (a.highestBid > 0 && highestKey !== lastKeyRef.current) {
      lastKeyRef.current = highestKey
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
      deadlineRef.current = now + 5000
      sentFinalizeRef.current = false
      hasBidRef.current = true
    }
  }, [stage, highestKey, a.highestBid])

  // Finalize on deadline hit
  useEffect(() => {
    if (stage !== 'going') return
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    if (a.highestBid > 0 && deadlineRef.current > 0 && now >= deadlineRef.current && !sentFinalizeRef.current) {
      try { send({ type: 'finalizeAuction' }) } catch { }
      sentFinalizeRef.current = true
    }
  }, [nowTick, stage, a.highestBid])

  if (!visible) return null

  // Artwork per stage (left side)
  const artUrl = stage === 'start' ? '/Auction/AuctionStart.png'
    : stage === 'going' ? (hasBidRef.current ? '/Auction/AuctionGoing.png' : '/Auction/AuctionStart.png')
      : stage === 'finished' ? '/Auction/AuctionFinished.png'
        : ''
  const showStartTitle = stage === 'start'
  const showGoing = stage === 'going'
  const showFinished = stage === 'finished'

  const remainMs = Math.max(0, deadlineRef.current - (typeof performance !== 'undefined' ? performance.now() : Date.now()))
  const remainSec = Math.ceil(remainMs / 1000)
  const showCountdownDigit = showGoing && a.highestBid > 0 && remainSec <= 3 && remainSec >= 1

  // Styles
  const wrapStyle: React.CSSProperties = {
    position: 'absolute', inset: 0, zIndex: 50, pointerEvents: 'none', display: 'grid', placeItems: 'center'
  }
  const panel: React.CSSProperties = {
    position: 'relative', width: 'min(620px, 92vw)', scale: (isFullscreen ? '1.4' : '0.7'), borderRadius: 16, overflow: 'hidden',
    boxShadow: '0 18px 80px rgba(0,0,0,0.5)', pointerEvents: 'auto', background: 'rgba(0,0,0,0.70)'
  }
  const header: React.CSSProperties = {
    position: 'absolute', left: 0, right: 0, top: 0, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: 'linear-gradient(180deg, rgba(0,0,0,0.45), rgba(0,0,0,0.05))', color: '#fff'
  }
  const body: React.CSSProperties = { position: 'relative', padding: '64px 16px 18px 16px', color: '#fff' }
  const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 14 }
  const artWrap: React.CSSProperties = { position: 'relative', flex: '0 0 auto', height: 'auto' }
  const artImg: React.CSSProperties = { display: 'block', width: 300, height: 'auto' }
  const countdownOverArt: React.CSSProperties = { position: 'absolute', top: 8, left: '80%', transform: 'translateX(-50%)', pointerEvents: 'none' as const }
  const rightCol: React.CSSProperties = { display: 'grid', justifyItems: 'center', gap: 10 }
  const pill: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 999, background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.16)' }
  const btn: React.CSSProperties = { padding: '12px 16px', borderRadius: 12, fontWeight: 800, color: '#fff', cursor: 'pointer', background: `linear-gradient(180deg, ${accentColor} 0%, #1f2937 180%)`, border: '1px solid rgba(255,255,255,0.25)', boxShadow: `0 6px 18px ${accentColor}44`, opacity: 1 }
  const btnDisabled: React.CSSProperties = { ...btn, opacity: 0.4, cursor: 'not-allowed', boxShadow: 'none' }

  return (
    <div style={wrapStyle}>
      <div style={panel}>
        <div style={header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ ...pill, fontWeight: 900 }}>Açık Arttırma!</div>
            {space && (
              <div style={{ ...pill, fontSize: 13 }}>
                <span style={{ opacity: 0.9 }}>Mülk:</span>
                <span style={{ fontWeight: 800 }}>{(space as any).name}</span>
              </div>
            ) && (
                <div style={{ ...pill, fontSize: 13 }}>
                  <span style={{ opacity: 0.9 }}>Orijinal Fiyat:</span>
                  <span style={{ fontWeight: 800 }}>{(space as any).price}</span>
                </div>
              )}
            {a.highestBid > 0 && (
              <div style={{ ...pill, fontSize: 13 }}>
                <span style={{ opacity: 0.9 }}>Teklif:</span>
                <span style={{ fontWeight: 900 }}>{a.highestBid}</span>
                {a.highestBidder && <span style={{ opacity: 0.85 }}>• {(st.players[a.highestBidder] as Player | undefined)?.name || '—'}</span>}
              </div>
            )}
          </div>
        </div>

        <div style={body}>
          <div style={row}>
            {/* Left: artwork with countdown overlay */}
            <div style={artWrap}>
              {artUrl && <img src={artUrl} alt="Auction" style={artImg} />}
              {showCountdownDigit && (
                <div style={countdownOverArt}>
                  <div style={{ fontSize: 80, fontWeight: 1000, lineHeight: 1, textShadow: '0 10px 40px rgba(0,0,0,0.6)' }}>{remainSec}</div>
                </div>
              )}
            </div>

            {/* Right: property card and controls/messages */}
            <div style={rightCol}>
              {space && (
                <PropertyCard id={(space as any).id ?? (a.spaceId as number)} side={'f'} width={200} />
              )}

              {showStartTitle && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 1000, textShadow: '0 8px 40px rgba(0,0,0,0.6)' }}>Açık Arttırma!</div>
                </div>
              )}

              {showGoing && (
                <div style={{ display: 'grid', gap: 12, justifyItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <MetallicActionButton
                      label={'+10'}
                      icon={''}
                      // icon={<DollarSign size={18} />}
                      onClick={() => send({ type: 'bid', amount: a.highestBid + 10 })}
                      accentColor={accentColor}
                      disabled={!canBid10}
                    />
                    <MetallicActionButton
                      label={'+100'}
                      icon={''}
                      // icon={<DollarSign size={18} />}
                      onClick={() => send({ type: 'bid', amount: a.highestBid + 100 })}
                      accentColor={accentColor}
                      disabled={!canBid100}
                    />
                    {isParticipant && !isHighest && a.highestBid > 0 && (
                      <button style={{ ...btn, background: 'linear-gradient(180deg, #ef4444 0%, #1f2937 180%)', boxShadow: '0 6px 18px #ef444444' }} onClick={() => send({ type: 'passBid' })}>Pas</button>
                    )}
                  </div>
                </div>
              )}

              {showFinished && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 1000, textShadow: '0 8px 40px rgba(0,0,0,0.6)' }}>Açık Arttırma Bitti</div>
                  {a.highestBidder && (
                    <div style={{ marginTop: 6, fontSize: 16 }}>
                      Kazanan: {(st.players[a.highestBidder] as Player | undefined)?.name || '—'} — <b>{a.highestBid}</b>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}



