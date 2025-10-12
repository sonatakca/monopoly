"use client"

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import * as THREE from "three"
import { Undo, Redo } from "lucide-react"
import { renderToStaticMarkup } from "react-dom/server"
import ActionCard3D from "./ActionCard3D"
import { MetallicActionButton } from "./GameButtons"
import { ChevronRight } from "lucide-react"

/** Convert a Lucide SVG React element into a CSS cursor data URL */
function iconToCursor(icon: React.ReactElement, hotspotX = 12, hotspotY = 12) {
  const svg = renderToStaticMarkup(icon) // color baked into SVG
  return `url('data:image/svg+xml;utf8,${encodeURIComponent(svg)}') ${hotspotX} ${hotspotY}, auto`
}

function FlippableActionCard({ frontUrl, backUrl, active, onFlippedOnce }: { frontUrl: string; backUrl: string; active: boolean; onFlippedOnce?: () => void }) {
  // Base pose identical to property card modal
  const BASE_EULER = useMemo(() => new THREE.Euler(-0.4, 0.42, 0.17, "XYZ"), [])
  const qBase = useMemo(() => new THREE.Quaternion().setFromEuler(BASE_EULER), [BASE_EULER])
  const qFlipY = useMemo(
    () => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI),
    []
  )

  const group = useRef<THREE.Group>(null)
  const [showFront, setShowFront] = useState(false)
  const [hovered, setHovered] = useState(false)

  // Black icons for cursor
  const undoCursor = useMemo(
    () => iconToCursor(<Undo size={24} strokeWidth={2} color="#000000" />),
    []
  )
  const redoCursor = useMemo(
    () => iconToCursor(<Redo size={24} strokeWidth={2} color="#000000" />),
    []
  )

  // Update cursor instantly while hovering (even if state flips mid-hover)
  const { gl } = useThree()
  useEffect(() => {
    const el = gl.domElement
    if (!el) return
    el.style.cursor = hovered ? (showFront ? redoCursor : undoCursor) : "auto"
    return () => { if (el) el.style.cursor = "auto" }
  }, [gl, hovered, showFront, undoCursor, redoCursor])

  const qTarget = useMemo(() => new THREE.Quaternion(), [])
  const qWork = useMemo(() => new THREE.Quaternion(), [])

  // Start at BACK pose
  useEffect(() => {
    if (group.current) group.current.quaternion.copy(qBase.clone().multiply(qFlipY))
  }, [qBase])

  useFrame((_, dt) => {
    const g = group.current
    if (!g) return

    // Flip quaternion slerp: front => qBase, back => qBase*qFlipY
    if (showFront) qTarget.copy(qBase)
    else qTarget.copy(qBase).multiply(qFlipY)

    const step = Math.min(1, 10 * dt)
    qWork.copy(g.quaternion).slerp(qTarget, step)
    g.quaternion.copy(qWork)

    // Subtle scale ease for appear/disappear (card-only)
    const targetScale = active ? 1.0 : 0.98
    const s = g.scale.x
    const k = 10
    const next = s + (targetScale - s) * Math.min(1, k * dt)
    g.scale.setScalar(next)
  })

  const over = (e: any) => { e.stopPropagation(); setHovered(true) }
  const out = (e: any) => { e.stopPropagation(); setHovered(false) }
  const flippedOnce = useRef(false)
  const toggle = (e?: any) => {
    e?.stopPropagation?.()
    setShowFront(prev => {
      const next = !prev
      if (next && !flippedOnce.current) { flippedOnce.current = true; onFlippedOnce?.() }
      return next
    })
  }

  return (
    <group
      ref={group}
      position={[0, 0, 0]}
      onPointerOver={over}
      onPointerOut={out}
      onClick={toggle}
      scale={[0.98, 0.98, 0.98]}
    >
      {/* Invisible hitbox for pointer interactions */}
      <mesh onPointerOver={over} onPointerOut={out} onClick={toggle}>
        <planeGeometry args={[1.2, 0.8]} />
        <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} />
      </mesh>

      <ActionCard3D
        frontUrl={frontUrl}
        backUrl={backUrl}
        width={1.2}
        thickness={0.005}
        position={[0, 0, 0]}
        rotation={[0, 0, 0]}
      />
    </group>
  )
}

export default function ActionCardModal3D({
  frontUrl,
  backUrl,
  onClose,
  onContinue,
  canContinue = true,
  accentColor,
}: {
  frontUrl: string
  backUrl: string
  onClose: () => void
  onContinue: () => void
  canContinue?: boolean
  accentColor?: string
}) {
  const TRANSITION_MS = 280
  const [visible, setVisible] = useState(false)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    const r = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(r)
  }, [])

  useEffect(() => {
    if (!closing) return
    const t = setTimeout(onClose, TRANSITION_MS)
    return () => clearTimeout(t)
  }, [closing, onClose])

  const startClose = () => setClosing(true)
  const [readyAt, setReadyAt] = useState<number | null>(null)
  const [showContinue, setShowContinue] = useState(false)
  // Reveal the continue UI 2 seconds after first flip
  useEffect(() => {
    if (readyAt == null) return
    const id = setTimeout(() => setShowContinue(true), 2000)
    return () => clearTimeout(id)
  }, [readyAt])

  const active = visible && !closing
  const blurPx = active ? 8 : 0
  const bgAlpha = active ? 0.35 : 0
  const cardOpacity = active ? 1 : 0

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 30,
        background: `rgba(0,0,0,${bgAlpha})`,
        backdropFilter: `blur(${blurPx}px)`,
        WebkitBackdropFilter: `blur(${blurPx}px)`,
        display: "flex",
        alignItems: "stretch",
        justifyContent: "stretch",
        transition: `background ${TRANSITION_MS}ms ease, backdrop-filter ${TRANSITION_MS}ms ease, -webkit-backdrop-filter ${TRANSITION_MS}ms ease`,
      }}
    >
      <div
        style={{ width: "100%", height: "100%", opacity: cardOpacity, transition: `opacity ${TRANSITION_MS}ms ease` }}
      >
        <Canvas
          style={{ width: "100%", height: "100%", background: "transparent" }}
          camera={{ fov: 80, position: [0.6, 0.6, 1.2] }}
          gl={{ alpha: true, powerPreference: "high-performance", antialias: true }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.NoToneMapping
            try { gl.setClearAlpha(0) } catch { }
          }}
          onPointerMissed={() => { if (showContinue && canContinue) onContinue(); /* otherwise ignore until ready */ }}
          shadows
        >
          <ambientLight intensity={0.05} />
          <directionalLight position={[0, 0, 10]} castShadow intensity={1} />

          <Suspense fallback={null}>
            <FlippableActionCard frontUrl={frontUrl} backUrl={backUrl} active={active} onFlippedOnce={() => setReadyAt(Date.now())} />
          </Suspense>

          <OrbitControls enablePan={false} enableZoom={false} enableRotate={false} />
        </Canvas>
        {/* Continue button overlay */}
        {showContinue && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'end center', pointerEvents: 'none' }}>
            <div style={{ marginBottom: 32, pointerEvents: 'auto' }}>
              <MetallicActionButton
                label="Devam Et"
                icon={<ChevronRight size={18} />}
                onClick={onContinue}
                accentColor={accentColor || '#3b82f6'}
                disabled={!canContinue}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
