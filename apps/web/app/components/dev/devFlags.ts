"use client"

export type DevFlag =
  | 'disableDice'
  | 'disableDiceShadows'
  | 'disableShadows'
  | 'disableFog'
  | 'lowDpr'
  | 'disableTokenAnimation'
  | 'suppressMsgs'
  | 'frameloopAlways'
  | 'noAA'
  | 'disableControls'
  | 'disable3D'
  | 'lockCameraDrag'
  | 'disableBackdropBlur'
  | 'disableTokens'
  | 'showZones'
  | 'editZones'
  | 'showFPSTracker'
  | 'showPropertyCard'
  | 'showPropertyCard3D'
  | 'sim8'
  | 'useDevZoneJson'
  | 'tileZones'
  | 'dumpTileZones'
  | 'getCurrentCamData'
  | 'showHouseZones'

const LS_PREFIX = 'monopoly.dev.flag.'

export function ensureDevFlagsAPI() {
  if (typeof window === 'undefined') return
  const w: any = window as any
  if (!w.MonopolyDev) w.MonopolyDev = {}
  if (!w.MonopolyDev.flags) w.MonopolyDev.flags = {}
  if (!w.MonopolyDev.set) {
    w.MonopolyDev.set = (key: DevFlag, val: boolean) => {
      try { localStorage.setItem(LS_PREFIX + key, val ? '1' : '0') } catch {}
      w.MonopolyDev.flags[key] = !!val
      // Broadcast a custom event so components can react immediately
      try { window.dispatchEvent(new CustomEvent('monopoly.devflag', { detail: { key, val } })) } catch {}
    }
  }
  if (!w.MonopolyDev.get) {
    w.MonopolyDev.get = (key: DevFlag, def = false) => getDevFlag(key, def)
  }
}

export function getDevFlag(key: DevFlag, def = false): boolean {
  if (typeof window === 'undefined') return def
  try {
    const w: any = window as any
    if (w.MonopolyDev?.flags && key in w.MonopolyDev.flags) return !!w.MonopolyDev.flags[key]
    const raw = localStorage.getItem(LS_PREFIX + key)
    if (raw != null) return raw === '1'
  } catch {}
  return def
}
