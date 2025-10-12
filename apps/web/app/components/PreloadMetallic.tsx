"use client"

import { useEffect } from "react"

export default function PreloadMetallic() {
  useEffect(() => {
    try {
      const w: any = typeof window !== 'undefined' ? window : null
      if (w && !w.__metallicPreloaded) {
        w.__metallicPreloaded = true
        import('metallicss').catch(() => { try { w.__metallicPreloaded = false } catch {} })
      }
    } catch {}
  }, [])
  return null
}

