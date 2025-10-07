'use client'

import React, { useEffect, useMemo, useState } from 'react'

type PL = {
  enable: (v: boolean) => void
  setTile: (i: number | null) => void
  setZone?: (z: '' | 'v' | 'j') => void
  setSlot: (i: number) => void
  export: () => string | undefined
  clear: () => void
  generateSlots?: (tile: number) => void
  generateSlotsKey?: (key: string) => void
  resetAuto?: () => void
}

function readEnabled(): boolean {
  try {
    const w: any = window as any
    if (w.__plState?.current) return !!w.__plState.current.enabled
    // Fallback to localStorage flag when API not yet mounted
    //     const f = localStorage.getItem('monopoly.dev.placements.enabled')
    //     return f === '1'
  } catch { return false }
}

function readState() {
  try {
    const w: any = window as any
    const s = w.__plState?.current
    return {
      enabled: !!s?.enabled,
      tileIndex: (s?.tileIndex ?? null) as number | null,
      zone: (s?.zone ?? '') as '' | 'v' | 'j',
      slot: Number.isFinite(s?.slot) ? (s?.slot as number) : 0,
      autoTile: Number.isFinite(s?.lastAutoTile) ? (s?.lastAutoTile as number) : null,
    }
  } catch {
    return { enabled: false, tileIndex: null, zone: '' as '' | 'v' | 'j', slot: 0 }
  }
}

export default function PlacementPanel() {
  const [tick, setTick] = useState(0)
  const st = useMemo(readState, [tick])
  const enabled = st.enabled

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 400)
    return () => clearInterval(t)
  }, [])

  if (!enabled) return null

  const api: PL | null = (() => {
    try { return (window as any).MonopolyDev?.placement ?? null } catch { return null }
  })()

  const setTile = (v: string) => {
    const n = v.trim() === '' ? null : Math.max(0, Math.min(39, Math.floor(Number(v))))
    api?.setTile?.(n as any)
    setTick((x) => x + 1)
  }
  const setZone = (z: '' | 'v' | 'j') => { api?.setZone?.(z); setTick((x) => x + 1) }
  const setSlot = (v: string) => { const n = Math.max(0, Math.min(7, Math.floor(Number(v)))); api?.setSlot?.(n); setTick((x) => x + 1) }

  const onExport = async () => {
    try {
      const s = api?.export?.() || '{}'
      await navigator.clipboard?.writeText(s)
      console.log('[Dev] placements copied to clipboard')
    } catch (e) { console.warn('[Dev] copy failed', e) }
  }
  const onClear = () => { try { api?.clear?.() } catch {} try { (api as any)?.clearMarkers?.() } catch {} setTick((x) => x + 1) }
  const onGenerate = () => {
    const t = st.tileIndex
    if (t == null) return
    const key = (t === 10 && st.zone) ? `10${st.zone}` : null
    if (key && api?.generateSlotsKey) api.generateSlotsKey(key)
    else api?.generateSlots?.(t)
    setTick((x) => x + 1)
  }

  const label = (st.tileIndex === 10 && st.zone) ? `10${st.zone}` : (st.tileIndex == null ? ("auto" + ((st as any).autoTile != null ? ` (${(st as any).autoTile})` : "")) : String(st.tileIndex))

  return (
    <section style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', border: '1px dashed #d1d5db', padding: 8, borderRadius: 8 }}>
      <b style={{ fontSize: 12, opacity: 0.8 }}>Dev Placement</b>
      <span style={{ fontSize: 12, opacity: 0.7 }}>Tile:</span>
      <input type="number" min={0} max={39} placeholder="auto" value={st.tileIndex ?? ''} onChange={(e) => setTile(e.target.value)} style={{ width: 70 }} />
      <span style={{ fontSize: 12, opacity: 0.7 }}>Zone (10 only):</span>
      <select value={st.zone} onChange={(e) => setZone(e.target.value as any)}>
        <option value="">Yok</option>
        <option value="v">Ziyaret (10v)</option>
        <option value="j">Hapishane (10j)</option>
      </select>
      <span style={{ fontSize: 12, opacity: 0.7 }}>Slot:</span>
      <input type="number" min={0} max={7} value={st.slot} onChange={(e) => setSlot(e.target.value)} style={{ width: 60 }} />
      <button onClick={() => setSlot(String((st.slot + 1) % (st.tileIndex === 10 && st.zone === 'v' ? 6 : st.tileIndex === 10 && st.zone === 'j' ? 4 : 4)))}>Sonraki</button>
      <button onClick={onGenerate}>Alan’dan üret</button>
      <button onClick={onExport}>JSON Kopyala</button>
      <button onClick={() => { onClear() }}>Temizle</button>
      <button onClick={() => { try { api?.resetAuto?.() } catch {}; setTick((x)=>x+1) }}>Auto'yu sıfırla</button>
      <span style={{ fontSize: 12, opacity: 0.7 }}>Key: {label}</span>
    </section>
  )
}











