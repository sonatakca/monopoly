'use client'
import { useEffect, useMemo, useState } from 'react'
import { socket } from '../lib/socket'
import type { ServerEvent, ClientEvent, RoomState } from '../../../packages/shared/types'
import board from '../../../packages/shared/board.tr.json'

export default function Home() {
  const [state, setState] = useState<RoomState | null>(null)
  const [name, setName] = useState('Oyuncu-'+Math.floor(Math.random()*1000))
  const [roomId, setRoomId] = useState('oda-1')
  const [connected, setConnected] = useState(socket.connected)

  useEffect(() => {
    const handleEvent = (evt: ServerEvent) => {
      if (evt.type === 'state') setState({ ...evt.state })
      if (evt.type === 'msg') console.log('[MSG]', evt.text)
      if (evt.type === 'error') alert(evt.text)
    }
    socket.on('event', handleEvent)
    const handleConnect = () => {
      setConnected(true)
    }
    const handleDisconnect = () => {
      setConnected(false)
      setState(null)
    }
    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    return () => {
      socket.off('event', handleEvent)
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
    }
  }, [])

  const currentPlayer = useMemo(
    () => state && state.order.length ? state.players[state.order[state.turnIndex]] : null,
    [state]
  )
  const myId = socket.id
  const joined = Boolean(state && myId && state.players[myId])
  const isMyTurn = joined && currentPlayer ? currentPlayer.id === myId : false
  const started = Boolean(state?.started)

  function send(e: ClientEvent) { socket.emit('event', e) }
  function joinRoom() {
    const safeName = name.trim() || 'Oyuncu'
    const safeRoom = roomId.trim() || 'oda-1'
    send({ type: 'join', name: safeName, roomId: safeRoom })
  }

  return (
    <div>
      <section style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="adın" />
        <input value={roomId} onChange={e=>setRoomId(e.target.value)} placeholder="oda" />
        <button onClick={joinRoom} disabled={!connected}>Katıl</button>
        <button onClick={()=>send({ type: 'start' })} disabled={!joined || started}>Başlat</button>
      </section>

      {!connected && (
        <p style={{ marginBottom: 12 }}>Sunucuya bağlanılıyor...</p>
      )}

      {connected && !joined && (
        <p style={{ marginBottom: 12 }}>Oyuna başlamak için önce odaya katılmalısın.</p>
      )}

      {state && (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
            {state.order.map(pid => (
              <div key={pid} style={{ padding: 8, border: '1px solid #ddd', borderRadius: 8 }}>
                <b>{state.players[pid].name}</b> — {state.players[pid].cash}₺ — Poz: {state.players[pid].position}
              </div>
            ))}
          </div>

          {started && (
            <p style={{ marginBottom: 8 }}>
              {isMyTurn ? 'Sıra sende!' : `Sıradaki oyuncu: ${currentPlayer?.name ?? '—'}`}
            </p>
          )}

          <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
            <button onClick={()=>send({ type:'roll' })} disabled={!joined || !started || !isMyTurn}>Zar at</button>
            <button onClick={()=>send({ type:'buy' })} disabled={!joined || !started || !isMyTurn}>Satın al</button>
            <button onClick={()=>send({ type:'endTurn' })} disabled={!joined || !started || !isMyTurn}>Sırayı geç</button>
          </div>

          <BoardMini positions={Object.fromEntries(Object.values(state.players).map(p=>[p.id,p.position]))} />
        </>
      )}
    </div>
  )
}

function BoardMini({ positions }: { positions: Record<string, number> }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 4 }}>
      {board.spaces.map(sp => (
        <div key={sp.id} style={{ border: '1px solid #e5e7eb', padding: 6, minHeight: 48, position:'relative' }}>
          <div style={{ fontSize: 12, opacity: 0.8 }}>{sp.id}. {sp.name}</div>
          <div style={{ position:'absolute', inset: 6, display:'flex', gap: 4, alignItems:'end', justifyContent:'end' }}>
            {Object.entries(positions).filter(([,pos]) => pos === sp.id).map(([pid]) => (
              <span key={pid} title={pid} style={{ width: 10, height: 10, borderRadius: 9999, background: '#111' }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
