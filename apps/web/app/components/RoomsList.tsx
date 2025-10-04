"use client"

import React, { useEffect, useState } from 'react'

export type RoomSummary = {
  roomId: string
  started: boolean
  playerCount: number
  readyCount: number
  players: { id: string; name: string }[]
}

export default function RoomsList({
  onSelect,
  onJoin,
  me,
  apiBase,
}: {
  onSelect: (roomId: string) => void
  onJoin: (roomId: string) => void
  me: any
  apiBase?: string
}) {
  const API = apiBase || (process.env.NEXT_PUBLIC_API_URL as string) || 'http://127.0.0.1:8787'
  const [rooms, setRooms] = useState<RoomSummary[]>([])
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  async function loadRooms() {
    try {
      setLoading(true)
      setErr('')
      const res = await fetch(`${API}/rooms`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setRooms((json?.rooms || []) as RoomSummary[])
    } catch (e: any) {
      setErr(String(e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRooms()
    const t = setInterval(loadRooms, 5000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const has = rooms.length > 0

  return (
    <section className="card">
      <div className="row" style={{ marginBottom: 6 }}>
        <b>Mevcut Odalar</b>
        <div className="spacer" />
        <button className="btn" onClick={loadRooms} disabled={loading}>{loading ? 'Yükleniyor…' : 'Yenile'}</button>
      </div>
      {err && <div style={{ fontSize: 12, opacity: 0.8, color: '#ef4444' }}>Hata: {err}</div>}
      {!has && !err && <div style={{ fontSize: 13, opacity: 0.8 }}>Aktif oyunculu bir oda bulunamadı.</div>}
      {has && (
        <div className="players-grid">
          {rooms.map((r) => (
            <div key={r.roomId} className="card player-card" style={{ padding: 12 }}>
              <div className="row">
                <div><b>Oda:</b> {r.roomId}</div>
                <div className="spacer" />
                <div className="muted" style={{ fontSize: 12 }}>{r.started ? 'Oyun Başladı' : 'Lobi'}</div>
              </div>
              <div className="player-meta">Oyuncular: {r.playerCount} • Hazır: {r.readyCount}</div>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                {r.players.map((p) => (
                  <span key={p.id} className="muted" style={{ fontSize: 12, padding: '2px 6px', border: '1px dashed var(--border)', borderRadius: 6 }}>{p.name}</span>
                ))}
              </div>
              <div className="row" style={{ marginTop: 6 }}>
                <button className="btn" onClick={() => onSelect(r.roomId)}>Odayı Seç</button>
                {!me && <button className="btn btn-primary" onClick={() => onJoin(r.roomId)}>Katıl</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

