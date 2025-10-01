'use client'
import { Canvas, useFrame, useLoader, useThree, ThreeEvent } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { Suspense, memo, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader'
import type { Player } from '../../../packages/shared/types'

type Lighting = {
    ambient?: number
    hemi?: number
    key?: number
    fill?: number
    exposure?: number
    background?: string
}
type TokenModel = {
    url: string
    scale?: number
    color?: string
    rotation?: [number, number, number]
    y?: number
}
export type CameraPreset = { pos: [number, number, number]; target: [number, number, number]; fov?: number }
type PathDirection = 'clockwise' | 'counterclockwise'
export type PlacementOverrides = { [tileIndex: number]: Array<[number, number] | null> }
type EditPlacement = { enabled: boolean; tileIndex?: number; slot?: number }

type Props = {
    players?: Record<string, Player>
    worldSize?: number
    indexRotation?: 0 | 90 | 180 | 270
    pathDirection?: PathDirection
    displayOffset?: number

    lighting?: Lighting
    models?: Record<string, TokenModel>

    boardImageUrl?: string
    showLabels?: boolean
    showFallbackSpheres?: boolean

    boardThickness?: number
    boardBodyColor?: string
    outfill?: number
    rimHeight?: number
    rimColor?: string

    presets?: CameraPreset[]
    presetIndex?: number
    cameraLerp?: number
    devCameraHUD?: boolean
    onPresetChange?: (index: number, preset: CameraPreset) => void
    waitingMode?: boolean
    waitingPreset?: CameraPreset

    placementOverrides?: PlacementOverrides
    placementAliases?: Record<number, number>
    editPlacement?: EditPlacement
    onPlace?: (tileIndex: number, slot: number, x: number, z: number) => void
}

const TOKEN_COLORS = ['#ef4444', '#22c55e', '#3b82f6', '#eab308', '#a855f7', '#ec4899', '#14b8a6', '#f97316', '#0ea5e9', '#64748b']
const colorFor = (i: number) => TOKEN_COLORS[i % TOKEN_COLORS.length]

/* ---------------- Board geometry ---------------- */
function BoardBody({ size = 10, thickness = 0.25, color = '#000000' }: { size?: number; thickness?: number; color?: string }) {
    return (
        <mesh position={[0, -thickness / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[size, thickness, size]} />
            <meshStandardMaterial color={color} roughness={0.6} metalness={0.0} />
        </mesh>
    )
}
function BoardRim({ size = 10, innerSize = 9.88, height = 0.04, color = '#000', y = 0.006 }:
    { size?: number; innerSize?: number; height?: number; color?: string; y?: number }) {
    const outer = new THREE.Shape()
    const half = size / 2
    outer.moveTo(-half, -half); outer.lineTo(half, -half); outer.lineTo(half, half); outer.lineTo(-half, half); outer.lineTo(-half, -half)
    const hole = new THREE.Path()
    const innerHalf = innerSize / 2
    hole.moveTo(-innerHalf, -innerHalf); hole.lineTo(innerHalf, -innerHalf); hole.lineTo(innerHalf, innerHalf); hole.lineTo(-innerHalf, innerHalf); hole.lineTo(-innerHalf, -innerHalf)
    outer.holes.push(hole)
    const geom = new THREE.ExtrudeGeometry(outer, { depth: height, bevelEnabled: false, steps: 1 })
    geom.rotateX(-Math.PI / 2)
    return (
        <mesh geometry={geom} position={[0, y, 0]} castShadow receiveShadow>
            <meshStandardMaterial color={color} roughness={0.6} metalness={0.0} />
        </mesh>
    )
}

/** Textured top plane that receives clicks and exposes e.point */
function ClickableBoardPlane({
    size, url, y, onClick,
}: { size: number; url: string; y: number; onClick: (e: ThreeEvent<MouseEvent>) => void }) {
    const texture = useLoader(THREE.TextureLoader, url)
    const { gl } = useThree()
    const maxAniso = gl.capabilities.getMaxAnisotropy()
    texture.anisotropy = Math.max(8, maxAniso)
    texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.magFilter = THREE.LinearFilter
    return (
        <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, y, 0]}
            receiveShadow
            onPointerDown={onClick}
        >
            <planeGeometry args={[size, size]} />
            <meshStandardMaterial map={texture} roughness={0.9} metalness={0.0} />
        </mesh>
    )
}

