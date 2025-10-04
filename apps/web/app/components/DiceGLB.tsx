'use client'

import * as THREE from 'three'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useGLTF, useAnimations } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'

type Vec3 = [number, number, number]

export type DiceGLBProps = {
  url: string
  position?: Vec3
  rotation?: Vec3
  scale?: number | Vec3
  /** If true, play all clips found in the GLB; otherwise plays the first clip. */
  playAll?: boolean
  /** Changing this value will (re)start the animation. */
  trigger?: number | string
  /** Called once all (LoopOnce) actions have finished. */
  onFinished?: () => void
}

export default function DiceGLB({
  url,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  playAll = false,
  trigger = 0,
  onFinished,
}: DiceGLBProps) {
  const group = useRef<THREE.Group>(null!)
  const { scene, animations } = useGLTF(url) as unknown as { scene: THREE.Group; animations: THREE.AnimationClip[] }
  const { actions, names, mixer } = useAnimations(animations, group)
  const invalidate = useThree((s) => s.invalidate)

  const [isPlaying, setIsPlaying] = useState(false)
  const onFinishedRef = useRef(onFinished)
  useEffect(() => { onFinishedRef.current = onFinished }, [onFinished])

  // Ensure the scene is not frustum-culled unexpectedly
  useEffect(() => {
    scene.traverse((o) => {
      o.frustumCulled = false
      if ((o as any).isMesh) {
        const m = o as THREE.Mesh
        m.castShadow = true
        m.receiveShadow = true
      }
      // Make sure skinned meshes update properly
      if ((o as any).isSkinnedMesh) {
        const sm = o as THREE.SkinnedMesh
        sm.frustumCulled = false
      }
    })
  }, [scene])

  // Auto-ground the GLB so its lowest point sits at local y=0
  useEffect(() => {
    scene.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(scene)
    if (Number.isFinite(box.min.y) && box.min.y !== 0) {
      scene.position.y -= box.min.y
    }
  }, [scene])

  // Prepare a list of clips to play
  const clipsToPlay = useMemo(() => {
    if (!names || names.length === 0) return []
    return playAll ? names : [names[0]]
  }, [names, playAll])

  // (Re)start animations whenever url or trigger changes
  useEffect(() => {
    if (!actions) return
    // Stop and reset all actions first
    Object.values(actions).forEach((a) => {
      if (!a) return
      a.stop()
      a.reset()
    })

    let anyStarted = false
    clipsToPlay.forEach((name) => {
      const a = actions[name]
      if (!a) return
      // For dice we usually want a one-shot that holds the last frame
      a.clampWhenFinished = true
      a.setLoop(THREE.LoopOnce, 1)
      a.enabled = true
      a.reset().play()
      anyStarted = true
    })

    if (anyStarted) {
      setIsPlaying(true)
    }

    const onFinishedAll = () => {
      // If any action is still running, ignore; otherwise mark finished
      const running = clipsToPlay.some((name) => {
        const a = actions[name]
        return !!a && (a.isRunning() || a.time < a.getClip().duration)
      })
      if (!running) {
        setIsPlaying(false)
        onFinishedRef.current?.()
      }
    }

    mixer.addEventListener('finished', onFinishedAll)
    return () => {
      mixer.removeEventListener('finished', onFinishedAll)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, trigger, actions, clipsToPlay, mixer])

  // Drive the mixer every frame and invalidate (needed if Canvas frameloop="demand")
  useFrame((_, delta) => {
    if (!isPlaying) return
    mixer.update(delta)
    invalidate() // ensure frames render while animating in demand/always frameloops
  })

  return (
    <group ref={group} position={position as Vec3} rotation={rotation as Vec3} scale={scale as any}>
      {/* Put the loaded scene under our group so useAnimations can bind properly */}
      <primitive object={scene} />
    </group>
  )
}

// Drei GLTF loader cache hint (optional)
useGLTF.preload?.('/animations/dice 6-1.glb')
