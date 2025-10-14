"use client"

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import * as THREE from "three"
import { Undo, Redo } from "lucide-react"
import { renderToStaticMarkup } from "react-dom/server"
import PropertyCard3D from "./PropertyCard3D"

/** Convert a Lucide SVG React element into a CSS cursor data URL */
function iconToCursor(icon: React.ReactElement, hotspotX = 12, hotspotY = 12) {
  const svg = renderToStaticMarkup(icon) // color baked into SVG
  return `url('data:image/svg+xml;utf8,${encodeURIComponent(svg)}') ${hotspotX} ${hotspotY}, auto`
}

function FlippableCard({ id, active }: { id: number; active: boolean }) {
  // Base pose
  const BASE_EULER = useMemo(() => new THREE.Euler(-0.4, 0.42, 0.17, "XYZ"), [])
  const qBase = useMemo(() => new THREE.Quaternion().setFromEuler(BASE_EULER), [BASE_EULER])
  const qFlipY = useMemo(
    () => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI),
    []
  )

  const group = useRef<THREE.Group>(null)
  const [flipped, setFlipped] = useState(false)
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
    el.style.cursor = hovered ? (flipped ? redoCursor : undoCursor) : "auto"
    return () => { if (el) el.style.cursor = "auto" }
  }, [gl, hovered, flipped, undoCursor, redoCursor])

  const qTarget = useMemo(() => new THREE.Quaternion(), [])
  const qWork = useMemo(() => new THREE.Quaternion(), [])

  // Start exactly at base pose
  useEffect(() => {
    if (group.current) group.current.quaternion.copy(qBase)
  }, [qBase])

  useFrame((_, dt) => {
    const g = group.current
    if (!g) return

    // ===== Flip quaternion slerp =====
    if (flipped) qTarget.copy(qBase).multiply(qFlipY)
    else qTarget.copy(qBase)

    const step = Math.min(1, 10 * dt)
    qWork.copy(g.quaternion).slerp(qTarget, step)
    g.quaternion.copy(qWork)

    // Snap when very close
    const dot = THREE.MathUtils.clamp(g.quaternion.dot(qTarget), -1, 1)
    const angle = 2 * Math.acos(dot)
    if (angle < 1e-3) g.quaternion.copy(qTarget)

    // ===== Subtle scale ease for appear/disappear (card-only) =====
    const targetScale = active ? 1.0 : 0.98
    const s = g.scale.x
    const k = 10 // spring-ish speed
    const next = s + (targetScale - s) * Math.min(1, k * dt)
    g.scale.setScalar(next)
  })

  const over = (e: any) => { e.stopPropagation(); setHovered(true) }
  const out = (e: any) => { e.stopPropagation(); setHovered(false) }
  const toggle = (e?: any) => { e?.stopPropagation?.(); setFlipped(f => !f) }

  return (
    <group
      ref={group}
      position={[0, 0, 0]}
      onPointerOver={over}
      onPointerOut={out}
      onClick={toggle}
      // Start slightly smaller so the first frame looks consistent with the fade-in
      scale={[0.98, 0.98, 0.98]}
    >
      {/* Invisible hitbox (requested size) */}
      <mesh onPointerOver={over} onPointerOut={out} onClick={toggle}>
        <planeGeometry args={[0.8, 1.2]} />
        <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} />
      </mesh>

      {/* Card (rotation driven by parent quaternion) */}
      <PropertyCard3D
        id={id}
        width={0.8}
        thickness={0.005}
        position={[0, 0, 0]}
        rotation={[0, 0, 0]}
      />
    </group>
  )
}

export default function PropertyCardModal3D({
  id,
  onClose,
}: {
  id: number
  onClose: () => void
}) {
  // ===== Overlay & card fade in/out =====
  const TRANSITION_MS = 280 // tweak if you like
  const [visible, setVisible] = useState(false)   // true after mount (fade-in)
  const [closing, setClosing] = useState(false)   // true during fade-out

  // Trigger fade-in on mount
  useEffect(() => {
    const r = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(r)
  }, [])

  // When closing starts, call onClose after the CSS transition ends
  useEffect(() => {
    if (!closing) return
    const t = setTimeout(onClose, TRANSITION_MS)
    return () => clearTimeout(t)
  }, [closing, onClose])

  const startClose = () => setClosing(true)

  // Derived visual states
  const active = visible && !closing
  const blurPx = active ? 0 : 0
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
        // Smooth animate overlay blur + background opacity
        transition: `background ${TRANSITION_MS}ms ease, backdrop-filter ${TRANSITION_MS}ms ease, -webkit-backdrop-filter ${TRANSITION_MS}ms ease`,
      }}
    >


      {/* Card fade (opacity) container — fades the 3D content only */}
      <div
        style={{
          width: "100%",
          height: "100%",
          opacity: cardOpacity,
          transition: `opacity ${TRANSITION_MS}ms ease`,
        }}
      >
        <Canvas
          style={{ width: "100%", height: "100%", background: "transparent" }}
          camera={{ fov: 80, position: [0.6, 0.6, 1.2] }}
          gl={{ alpha: true, powerPreference: "high-performance", antialias: true }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.NoToneMapping
            try { gl.setClearAlpha(0) } catch { }
          }}
          // Click anywhere that doesn't hit the card -> start fade-out then close
          onPointerMissed={startClose}
          shadows
        >
          <ambientLight intensity={0.05} />
          <directionalLight position={[0, 0, 10]} castShadow intensity={1} />

          <Suspense fallback={null}>
            <FlippableCard id={id} active={active} />
          </Suspense>

          <OrbitControls enablePan={false} enableZoom={false} enableRotate={false} />
        </Canvas>
      </div>
    </div>
  )
}
