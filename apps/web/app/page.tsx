'use client'

import { useEffect, useMemo, useState } from 'react'
import { socket } from '../lib/socket'
import type { ServerEvent, ClientEvent, RoomState } from '../../../packages/shared/types'
import Board3D, { type CameraPreset, type PlacementOverrides } from './components/Board3D'

const NAME_KEY = 'monopoly:name'
const PLACE_KEY = 'monopoly:placements'

function normalizePlacements(raw: any): PlacementOverrides {
  const out: PlacementOverrides = {}
  for (const [k, v] of Object.entries(raw || {})) {
    const keyNum = Number(k)
    if (!Number.isNaN(keyNum)) out[keyNum] = v as any
  }
  // If jail points came in under key "0", map them to tile 10 (Jail)
  if (raw?.['0'] && !out[10]) out[10] = raw['0']
  // Mirror to tile 30 (Go To Jail) unless explicitly provided
  if (!out[30] && out[10]) out[30] = out[10]
  return out
}

export default function Home() {
  // ---------------- state ----------------
  const [state, setState] = useState<RoomState | null>(null)
  const [connected, setConnected] = useState<boolean>(socket.connected)
  const [err, setErr] = useState<string>('')

  const [name, setName] = useState(() => {
    if (typeof window !== 'undefined') {
      const v = window.localStorage.getItem(NAME_KEY)
      if (v && v.trim()) return v
    }
    return 'Oyuncu-' + Math.floor(Math.random() * 1000)
  })
  const [roomId, setRoomId] = useState('oda-1')

  // camera presets (all fov = 56 as requested)
  const [preset, setPreset] = useState(0)
  const [presets, setPresets] = useState<CameraPreset[]>([
    { pos: [8.5, 8.5, 8.5], target: [0, 0, 0], fov: 56 },
    { pos: [0.0, 8.5, 8.5], target: [0, 0, 0], fov: 56 },
    { pos: [-8.5, 8.5, 0.0], target: [0, 0, 0], fov: 56 },
    { pos: [0.0, 8.5, -8.5], target: [0, 0, 0], fov: 56 },
  ])

  // waiting (lobby) camera (kept per your earlier request)
  const [waitingPreset, setWaitingPreset] = useState<CameraPreset>({
    pos: [0, 12, 0],
    target: [0, 0, 0],
    fov: 30,
  })

  // quick side cameras (use fov 56 too)
  const sideCams: Record<'GO' | 'JAIL' | 'FREE' | 'GTJ', CameraPreset> = {
    GO: { pos: [0.0, 7.5, 7.6], target: [0, 0, 0], fov: 56 },
    JAIL: { pos: [-7.6, 7.5, 0.0], target: [0, 0, 0], fov: 56 },
    FREE: { pos: [0.0, 7.5, -7.6], target: [0, 0, 0], fov: 56 },
    GTJ: { pos: [7.6, 7.5, 0.0], target: [0, 0, 0], fov: 56 },
  }
  function jumpToSide(cam: CameraPreset) {
    setWaitingPreset(cam)               // used while waiting
    setPresets(p => { const n = p.slice(); n[1] = cam; return n }) // also store in preset #1
    setPreset(1)
  }

  // placement overrides (saved locally; normalized once when loading)
  const [placements, setPlacements] = useState<PlacementOverrides>(() => {
    try {
      const s = localStorage.getItem(PLACE_KEY)
      if (s) return normalizePlacements(JSON.parse(s))
    } catch { }
    return {}
  })

  // placement editor UI
  const [editEnabled, setEditEnabled] = useState<boolean>(true) // visible by default
  const [editTile, setEditTile] = useState<number | undefined>(undefined) // auto-detect
  const [editSlot, setEditSlot] = useState<number>(0)

  // ---------------- socket wiring ----------------
  useEffect(() => {
    const onConnect = () => { setConnected(true); setErr('') }
    const onDisconnect = () => setConnected(false)
    const onConnectError = (e: any) => { setErr(String(e?.message || e)); setConnected(false) }
    const onEvt = (evt: ServerEvent) => {
      if (evt.type === 'state') setState({ ...evt.state })
      if (evt.type === 'msg') console.log('[MSG]', evt.text)
      if (evt.type === 'error') alert(evt.text)
    }
    if (socket.connected) onConnect()
    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('connect_error', onConnectError)
    socket.on('event', onEvt)
    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('connect_error', onConnectError)
      socket.off('event', onEvt)
    }
  }, [])

  // persist name
  useEffect(() => {
    const t = setTimeout(() => {
      try { if (name && name.trim()) localStorage.setItem(NAME_KEY, name.trim()) } catch { }
    }, 120)
    return () => clearTimeout(t)
  }, [name])

  function send(e: ClientEvent) { socket.emit('event', e) }

  const me = useMemo(() => state && socket.id ? state.players[socket.id] : null, [state])
  const isMyTurn = !!(state && state.order?.length && state.order[state.turnIndex] === socket.id)

  function handlePresetChange(index: number, p: CameraPreset) {
    setPresets(prev => {
      const next = prev.slice()
      next[index] = { pos: [...p.pos] as any, target: [...p.target] as any, fov: p.fov ?? 56 }
      return next
    })
  }

  // -------- AUTO-ADVANCING onPlace ----------
  function handlePlace(tileIndex: number, slot: number, x: number, z: number) {
    // 1) Save this point
    setPlacements(prev => {
      const next: PlacementOverrides = { ...prev }
      const arr = (next[tileIndex] ? [...next[tileIndex]!] : Array(8).fill(null)) as Array<[number, number] | null>
      arr[slot % 8] = [x, z]
      next[tileIndex] = arr
      try { localStorage.setItem(PLACE_KEY, JSON.stringify(next)) } catch { }
      return next
    })

    // 2) Auto-advance: slot -> slot+1, tile +1 when slot wraps
    const nextSlot = (slot + 1) % 8
    const nextTile = (tileIndex + (nextSlot === 0 ? 1 : 0)) % 40

    setEditTile(nextTile)
    setEditSlot(nextSlot)
  }

  // ---------------- UI ----------------
  return (
    <main style={{ padding: '24px 28px' }}>
      <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800 }}>MonopolyTR (alpha)</h1>

      {/* Join / status bar */}
      <section style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0', flexWrap: 'wrap' }}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="adın" />
        <input value={roomId} onChange={e => setRoomId(e.target.value)} placeholder="oda" />
        {!me && (
          <button disabled={!connected} onClick={() => send({ type: 'join', name: name.trim(), roomId })}>
            Katıl
          </button>
        )}
        <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.7 }}>
          {connected ? `Bağlı (${socket.id})` : 'Bağlantı yok'} {err && `• ${err}`}
        </span>
      </section>

      {/* Quick side cameras (fov 56) */}
      <section style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 12, opacity: 0.8 }}>Yan Kameralar:</b>
        <button onClick={() => jumpToSide(sideCams.GO)}>GO</button>
        <button onClick={() => jumpToSide(sideCams.JAIL)}>Hapishane</button>
        <button onClick={() => jumpToSide(sideCams.FREE)}>Bedava Park</button>
        <button onClick={() => jumpToSide(sideCams.GTJ)}>Hapse Git</button>
        <span style={{ fontSize: 12, opacity: 0.6 }}>(Seç → panoya tıkla → nokta kaydet)</span>
      </section>

      {/* Placement editor */}
      <section style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <button onClick={() => setEditEnabled(v => !v)}>
          {editEnabled ? 'Yerleştirme: AÇIK' : 'Yerleştirme: KAPALI'}
        </button>

        <label style={{ fontSize: 12 }}>
          Karo:
          <input
            type="number" min={0} max={39}
            value={editTile ?? ''}
            onChange={e => setEditTile(e.target.value === '' ? undefined : Math.max(0, Math.min(39, Number(e.target.value))))}
            placeholder="auto"
            style={{ width: 72, marginLeft: 6 }}
          />
        </label>

        <label style={{ fontSize: 12 }}>
          Slot:
          <input
            type="number" min={0} max={7}
            value={editSlot}
            onChange={e => setEditSlot(Math.max(0, Math.min(7, Number(e.target.value))))}
            style={{ width: 60, marginLeft: 6 }}
          />
        </label>

        <button
          onClick={() => { try { navigator.clipboard?.writeText(JSON.stringify(placements, null, 2)) } catch { } }}
        >
          JSON Kopyala
        </button>
        <button
          onClick={() => {
            const s = prompt('JSON yapıştır (placement overrides):')
            if (!s) return
            try {
              const parsed = JSON.parse(s)
              const normalized = normalizePlacements(parsed)
              setPlacements(normalized)
              localStorage.setItem(PLACE_KEY, JSON.stringify(normalized))
            } catch { alert('Geçersiz JSON') }
          }}
        >
          JSON Yükle
        </button>
        <button
          onClick={() => { if (confirm('Tüm yerleşimleri sil?')) { setPlacements({}); try { localStorage.removeItem(PLACE_KEY) } catch { } } }}
        >
          Temizle
        </button>
      </section>

      {/* Minimal play controls */}
      {state && state.started && isMyTurn && (
        <section style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <button onClick={() => send({ type: 'roll' })}>Zar At</button>
          <button onClick={() => send({ type: 'buy' })}>Satın Al</button>
          <button onClick={() => send({ type: 'decline' })}>İhaleye Aç</button>
          <button onClick={() => send({ type: 'endTurn' })}>Sırayı Geç</button>
        </section>
      )}

      {/* 3D board */}
      <div style={{ marginTop: 12 }}>
        <Board3D
          players={state?.players ?? {}}
          boardImageUrl="/board.png"
          models={(() => {
            const ids = state ? Object.keys(state.players) : []
            const m: Record<string, any> = {}
            if (ids[0]) m[ids[0]] = { url: '/models/Monopoly_House.stl', scale: 0.02, color: '#16a34a', rotation: [-Math.PI / 2, 0, 0], y: 0.18 }
            if (ids[1]) m[ids[1]] = { url: '/models/Monopoly_Hotel.stl', scale: 0.02, color: '#dc2626', rotation: [-Math.PI / 2, 0, 0], y: 0.18 }
            return m
          })()}

          // board look
          worldSize={10}
          outfill={0.08}
          boardThickness={0.3}
          rimHeight={0.05}
          rimColor="#000"
          lighting={{ ambient: 0.3, hemi: 0.2, key: 0.85, fill: 0.4, exposure: 1.0, background: '#e9edf0' }}

          // camera (lerp fixed to 0.025 per your note)
          presets={presets}
          presetIndex={preset}
          onPresetChange={(i, p) => handlePresetChange(i, p)}
          waitingMode={!!(state && !state.started)}
          waitingPreset={waitingPreset}
          cameraLerp={0.025}
          devCameraHUD={false}

          // placement: use your saved points
          placementOverrides={placements}
          placementAliases={{ 30: 10 }}
          editPlacement={{ enabled: editEnabled, tileIndex: editTile, slot: editSlot }}
          onPlace={(tile, slot, x, z) => handlePlace(tile, slot, x, z)}

          indexRotation={0}
          pathDirection="clockwise"
          displayOffset={0}

          // labels/balls off
          showLabels={false}
          showFallbackSpheres={false}
        />
      </div>
    </main>
  )
}
