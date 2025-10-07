'use client'

import React, { useEffect, useRef, useState } from 'react'

export function DevFPS({ pos = { top: 8, left: 8 } as React.CSSProperties }) {
  const raf = useRef(0)
  const last = useRef(performance.now())
  const [fps, setFps] = useState(0)
  const [avg, setAvg] = useState(0)
  const [min, setMin] = useState<number | null>(null)
  const [max, setMax] = useState<number | null>(null)
  const alpha = 0.1 // smoothing factor for EMA

  useEffect(() => {
    let mounted = true
    const loop = (t: number) => {
      const dt = t - last.current
      last.current = t
      const currentFps = dt > 0 ? 1000 / dt : 0
      if (!mounted) return
      setFps(currentFps)
      setAvg((prev) => (prev === 0 ? currentFps : prev + alpha * (currentFps - prev)))
      setMin((m) => (m == null ? currentFps : Math.min(m, currentFps)))
      setMax((m) => (m == null ? currentFps : Math.max(m, currentFps)))
      raf.current = requestAnimationFrame(loop)
    }
    raf.current = requestAnimationFrame(loop)
    return () => { mounted = false; cancelAnimationFrame(raf.current) }
  }, [])

  const style: React.CSSProperties = {
    position: 'absolute',
    zIndex: 10,
    background: 'rgba(0,0,0,0.55)',
    color: '#fff',
    padding: '6px 8px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.25)',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace',
    fontSize: 12,
    lineHeight: 1.2,
    pointerEvents: 'none',
    ...pos,
  }

  return (
    <div style={style}>
      <div>FPS: {fps.toFixed(0)}</div>
      <div>Avg: {avg.toFixed(0)} Min: {min ? min.toFixed(0) : '-'} Max: {max ? max.toFixed(0) : '-'}</div>
    </div>
  )
}

export default { DevFPS }

