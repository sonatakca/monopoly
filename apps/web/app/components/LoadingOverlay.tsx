"use client"

import React, { useEffect, useRef, useState } from "react"
import { useProgress } from "@react-three/drei"
import { Ring2 } from "ldrs/react"
import "ldrs/react/Ring2.css"

type LoadingOverlayProps = {
  /** Optional: force show (e.g., while setting up) */
  forceShow?: boolean
  /** Optional: ms to keep overlay visible after loading completes to avoid flicker */
  holdAfterReadyMs?: number
  /** Optional: fade duration ms (should match transition below) */
  fadeMs?: number
  /** If true (default), show only during initial boot; ignore later loading spikes */
  onlyDuringBoot?: boolean
}

/**
 * Covers its parent (which should be position:relative) from the first paint,
 * and stays until Drei reports fully complete (active=false && progress=100).
 */
export default function LoadingOverlay({
  forceShow,
  holdAfterReadyMs = 250,
  fadeMs = 300,
  onlyDuringBoot = true,
}: LoadingOverlayProps) {
  const { active, progress, total } = useProgress()

  // We only consider "ready" after we've actually seen loading begin at least once.
  const [seenLoading, setSeenLoading] = useState(false)
  useEffect(() => {
    if (active || total > 0) setSeenLoading(true)
  }, [active, total])

  const ready = seenLoading && !active && (progress ?? 0) >= 100

  // After first full ready, lock the overlay to never reappear (unless forceShow)
  const [bootLocked, setBootLocked] = useState(false)
  useEffect(() => {
    if (onlyDuringBoot && ready && !bootLocked) setBootLocked(true)
  }, [onlyDuringBoot, ready, bootLocked])

  // Vis/Unmount control with fade
  const [visible, setVisible] = useState(true) // start visible to cover first frames
  const [hidden, setHidden] = useState(false)
  const hideTimer = useRef<number | null>(null)
  const unmountTimer = useRef<number | null>(null)

  useEffect(() => {
    // Clear any pending timers on prop/state changes
    if (hideTimer.current) window.clearTimeout(hideTimer.current)
    if (unmountTimer.current) window.clearTimeout(unmountTimer.current)

    const shouldShow = !!(forceShow || (!onlyDuringBoot ? !ready : (!bootLocked && !ready)))
    if (shouldShow) {
      setHidden(false)
      setVisible(true)
    } else {
      // Ready → small hold to avoid “blink”, then fade, then unmount
      hideTimer.current = window.setTimeout(() => {
        setVisible(false)
        unmountTimer.current = window.setTimeout(() => setHidden(true), fadeMs)
      }, holdAfterReadyMs)
    }

    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current)
      if (unmountTimer.current) window.clearTimeout(unmountTimer.current)
    }
  }, [ready, forceShow, holdAfterReadyMs, fadeMs])

  if (hidden) return null

  const pct = Math.min(100, Math.max(0, Math.round(progress || 0)))

  return (
    <div
      className="loading-overlay"
      style={{
        // FULL COVER from first paint:
        position: "absolute",
        inset: 0,
        zIndex: 9999,
        display: "grid",
        placeItems: "center",
        // Interaction + fade:
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
        transition: `opacity ${fadeMs}ms ease`,
        // Look:
        backdropFilter: visible ? "blur(8px)" : "none",
        WebkitBackdropFilter: visible ? "blur(8px)" : "none",
        backgroundColor: visible ? "rgba(15,15,20,0.35)" : "transparent",
      }}
    >
      <div
        className="loading-card"
        style={{
          width: 320,
          maxWidth: "90vw",
          borderRadius: 16,
          padding: 16,
          color: "#fff",
          background: "rgba(17,24,39,0.60)",
          border: "1px solid rgba(255,255,255,0.14)",
          boxShadow: "0 10px 42px rgba(0,0,0,0.35)",
        }}
      >
        <div
          className="loading-spinner"
          aria-hidden="true"
          style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}
        >
          <Ring2
            size="40"
            stroke="5"
            strokeLength="0.25"
            bgOpacity="0.1"
            speed="1.2"
            color="currentColor"
          />
        </div>

        <div className="loading-title" style={{ fontWeight: 700, fontSize: 16, textAlign: "center" }}>
          Oyun hazırlanıyor...
        </div>
        <div className="loading-sub" style={{ opacity: 0.85, fontSize: 13, textAlign: "center", marginTop: 2 }}>
          Oyun taşları yükleniyor...
        </div>

        <div
          className="loading-bar"
          aria-hidden="true"
          style={{
            height: 8,
            borderRadius: 999,
            background: "rgba(255,255,255,0.14)",
            marginTop: 14,
            overflow: "hidden",
          }}
        >
          <div
            className="loading-bar__fill"
            style={{
              transform: `scaleX(${pct / 100})`,
              transformOrigin: "left center",
              transition: "transform 360ms cubic-bezier(.2,.8,.2,1)",
              willChange: "transform",
              height: "100%",
              backgroundColor: "currentColor",
            }}
          />
        </div>

        <div
          className="loading-meta"
          style={{ marginTop: 8, fontSize: 12, opacity: 0.8, textAlign: "center" }}
        >
          <span>{pct}%</span>
        </div>
      </div>
    </div>
  )
}
