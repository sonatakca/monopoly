"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { useProgress } from "@react-three/drei"
import { Ring2 } from 'ldrs/react'
import 'ldrs/react/Ring2.css'




type LoadingOverlayProps = {
  /** Optional: force show (e.g., while setting up) */
  forceShow?: boolean
}

/**
 * A modern loading overlay that tracks R3F/Drei asset loading via useProgress
 * and fades out when the scene is ready. Place inside a relatively-positioned
 * container so it can cover the Canvas.
 */
export default function LoadingOverlay({ forceShow }: LoadingOverlayProps) {
  const { active, progress, loaded, total, item } = useProgress()

  // Ensure we display at least briefly to avoid flicker, and only consider
  // completion after we've seen any loading activity.
  const [initialHold, setInitialHold] = useState(true)
  const [seenLoading, setSeenLoading] = useState(false)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setInitialHold(false), 250)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    if (active || total > 0) setSeenLoading(true)
  }, [active, total])

  // Determine visibility: show during initial hold, while loading active,
  // or while we've seen loading but progress < 100.
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const shouldShow = !!(
      forceShow ||
      initialHold ||
      active ||
      (seenLoading && progress < 100)
    )
    if (shouldShow) {
      setVisible(true)
      setHidden(false)
    } else {
      setVisible(false)
      const t = window.setTimeout(() => setHidden(true), 320)
      return () => window.clearTimeout(t)
    }
  }, [forceShow, initialHold, active, seenLoading, progress])

  if (hidden) return null

  const pct = Math.min(100, Math.max(0, Math.round(progress || 0)))

  return (
    <div
      className="loading-overlay"
      style={{
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
        transition: "opacity 300ms ease",
        backdropFilter: visible ? 'blur(100px)' : 'none',
        WebkitBackdropFilter: visible ? 'blur(8px)' : 'none',
        backgroundColor: visible ? 'rgba(255,255,255,0.12)' : 'transparent',
        borderRadius: '10px'
      }}
    >

      <div className="loading-card">

        <div className="loading-spinner" aria-hidden="true">
          <Ring2
            size="40"
            stroke="5"
            strokeLength="0.25"
            bgOpacity="0.1"
            speed="1.2"
            color="currentColor"
          />
        </div>
        <div className="loading-title">Oyun hazırlanıyor...</div>
        <div className="loading-sub">Oyun taşları yükleniyor...</div>
        <div className="loading-bar" aria-hidden="true" style={{ overflow: 'hidden' }}>
          <div
            className="loading-bar__fill"
            style={{
              transform: `scaleX(${pct / 100})`,
              transformOrigin: 'left center',
              transition: 'transform 360ms cubic-bezier(.2,.8,.2,1)',
              willChange: 'transform',
              height: '100%',
              backgroundColor: 'currentColor',
            }}
          />
        </div>
        <div className="loading-meta">
          <span>{pct}%</span>
        </div>
      </div>
    </div>
  )
}
