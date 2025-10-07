import { NextResponse } from 'next/server'

// Always fetch fresh data from the game server
export const revalidate = 0

function apiBase() {
  // Prefer explicit API URL, then socket URL, then localhost default
  const api = process.env.NEXT_PUBLIC_API_URL
  const sock = process.env.NEXT_PUBLIC_SOCKET_URL
  const base = (api || sock || 'http://127.0.0.1:8787').replace(/\/$/, '')
  return base
}

export async function GET() {
  try {
    const res = await fetch(`${apiBase()}/rooms`, { cache: 'no-store' })
    if (!res.ok) return NextResponse.json({ error: `upstream ${res.status}` }, { status: 502 })
    const json = await res.json()
    return NextResponse.json(json, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}

