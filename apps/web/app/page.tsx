'use client'
import { useEffect, useMemo, useState } from 'react'
import { socket } from '../lib/socket'
import type { ServerEvent, ClientEvent, RoomState } from '../../../packages/shared/types'
import board from '../../../packages/shared/board.tr.json'

export default function Home() {
  const [state, setState] = useState<RoomState | null>(null)
  const [name, setName] = useState('Oyuncu-'+Math.floor(Math.random()*1000))
  const [roomId, setRoomId] = useState('oda-1')

  useEffect(() => {
    socket.on('event', (evt: ServerEvent) => {
      if (evt.type === 'state') setState({ ...evt.state })
      if (evt.type === 'msg') console.log('[MSG]', evt.text)
      if (evt.type === 'error') alert(evt.text)
    })
    return () => { socket.off('event') }
  }, [])

  const me = useMemo(() => state && state.order.length ? state.players[state.order[state.turnIndex]] : null, [state])

  function send(e: ClientEvent) { socket.emit('event', e) }

  return (
    <div>
      <section style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="adın" />
        <input value={roomId} onChange={e=>setRoomId(e.target.value)} placeholder="oda" />
        <button onClick={()=>send({ type: 'join', name, roomId })}>Katıl</button>
        <button onClick={()=>send({ type: 'start' })}>Başlat</button>
      </section>

      {state && (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
            {state.order.map(pid => (
              <div key={pid} style={{ padding: 8, border: '1px solid #ddd', borderRadius: 8 }}>
                <b>{state.players[pid].name}</b> — {state.players[pid].cash}₺ — Poz: {state.players[pid].position}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
            <button onClick={()=>send({ type:'roll' })}>Zar at</button>
            <button onClick={()=>send({ type:'buy' })}>Satın al</button>
            <button onClick={()=>send({ type:'endTurn' })}>Sırayı geç</button>
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