/* ---------------- Tokens ---------------- */
function SphereToken({ name, color, position, showLabel }: {
    name: string; color: string; position: [number, number, number]; showLabel?: boolean
}) {
    return (
        <group position={position}>
            <mesh castShadow>
                <sphereGeometry args={[0.18, 24, 24]} />
                <meshStandardMaterial color={color} metalness={0.05} roughness={0.6} />
            </mesh>
            {showLabel && (
                <Html center distanceFactor={12}>
                    <div style={{ background: 'rgba(0,0,0,0.6)', color: 'white', padding: '2px 6px', fontSize: 12, borderRadius: 6, whiteSpace: 'nowrap' }}>{name}</div>
                </Html>
            )}
        </group>
    )
}
function STLToken({ name, cfg, position, showLabel }: {
    name: string; cfg: TokenModel; position: [number, number, number]; showLabel?: boolean
}) {
    const geom = useLoader(STLLoader, cfg.url) as THREE.BufferGeometry
    const geometry = geom.clone()
    geometry.computeVertexNormals()
    geometry.center()
    const rot = cfg.rotation ?? [-Math.PI / 2, 0, 0]
    const scale = cfg.scale ?? 1
    const color = cfg.color ?? '#c0c8d0'
    return (
        <group position={[position[0], cfg.y ?? position[1], position[2]]} rotation={rot} scale={scale}>
            <mesh geometry={geometry} castShadow receiveShadow>
                <meshStandardMaterial color={color} metalness={0.1} roughness={0.6} />
            </mesh>
            {showLabel && (
                <Html center distanceFactor={12}>
                    <div style={{ background: 'rgba(0,0,0,0.6)', color: 'white', padding: '2px 6px', fontSize: 12, borderRadius: 6, whiteSpace: 'nowrap' }}>{name}</div>
                </Html>
            )}
        </group>
    )
}

/* ---------------- Tile mapping & slots ---------------- */
type Edge = 'bottom' | 'left' | 'top' | 'right' | 'corner'
function baseTileForIndex(idx: number, dir: PathDirection): { row: number; col: number; edge: Edge } {
    const i = dir === 'clockwise' ? idx : ((40 - idx) % 40)
    if (i >= 1 && i <= 9) return { row: 11, col: 11 - i, edge: 'bottom' }
    if (i >= 11 && i <= 19) return { row: 22 - i, col: 1, edge: 'left' }
    if (i >= 21 && i <= 29) return { row: 1, col: i - 19, edge: 'top' }
    if (i >= 31 && i <= 39) return { row: i - 29, col: 11, edge: 'right' }
    switch (i) {
        case 0: return { row: 11, col: 11, edge: 'corner' }
        case 10: return { row: 11, col: 1, edge: 'corner' }
        case 20: return { row: 1, col: 1, edge: 'corner' }
        case 30: return { row: 1, col: 11, edge: 'corner' }
    }
    return { row: 6, col: 6, edge: 'corner' }
}
function rotateRowCol(row: number, col: number, rot: 0 | 90 | 180 | 270) {
    const cx = 6, cy = 6
    const x = col - cx, y = row - cy
    let xr = x, yr = y
    if (rot === 90) { xr = -y; yr = x }
    if (rot === 180) { xr = -x; yr = -y }
    if (rot === 270) { xr = y; yr = -x }
    return { row: cy + yr, col: cx + xr }
}
function positionFor(index: number, slot: number, S: number, dir: PathDirection, rot: 0 | 90 | 180 | 270): [number, number] {
    const step = S / 11
    const sideDepth = step * 0.62
    const cornerInner = step * 0.92
    const colorBand = step * 0.24
    let { row, col, edge } = baseTileForIndex(index, dir)
        ; ({ row, col } = rotateRowCol(row, col, rot))
    let x = (col - 6) * step
    let z = (6 - row) * step
    let cx = x, cz = z, w = step, d = sideDepth
    if (edge === 'corner') { cx = x; cz = z; w = cornerInner; d = cornerInner }
    else {
        const inward = colorBand + sideDepth / 2
        if (edge === 'bottom') cz += inward
        if (edge === 'top') cz -= inward
        if (edge === 'left') cx += inward
        if (edge === 'right') cx -= inward
        w = step * 0.92; d = sideDepth
    }
    const grid: Array<[number, number]> = [
        [-3 / 8, 3 / 8], [-1 / 8, 3 / 8], [1 / 8, 3 / 8], [3 / 8, 3 / 8],
        [-3 / 8, -3 / 8], [-1 / 8, -3 / 8], [1 / 8, -3 / 8], [3 / 8, -3 / 8],
    ]
    const [u, v] = grid[slot % 8]
    let lx = 0, lz = 0
    if (edge === 'corner') { lx = u * w; lz = v * d }
    else if (edge === 'bottom') { lx = u * w; lz = v * d }
    else if (edge === 'top') { lx = u * w; lz = -v * d }
    else if (edge === 'left') { lx = v * d; lz = -u * w }
    else if (edge === 'right') { lx = -v * d; lz = u * w }
    return [cx + lx, cz + lz]
}
function detectTileIndex(x: number, z: number, S: number, _dir: PathDirection, rot: 0 | 90 | 180 | 270): number | null {
    const step = S / 11
    let col = Math.round(x / step + 6)
    let row = Math.round(6 - z / step)
    const unrot = (() => {
        const cx = 6, cy = 6
        const X = col - cx, Y = row - cy
        let xr = X, yr = Y
        if (rot === 90) { xr = Y; yr = -X }
        if (rot === 180) { xr = -X; yr = -Y }
        if (rot === 270) { xr = -Y; yr = X }
        return { row: cy + yr, col: cx + xr }
    })()
    row = unrot.row; col = unrot.col
    if (row === 11 && col === 11) return 0
    if (row === 11 && col === 1) return 10
    if (row === 1 && col === 1) return 20
    if (row === 1 && col === 11) return 30
    if (row === 11 && col >= 2 && col <= 10) return 11 - col
    if (col === 1 && row >= 2 && row <= 10) return 22 - row
    if (row === 1 && col >= 2 && col <= 10) return col + 19
    if (col === 11 && row >= 2 && row <= 10) return row + 29
    return null
}

