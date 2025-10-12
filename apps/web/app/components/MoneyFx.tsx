"use client"

import React, { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react'

export type MoneyTransfer =
  | { kind: 'toBank'; fromId: string; amount: number }
  | { kind: 'fromBank'; toId: string; amount: number }
  | { kind: 'playerToPlayer'; fromId: string; toId: string; amount: number }

export type MoneyFxHandle = {
  spawn: (t: MoneyTransfer) => void
}

type Note = 1 | 5 | 10 | 20 | 50 | 100 | 500
const NOTES: Note[] = [500, 100, 50, 20, 10, 5, 1]

function splitAmount(amount: number, capNotes = 12): Note[] {
  const out: number[] = []
  let rem = Math.max(0, Math.round(amount))
  for (const n of NOTES) {
    while (rem >= n && out.length < capNotes) { out.push(n); rem -= n }
  }
  if (rem > 0 && out.length === 0) out.push(1)
  return out as Note[]
}

type ActiveBill = {
  id: number
  img: string
  start: { x: number; y: number }
  end: { x: number; y: number }
  c1: { x: number; y: number }
  c2: { x: number; y: number }
  t0: number
  dur: number
  rot: number
  flow?: 'toBank' | 'fromBank' | 'playerToPlayer'
}

type MoneyFxProps = { cardRects: Record<string, DOMRect> }
export default forwardRef<MoneyFxHandle, MoneyFxProps>(function MoneyFx(props: MoneyFxProps, ref: React.Ref<MoneyFxHandle>) {
  const { cardRects } = props
  const [bills, setBills] = useState<ActiveBill[]>([])
  const raf = useRef<number | null>(null)
  const nextId = useRef(1)
  const overlayRef = useRef<HTMLDivElement | null>(null)

  const step = () => {
    const now = performance.now()
    setBills(prev => prev.filter(b => (now - b.t0) < b.dur))
    raf.current = requestAnimationFrame(step)
  }
  useEffect(() => {
    raf.current = requestAnimationFrame(step)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [])

  function bezier(p0: any, p1: any, p2: any, p3: any, t: number) {
    const u = 1 - t, tt = t * t, uu = u * u, uuu = uu * u, ttt = tt * t
    const x = uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x
    const y = uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y
    return { x, y }
  }

  function bankPoint(dir: 'out' | 'in'): { x: number; y: number } {
    // Return a POINT IN VIEWPORT COORDS aligned to the overlay's right edge,
    // slightly above it (negative y) so it flies in/out.
    const host = overlayRef.current
    if (host) {
      const r = host.getBoundingClientRect()
      const x = Math.round(r.left + r.width - 80)
      const y = (dir === 'out' ? r.top - 40 : r.top - 60)
      return { x, y }
    }
    // Fallback to viewport if overlay not mounted yet
    const W = window.innerWidth
    const x = Math.round(W - 80)
    const y = dir === 'out' ? -40 : -60
    return { x, y }
  }

  function centerOfRect(r: DOMRect): { x: number; y: number } {
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  }

  function toLocal(pt: { x: number; y: number }): { x: number; y: number } {
    const host = overlayRef.current
    if (!host) return pt
    const r = host.getBoundingClientRect()
    return { x: pt.x - r.left, y: pt.y - r.top }
  }

  function spawnOne(img: string, start: { x: number; y: number }, end: { x: number; y: number }, flow?: 'toBank' | 'fromBank' | 'playerToPlayer') {
    const midX = (start.x + end.x) / 2
    const midY = (start.y + end.y) / 2
    const dx = end.x - start.x
    const dy = end.y - start.y
    const len = Math.hypot(dx, dy)
    const ortho = { x: -dy / (len || 1), y: dx / (len || 1) }
    const arc = Math.min(120, Math.max(40, len / 5))
    const c1 = { x: midX + ortho.x * arc, y: midY + ortho.y * arc }
    const c2 = { x: midX + ortho.x * arc * 0.6, y: midY + ortho.y * arc * 0.6 }
    const id = nextId.current++
    // Pace: extend slightly for fromBank so it feels more generous
    const base = 800 + Math.random() * 1200
    const dur = flow === 'fromBank' ? Math.round(base * 1.2) : base
    const rot = (Math.random() - 0.5) * 0.5
    const bill: ActiveBill = { id, img, start, end, c1, c2, t0: performance.now(), dur, rot, flow }
    setBills(prev => [...prev, bill])
  }

  function trigger(t: MoneyTransfer) {
    const amount = Math.max(0, Math.round(t.amount))
    if (!amount) return
    const notes = splitAmount(amount)
    const imgs = notes.map(n => `/money/money-${n}.png`)
    if (t.kind === 'toBank') {
      const rFrom = cardRects[t.fromId]; if (!rFrom) return
      const start = toLocal(centerOfRect(rFrom))
      const end = toLocal(bankPoint('out'))
      imgs.forEach((src, i) => setTimeout(() => spawnOne(src, start, end, 'toBank'), i * 30))
    } else if (t.kind === 'fromBank') {
      const rTo = cardRects[t.toId]; if (!rTo) return
      const start = toLocal(bankPoint('in'))
      const end = toLocal(centerOfRect(rTo))
      // slower stagger for fromBank to emphasize incoming money
      imgs.forEach((src, i) => setTimeout(() => spawnOne(src, start, end, 'fromBank'), i * 70))
    } else if (t.kind === 'playerToPlayer') {
      const rFrom = cardRects[t.fromId]; const rTo = cardRects[t.toId]
      if (!rFrom || !rTo) return
      const start = toLocal(centerOfRect(rFrom))
      const end = toLocal(centerOfRect(rTo))
      imgs.forEach((src, i) => setTimeout(() => spawnOne(src, start, end, 'playerToPlayer'), i * 40))
    }
  }

  useImperativeHandle(ref, () => ({ spawn: trigger }), [cardRects])

  return (
    <div
      ref={overlayRef}
      style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, pointerEvents: 'none', zIndex: 60 }}
    >
      {bills.map(b => {
        const now = performance.now()
        const t = Math.max(0, Math.min(1, (now - b.t0) / b.dur))
        // Flow-dependent easing/opacity: toBank = ease-in, fromBank = ease-out, p2p = ease-in-out
        const easeIn = (x: number) => x * x * x
        const easeOut = (x: number) => 1 - Math.pow(1 - x, 3)
        const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
        const te = b.flow === 'fromBank' ? easeOut(t) : b.flow === 'playerToPlayer' ? easeInOut(t) : easeIn(t)
        const p = bezier(b.start, b.c1, b.c2, b.end, te)
        const s = 0.8 + 0.2 * Math.sin(te * Math.PI)
        // From bank should fade in then fade out; others fade out towards the end
        const fadeInOut = (x: number, fi = 0.25, fo = 0.25) => {
          if (x < fi) return x / fi
          if (x > 1 - fo) return (1 - x) / fo
          return 1
        }
        const o = b.flow === 'fromBank' ? fadeInOut(t, 0.25, 0.25) : (1 - Math.pow(t, 1.5))
        const style: React.CSSProperties = {
          position: 'absolute',
          left: 0,
          top: 0,
          transform: `translate(${p.x}px, ${p.y}px) rotate(${b.rot}rad) scale(${s})`,
          transformOrigin: 'center',
          width: 90,
          height: 'auto',
          opacity: o,
          filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.35))',
        }
        return <img key={b.id} src={b.img} alt="money" style={style} />
      })}
    </div>
  )
})
