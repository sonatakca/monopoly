"use client"

import React, { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useLoader } from '@react-three/fiber'

export type ActionCard3DProps = {
  frontUrl: string
  backUrl: string
  /** Card width in world units */
  width?: number
  /** Card thickness in world units */
  thickness?: number
  /** Optional position */
  position?: [number, number, number]
  /** Optional rotation in radians (Euler XYZ) */
  rotation?: [number, number, number]
  /** Raise slightly on hover (same as PropertyCard3D) */
  hoverLift?: boolean
  /** Enable shadow casting for the card */
  castShadows?: boolean
}

// Same behavior and materials layout as PropertyCard3D, but using arbitrary textures
export default function ActionCard3D({
  frontUrl,
  backUrl,
  width = 0.9,
  thickness = 0.02,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  hoverLift = true,
  castShadows = true,
}: ActionCard3DProps) {
  const frontMap = useLoader(THREE.TextureLoader, frontUrl)
  const backMap = useLoader(THREE.TextureLoader, backUrl)

  useMemo(() => {
    if (frontMap) frontMap.colorSpace = THREE.SRGBColorSpace;
    if (backMap) backMap.colorSpace = THREE.SRGBColorSpace;
  }, [frontMap, backMap]);

  // Increase texture quality a bit on supported GPUs
  const maxAniso = THREE.MathUtils.clamp((THREE as any).WebGLRenderer ? 8 : 16, 1, 16)
  frontMap.anisotropy = Math.max(frontMap.anisotropy, maxAniso)
  backMap.anisotropy = Math.max(backMap.anisotropy, maxAniso)
  frontMap.minFilter = THREE.LinearMipmapLinearFilter
  frontMap.magFilter = THREE.LinearFilter
  backMap.minFilter = THREE.LinearMipmapLinearFilter
  backMap.magFilter = THREE.LinearFilter

  // Preserve image aspect ratio to compute card height from desired width
  const height = useMemo(() => {
    const fw = frontMap.image?.width || 796
    const fh = frontMap.image?.height || 512
    const aspect = fh / Math.max(1, fw)
    return width * aspect
  }, [frontMap.image, width])

  const groupRef = useRef<THREE.Group>(null)
  const meshRef = useRef<THREE.Mesh>(null)
  const hoverRef = useRef(false)

  useFrame((_, dt) => {
    if (!hoverLift || !groupRef.current) return
    const t = (hoverRef.current ? 1 : 0)
    const g = groupRef.current
    // Smoothly lift only (no tilt)
    const currentY = g.position.y
    const targetY = position[1] + (t ? 0.03 : 0)
    g.position.y = THREE.MathUtils.damp(currentY, targetY, 8, dt)
    // Keep rotation stable at provided rotation
    g.rotation.x = rotation[0]
    g.rotation.y = rotation[1]
    g.rotation.z = rotation[2]
  })

  const onPointerOver = () => { hoverRef.current = true }
  const onPointerOut = () => { hoverRef.current = false }

  // Box geometry material order: [px, nx, py, ny, pz, nz]
  const materials = useMemo(() => {
    const edge = new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.8, metalness: 0.0 })
    const front = new THREE.MeshStandardMaterial({ map: frontMap, roughness: 0.6, metalness: 0.0 })
    const back = new THREE.MeshStandardMaterial({ map: backMap, roughness: 0.6, metalness: 0.0 })
    return [edge, edge, edge, edge, front, back]
  }, [frontMap, backMap])

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      <mesh
        ref={meshRef}
        castShadow={castShadows}
        receiveShadow={false}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      >
        <boxGeometry args={[width, height, thickness]} />
        {materials.map((m, i) => (
          <primitive key={i} attach={`material-${i}`} object={m} />
        ))}
      </mesh>
    </group>
  )
}