/* ---------------- Camera rig ---------------- */
function CameraRig({ preset, lerp = 0.08, instant = false, targetOutRef }: {
    preset: CameraPreset; lerp?: number; instant?: boolean; targetOutRef?: React.MutableRefObject<THREE.Vector3>
}) {
    const { camera } = useThree()
    const internalTarget = useRef(new THREE.Vector3(...preset.target))
    const desiredPos = useRef(new THREE.Vector3(...preset.pos))
    const desiredFov = useRef(preset.fov ?? camera.fov)
    useEffect(() => {
        desiredPos.current.set(...preset.pos)
        internalTarget.current.set(...preset.target)
        desiredFov.current = preset.fov ?? camera.fov
        if (targetOutRef) targetOutRef.current.copy(internalTarget.current)
        if (instant) {
            camera.position.set(...preset.pos)
            camera.fov = desiredFov.current
            camera.updateProjectionMatrix()
            camera.lookAt(internalTarget.current)
        }
    }, [preset, camera.fov, instant, camera, targetOutRef])
    useFrame(() => {
        if (instant) return
        camera.position.lerp(desiredPos.current, lerp)
        camera.fov += (desiredFov.current - camera.fov) * lerp
        camera.updateProjectionMatrix()
        camera.lookAt(internalTarget.current)
    })
    return null
}

