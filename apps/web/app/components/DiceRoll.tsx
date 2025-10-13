'use client'

import * as THREE from 'three'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { getDevFlag } from './dev/devFlags'
import { useGLTF, useAnimations } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'

type Vec3 = [number, number, number]

export type DiceRollProps = {
  d1: number
  d2: number
  position?: Vec3
  rotation?: Vec3
  scale?: number | Vec3
  /** Changing this value will (re)start the animation. */
  trigger?: number | string
  /** 'roller' shows a longer animation, 'spectator' plays faster */
  mode?: 'roller' | 'spectator'
  /** Allow controlling whether dice cast dynamic shadows */
  castShadows?: boolean
  onFinished?: () => void
}

export default function DiceRoll({
  d1,
  d2,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  trigger = 0,
  mode = 'roller',
  castShadows,
  onFinished,
}: DiceRollProps) {
  const hi = Math.max(d1, d2)
  const lo = Math.min(d1, d2)
  const url = `/animations/dice ${hi}-${lo}.glb`

  const group = useRef<THREE.Group>(null!)
  const { scene, animations } = useGLTF(url) as unknown as { scene: THREE.Group; animations: THREE.AnimationClip[] }
  const { actions, names, mixer } = useAnimations(animations, group)
  const invalidate = useThree((s) => s.invalidate)

  const [isPlaying, setIsPlaying] = useState(false)
  const onFinishedRef = useRef(onFinished)
  useEffect(() => { onFinishedRef.current = onFinished }, [onFinished])

  // Hide helper meshes; enable dynamic shadows conservatively
  useEffect(() => {
    scene.traverse((o) => {
      const m = o as any
      if (m?.isMesh) {
        const name = (m.name || '').toLowerCase()
        const isHelper = /plane|floor|ground|shadow|helper|collider/.test(name)
        if (isHelper) {
          m.visible = false
          m.castShadow = false
          m.receiveShadow = false
          const mat: any = m.material
          if (Array.isArray(mat)) mat.forEach((mm) => { if (mm) { mm.colorWrite = false; mm.depthWrite = false } })
          else if (mat) { mat.colorWrite = false; mat.depthWrite = false }
        } else {
          // Casting onto the board is the expensive part we want; dice don't need to receive
          const allowCast = typeof castShadows === 'boolean' ? castShadows : !getDevFlag('disableDiceShadows')
          m.castShadow = allowCast
          m.receiveShadow = false
        }
      }
      if ((m as any).isSkinnedMesh) m.frustumCulled = false
    })
  }, [scene, castShadows])

  // Align the GLB so its lowest point rests at y=0
  useEffect(() => {
    scene.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(scene)
    if (Number.isFinite(box.min.y) && box.min.y !== 0) scene.position.y -= box.min.y
  }, [scene])

  const clipsToPlay = useMemo(() => {
    if (!names || names.length === 0) return []
    // Some GLBs contain two actions; play all of them sequentially
    return names
  }, [names])

  useEffect(() => {
    if (!actions) return
    // Stop and reset all actions first
    Object.values(actions).forEach((a) => { if (a) { a.stop(); a.reset() } })

    let anyStarted = false
    clipsToPlay.forEach((name) => {
      const a = actions[name]
      if (!a) return
      a.clampWhenFinished = true
      a.setLoop(THREE.LoopOnce, 1)
      // Spectators play faster to "sync catch up"
      a.timeScale = mode === 'roller' ? 0.6 : 1.0
      a.enabled = true
      a.reset().play()
      anyStarted = true
    })

    if (anyStarted) setIsPlaying(true)

    const onFinishedAll = () => {
      const running = clipsToPlay.some((name) => {
        const a = actions[name]
        return !!a && (a.isRunning() || a.time < a.getClip().duration)
      })
      if (!running) { setIsPlaying(false); onFinishedRef.current?.() }
    }
    mixer.addEventListener('finished', onFinishedAll)
    return () => { mixer.removeEventListener('finished', onFinishedAll) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, trigger, actions, clipsToPlay, mixer, mode])

  useFrame((_, delta) => {
    if (!isPlaying) return
    mixer.update(delta)
    invalidate()
  })

  return (
    <group ref={group} position={position as Vec3} rotation={rotation as Vec3} scale={scale as any}>
      <primitive object={scene} />
    </group>
  )
}

// Optional: preload a common clip to warm cache
useGLTF.preload?.('/animations/dice 6-6.glb')