/* ---------------- Main ---------------- */
function Board3D({
    players = {},
    worldSize = 10,
    indexRotation = 0,
    pathDirection = 'clockwise',
    displayOffset = 0,

    lighting,
    models = {},
    boardImageUrl = '/board.png',
    showLabels = true,
    showFallbackSpheres = true,

    boardThickness = 0.25,
    boardBodyColor = '#000000',
    outfill = 0.06,
    rimHeight = 0.04,
    rimColor = '#000',

    presets,
    presetIndex = 0,
    cameraLerp = 0.08,
    devCameraHUD = false,
    onPresetChange,
    waitingMode = false,
    waitingPreset = { pos: [0, 12, 0], target: [0, 0, 0], fov: 30 },

    placementOverrides,
    placementAliases = { 30: 10 }, // default: Go To Jail uses Jail’s placements
    editPlacement,
    onPlace,
}: Props) {
    const plist = useMemo(() => Object.values(players || {}), [players])

    const L = {
        ambient: lighting?.ambient ?? 0.3,
        hemi: lighting?.hemi ?? 0.2,
        key: lighting?.key ?? 0.85,
        fill: lighting?.fill ?? 0.4,
        exposure: lighting?.exposure ?? 1.0,
        background: lighting?.background ?? '#e9edf0',
    }

    const inset = Math.max(0, Math.min(outfill, worldSize / 2 - 0.001))
    const topSize = Math.max(0.001, worldSize - 2 * inset)

    const defaultPresets: CameraPreset[] = [
        { pos: [8.5, 8.5, 8.5], target: [0, 0, 0], fov: 56 },
        { pos: [0.0, 8.5, 8.5], target: [0, 0, 0], fov: 56 },
        { pos: [-8.5, 8.5, 0.0], target: [0, 0, 0], fov: 56 },
        { pos: [0.0, 8.5, -8.5], target: [0, 0, 0], fov: 56 },
    ]
    const allPresets = presets && presets.length ? presets : defaultPresets
    const safeIndex = (presetIndex % allPresets.length + allPresets.length) % allPresets.length
    const fromPropsPreset = allPresets[safeIndex]
    const activePreset = waitingMode ? waitingPreset : fromPropsPreset
    const instant = waitingMode
    const targetRef = useRef(new THREE.Vector3(...activePreset.target))

    function handlePlaneClick(e: ThreeEvent<MouseEvent>) {
        if (!editPlacement?.enabled) return
        e.stopPropagation()
        const x = e.point.x
        const z = e.point.z
        const autoTile = detectTileIndex(x, z, worldSize, pathDirection, indexRotation)
        const tileIndex = editPlacement.tileIndex ?? autoTile
        if (tileIndex == null) return
        const slot = editPlacement.slot ?? 0
        onPlace?.(tileIndex, slot, x, z)
    }

    return (
        <div style={{ width: '100%', maxWidth: 1000, height: 720 }}>
            <Canvas
                camera={{ fov: activePreset.fov ?? 56, position: activePreset.pos }}
                shadows
                dpr={[1, 2]}
                gl={{ antialias: true, powerPreference: 'high-performance' }}
                onCreated={({ gl }) => {
                    gl.toneMapping = THREE.NoToneMapping
                    gl.toneMappingExposure = L.exposure
                }}
            >
                <CameraRig preset={activePreset} lerp={cameraLerp} instant={instant} targetOutRef={targetRef} />

                {/* Lights */}
                <color attach="background" args={[L.background]} />
                <ambientLight intensity={L.ambient} />
                <hemisphereLight skyColor="#ffffff" groundColor="#cfd8dc" intensity={L.hemi} />
                <directionalLight position={[6, 10, 6]} intensity={L.key} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
                <directionalLight position={[-6, 8, -6]} intensity={L.fill} />

                {/* Board */}
                <BoardBody size={worldSize} thickness={boardThickness} color={boardBodyColor} />
                <BoardRim size={worldSize} innerSize={topSize} height={rimHeight} color={rimColor} y={0.006} />
                <Suspense fallback={null}>
                    <ClickableBoardPlane
                        size={topSize}
                        url={boardImageUrl || '/board.png'}
                        y={0.002}
                        onClick={handlePlaneClick}
                    />
                </Suspense>

                {/* Tokens */}
                {plist.map((p, i) => {
                    const tileIndex = (p.position + (displayOffset % 40) + 40) % 40
                    const slot = i % 8
                    const sourceIndex = placementAliases?.[tileIndex] ?? tileIndex
                    const ov = placementOverrides?.[sourceIndex]?.[slot]
                    const [x, z] = ov
                        ? ov
                        : positionFor(tileIndex, slot, worldSize, pathDirection, indexRotation)
                    const y = 0.14
                    const cfg = models[p.id]
                    if (cfg?.url) {
                        const fallback = showFallbackSpheres
                            ? <SphereToken name={p.name} color={colorFor(i)} position={[x, y, z]} showLabel={showLabels} />
                            : null
                        return (
                            <Suspense key={p.id} fallback={fallback}>
                                <STLToken name={p.name} cfg={cfg} position={[x, y, z]} showLabel={showLabels} />
                            </Suspense>
                        )
                    }
                    return showFallbackSpheres
                        ? <SphereToken key={p.id} name={p.name} color={colorFor(i)} position={[x, y, z]} showLabel={showLabels} />
                        : <group key={p.id} />
                })}

                {/* Visualize overrides */}
                {placementOverrides && Object.entries(placementOverrides).map(([ti, arr]) =>
                    (arr || []).map((pt, si) => pt && (
                        <mesh key={`m-${ti}-${si}`} position={[pt[0], 0.06, pt[1]]}>
                            <boxGeometry args={[0.06, 0.06, 0.06]} />
                            <meshStandardMaterial color="#111827" />
                        </mesh>
                    ))
                )}
            </Canvas>
        </div>
    )
}

export default memo(Board3D)
export type { PlacementOverrides }
