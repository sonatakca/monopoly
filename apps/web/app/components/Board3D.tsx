'use client'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { Html, OrbitControls, useTexture } from '@react-three/drei'
import PropertyCard3D from './PropertyCard3D'
import PlayersStrip from './PlayersStrip'
import PropertyCardModal3D from './PropertyCardModal3D'
import { ensureDevFlagsAPI, getDevFlag } from '../components/dev/devFlags'
import board from '@shared/board.tr.json'
import { Suspense, memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import bakedTileZonesRaw from '../../public/baked-in-content/tile-zones.json'
import bakedTokenZonesRaw from '../../public/baked-in-content/token-zones.json'

import type { Player } from '@shared/types'
import { DEFAULT_TOKEN_GAPS_Y, DEFAULT_TOKEN_SCALES } from '@shared/tokens'
import { DEFAULT_TOKEN_ROTATION } from '@shared/tokenRotation'
import HopAnimator, { type HopStep } from './HopAnimator'
import bakedHouseZonesRaw from '../../public/baked-in-content/house-hotel-zones.json';
import BuyHouseIcon from './icons/BuyHouseIcon.svg';
import SellHouseIcon from './icons/SellHouseIcon.svg';
import BuyHotelIcon from './icons/BuyHotelIcon.svg';
import SellHotelIcon from './icons/SellHotelIcon.svg';
import Tippy from '@tippyjs/react'
import 'tippy.js/dist/tippy.css';
import { followCursor } from 'tippy.js';
import { TbCards } from "react-icons/tb";
import MortgageIcon from './icons/MortgageIcon.png';


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
    /** If provided, the model will be uniformly scaled so its largest dimension equals this value (in scene units). */
    fitSize?: number
    /** Optional per-token vertical offset (adds on top of y). */
    offsetY?: number
}
export type CameraPreset = { pos: [number, number, number]; target: [number, number, number]; fov?: number }
type PathDirection = 'clockwise' | 'counterclockwise'
export type PlacementOverrides = { [tileIndex: number]: Array<[number, number] | null> }
// --- Dev: HOUSE ZONES (4 slots per property tile) ---------------------------------
type HouseZoneSlotTx = {
    dx?: number;
    dz?: number;
};

type HouseZoneHotelTx = {
    dx?: number;
    dz?: number;
};

type HouseZoneTx = {
    dx?: number;      // shift center (world units)
    dz?: number;
    wScale?: number;  // width multiplier
    dScale?: number;  // depth/length multiplier
    rot?: number;     // rotates the 4-slot layout (radians, applied to rects)
    modelYaw?: number; // extra yaw you can apply to house/hotel STL when rendering
    slots?: Record<string, HouseZoneSlotTx>; // Per-slot offsets
    houseCount?: number;
    hotel?: HouseZoneHotelTx;
};

type HouseZonesMap = Record<string, HouseZoneTx>;

const HOUSE_ZONES_LS = 'monopoly.dev.houseZones';

// Only these tiles show house editor overlay
const HOUSE_TILES = new Set<number>([1, 3, 6, 8, 9, 11, 13, 14, 16, 18, 19, 21, 23, 24, 26, 27, 29, 31, 32, 34, 37, 39]);

const BAKED_HOUSE_ZONES: HouseZonesMap = (() => {
    const map: HouseZonesMap = {};
    try {
        if (Array.isArray(bakedHouseZonesRaw)) {
            for (const entry of bakedHouseZonesRaw) {
                if (entry && typeof entry.tile === 'number') {
                    map[String(entry.tile)] = entry.tx || {};
                }
            }
        }
    } catch { }
    return map;
})();

function readHouseZones(): HouseZonesMap {
    try {
        const raw = typeof window !== 'undefined' ? localStorage.getItem(HOUSE_ZONES_LS) : null;
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Object.keys(parsed).length > 0) {
                return parsed;
            }
        }
    } catch { }
    return BAKED_HOUSE_ZONES;
}
function writeHouseZones(m: HouseZonesMap) {
    try { if (typeof window !== 'undefined') localStorage.setItem(HOUSE_ZONES_LS, JSON.stringify(m)); } catch { }
}

const HOUSE_INDEX_PHASE = -10; // quarter-turn backward

function propertyRectForHouse(index: number, S: number, dir: PathDirection, rot: 0 | 90 | 180 | 270) {
    const physIndex = (index + HOUSE_INDEX_PHASE + 40) % 40;
    return propertyRectFor(physIndex, S, dir, rot);
}

// Exportable helper if you want to use yaw elsewhere
export function getHouseModelYaw(tile: number): number {
    const m = readHouseZones();
    const yaw = m[String(tile)]?.modelYaw || 0;
    return +yaw || 0;
}

type Props = {
    players?: Record<string, Player>
    order?: string[]
    worldSize?: number
    indexRotation?: 0 | 90 | 180 | 270
    pathDirection?: PathDirection
    displayOffset?: number
    /** Base vertical offset for tokens above the board surface. */
    tokenBaseY?: number

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
    waitingMode?: boolean
    waitingPreset?: CameraPreset

    placementOverrides?: PlacementOverrides
    placementAliases?: Record<number, number>

    tokenGapsY?: Record<string, number>
    children?: ReactNode
    overlayChildren?: ReactNode

    onTokenRouteStart?: (playerId: string) => void
    onTokenRouteComplete?: ((info: { playerId: string; tileIndex: number }) => void) | ((playerId: string) => void)
    routeCompleteDelayMs?: number
    /** Optional: wait before starting a route (e.g., show dice result) */
    routeStartDelayMs?: number
    /** Optional: invoked by the jail cinematic after fade-out to actually move the player to jail (10). */
    onGoToJail?: (playerId: string) => void
    /** Current player's id for HUD highlighting */
    currentPlayerId?: string
    /** Reset key for current player's activity timer */
    activityKey?: number | string
    /** Reports player card DOM rects so overlays can target them */
    onCardRectsChange?: (map: Record<string, DOMRect>) => void
    /** Whether to show HUD overlays (players strip etc.) */
    showHud?: boolean
    /** Fullscreen state to scale HUD elements appropriately */
    isFullscreen?: boolean
    onToggleFullscreen?: () => void;
    onInitiateTrade?: (playerId: string) => void;
    onOpenTradeModal?: () => void;
    tradeActive?: boolean;
    tradePlayerIds?: (string | null)[];
    onBuyHouse?: () => void;
    onSellHouse?: () => void;
    onBuyHotel?: () => void;
    onSellHotel?: () => void;
    onMortgage?: () => void;
    onOptions?: () => void;
}

const TOKEN_COLORS = ['#ef4444', '#22c55e', '#3b82f6', '#eab308', '#a855f7', '#ec4899', '#14b8a6', '#f97316']

const HouseModel = ({ color = '#22c55e', ...props }) => {
    // The path must be relative to the `public` directory.
    const geom = useLoader(STLLoader, '/models/Property Types/House.stl');

    const processedGeom = useMemo(() => {
        const g = geom.clone();
        g.computeVertexNormals();
        g.computeBoundingBox();
        const bb = g.boundingBox as THREE.Box3;

        // Center the model and set its base to y=0
        g.translate(
            -(bb.min.x + bb.max.x) / 2,
            -bb.min.y,
            -(bb.min.z + bb.max.z) / 2
        );
        return g;
    }, [geom]);

    return (
        <group {...props}>
            <mesh
                geometry={processedGeom}
                // ⬇️ ADD THIS LINE TO LAY THE MODEL FLAT ⬇️
                rotation={[-Math.PI / 2, 0, 0]}
                castShadow
                receiveShadow
            >
                <meshStandardMaterial color={color} roughness={0.5} metalness={0.1} />
            </mesh>
        </group>
    );
};

const HotelModel = ({ color = '#ef4444', ...props }) => {
    const geom = useLoader(STLLoader, '/models/Property Types/Hotel.stl');
    const processedGeom = useMemo(() => {
        const g = geom.clone();
        g.computeVertexNormals();
        g.computeBoundingBox();
        const bb = g.boundingBox as THREE.Box3;
        g.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
        return g;
    }, [geom]);

    return (
        <group {...props}>
            <mesh geometry={processedGeom} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
                <meshStandardMaterial color={color} roughness={0.5} metalness={0.1} />
            </mesh>
        </group>
    );
};

// Extract a stable token name key from its URL, e.g. 
// "/models/Player Tokens/Cat.stl" -> "CAT"
function nameKeyFromUrl(url?: string): string | null {
    if (!url) return null
    try {
        const file = url.split(/[\\/]/).pop() || ''
        const base = file.replace(/\.[^.]+$/, '') // drop extension
        const cleaned = base.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '')
        if (!cleaned) return null
        return cleaned.toUpperCase()
    } catch { return null }
}

// Read per-token Y gap from runtime settings/localStorage using keys like "CAT_Y"
function tokenGapYFor(nameKey: string | null): number {
    if (!nameKey) return 0
    const k = `${nameKey}_Y`
    try {
        const w: any = typeof window !== 'undefined' ? (window as any) : null
        const runtime = w?.MonopolySettings?.tokenY
        if (runtime && typeof runtime[nameKey] === 'number') return runtime[nameKey]
        const raw = typeof window !== 'undefined' ? window.localStorage.getItem(`monopoly.tokenY.${nameKey}`) : null
        if (raw != null) {
            const v = parseFloat(raw)
            if (Number.isFinite(v)) return v
        }
    } catch { }
    return 0
}

// Expose a small runtime API to tweak token gaps at runtime:
//   window.MonopolySettings.setTokenY('CAT', 0.02)
// Values persist to localStorage (per browser) as "monopoly.tokenY.CAT"
function ensureRuntimeTokenYAPI() {
    if (typeof window === 'undefined') return
    const w: any = window as any
    w.MonopolySettings = w.MonopolySettings || {}
    if (!w.MonopolySettings.tokenY) w.MonopolySettings.tokenY = {}
    if (!w.MonopolySettings.setTokenY) {
        w.MonopolySettings.setTokenY = (nameKey: string, value: number) => {
            if (!nameKey || typeof value !== 'number' || !Number.isFinite(value)) return
            try { window.localStorage.setItem(`monopoly.tokenY.${nameKey}`, String(value)) } catch { }
            w.MonopolySettings.tokenY[nameKey] = value
        }
    }
}

// --- Dev placement tools ------------------------------------------------------
type DevPlacementState = {
    enabled: boolean
    tileIndex: number | null
    zone: '' | 'v' | 'j' // for tile 10: 'v' (visitor, 6 pts) or 'j' (jail, 4 pts)
    slot: number
    lastAutoTile: number | null
    areas: Record<string, [[number, number], [number, number], [number, number], [number, number]]>
}

const PL_SAVE_KEY = 'monopoly.dev.placements'
const PL_ENABLE_KEY = 'monopoly.dev.placements.enabled'

function ensureDevPlacementAPI(stateRef: React.MutableRefObject<DevPlacementState>, saveRef: React.MutableRefObject<(tile: number, slot: number, x: number, z: number) => void>) {
    if (typeof window === 'undefined') return
    const w: any = window as any
    w.MonopolyDev = w.MonopolyDev || {}
    w.MonopolyDev.placement = w.MonopolyDev.placement || {}
    w.MonopolyDev.placement.enable = (v: boolean) => {
        stateRef.current.enabled = !!v
        try { localStorage.setItem(PL_ENABLE_KEY, v ? '1' : '0') } catch { }
    }
    w.MonopolyDev.placement.setTile = (i: number | null) => { stateRef.current.tileIndex = (i == null ? null : Math.max(0, Math.min(39, Math.floor(i)))) }
    w.MonopolyDev.placement.setZone = (z: '' | 'v' | 'j') => { stateRef.current.zone = (z === 'v' || z === 'j') ? z : '' }
    w.MonopolyDev.placement.setSlot = (i: number) => { stateRef.current.slot = Math.max(0, Math.min(7, Math.floor(i))) }
    w.MonopolyDev.placement.clear = () => { try { localStorage.removeItem(PL_SAVE_KEY) } catch { } }
    w.MonopolyDev.placement.export = () => {
        try { const s = localStorage.getItem(PL_SAVE_KEY); console.log('[Dev] placements JSON:', s || '{}'); return s } catch { return '{}' }
    }
    w.MonopolyDev.placement.setAreaCorners = (tile: number, corners: [[number, number], [number, number], [number, number], [number, number]]) => {
        stateRef.current.areas[String(tile)] = corners
    }
    w.MonopolyDev.placement.setAreaCornersKey = (key: string, corners: [[number, number], [number, number], [number, number], [number, number]]) => {
        stateRef.current.areas[key] = corners
    }
    w.MonopolyDev.placement.generateSlots = (tile: number) => {
        const zone = stateRef.current.zone
        const k = (tile === 10 && zone) ? `${tile}${zone}` : String(tile)
        const corners = stateRef.current.areas[k]
        if (!corners) { console.warn('[Dev] No corners set for tile', tile); return }
        const count = (tile === 10 && zone === 'v') ? 6 : (tile === 10 && zone === 'j') ? 4 : 4
        const pts = generateGridPoints(corners, count)
        pts.forEach((p, i) => { saveRef.current(tile, i, p[0], p[1]) })
        console.log('[Dev] Generated', count, 'points for key', k)
    }
    w.MonopolyDev.placement.generateSlotsKey = (key: string) => {
        const corners = stateRef.current.areas[key]
        if (!corners) { console.warn('[Dev] No corners set for key', key); return }
        const count = key === '10v' ? 6 : key === '10j' ? 4 : 4
        const pts = generateGridPoints(corners, count)
        const tile = Number(String(key).replace(/[^0-9]/g, '')) || 0
        pts.forEach((p, i) => { saveRef.current(tile, i, p[0], p[1]) })
        console.log('[Dev] Generated', count, 'points for key', key)
    }
    w.MonopolyDev.placement.resetAuto = () => {
        const s = stateRef.current
        s.tileIndex = null
        s.lastAutoTile = 0
        s.zone = ''
        s.slot = 0
        console.log('[Dev] Auto placement sequence reset')
    }
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t }
function generateGridPoints(corners: [[number, number], [number, number], [number, number], [number, number]], count: number): [number, number][] {
    // corners order: [topLeft, topRight, bottomRight, bottomLeft] in board plane space
    const [tl, tr, br, bl] = corners
    // Build parametric bilinear interpolation across the quad
    function point(u: number, v: number): [number, number] {
        const xTop = lerp(tl[0], tr[0], u), zTop = lerp(tl[1], tr[1], u)
        const xBot = lerp(bl[0], br[0], u), zBot = lerp(bl[1], br[1], u)
        return [lerp(xTop, xBot, v), lerp(zTop, zBot, v)]
    }
    if (count === 4) {
        return [point(0.25, 0.25), point(0.75, 0.25), point(0.25, 0.75), point(0.75, 0.75)]
    }
    if (count === 6) {
        return [point(1 / 3, 0.25), point(2 / 3, 0.25), point(1 / 3, 0.5), point(2 / 3, 0.5), point(1 / 3, 0.75), point(2 / 3, 0.75)]
    }
    // fallback single center
    return [point(0.5, 0.5)]
}

function tileIndexFromPosition(x: number, z: number, S: number, dir: PathDirection, rot: 0 | 90 | 180 | 270): number {
    // Transform by inverse board rotation so grid mapping matches base orientation
    // Use forward board rotation to undo scene orientation (previous sign was wrong)
    const rad = (rot * Math.PI) / 180
    const cos = Math.cos(rad), sin = Math.sin(rad)
    const xr = x * cos - z * sin
    const zr = x * sin + z * cos
    const step = S / 11
    // coordinates to 0..11 grid (origin at center)
    const colF = xr / step + 6
    const rowF = 6 - zr / step
    const row = Math.round(rowF)
    const col = Math.round(colF)
    // corners
    if (row <= 1 && col <= 1) return dir === 'clockwise' ? 20 : 20
    if (row >= 11 && col >= 11) return 0
    if (row >= 11 && col <= 1) return 10
    if (row <= 1 && col >= 11) return 30
    // edges
    if (row >= 10 && col >= 2 && col <= 10) { // bottom edge ids 1..9
        const k = 11 - col
        return dir === 'clockwise' ? k : (40 - k) % 40
    }
    if (col <= 2 && row >= 2 && row <= 10) { // left edge 11..19
        const k = 10 + (11 - row)
        return dir === 'clockwise' ? k : (40 - k) % 40
    }
    if (row <= 2 && col >= 2 && col <= 10) { // top edge 21..29
        const k = 20 + (col - 1)
        return dir === 'clockwise' ? k : (40 - k) % 40
    }
    if (col >= 10 && row >= 2 && row <= 10) { // right edge 31..39
        const k = 30 + (row - 1)
        return dir === 'clockwise' ? k : (40 - k) % 40
    }
    return 0
}
// Dev-only: expose camera save/load helpers via window.MonopolyDev
function DevCameraAPI({ controlsRef, setFollowPreset }: { controlsRef: React.RefObject<any>; setFollowPreset: (v: boolean) => void }) {
    const camera = useThree((s) => s.camera as THREE.PerspectiveCamera)
    useEffect(() => {
        if (typeof window === 'undefined') return
        ensureDevFlagsAPI()
        const w: any = window as any
        w.MonopolyDev = w.MonopolyDev || {}
        w.MonopolyDev.saveCamera = () => {
            try {
                const tgt = controlsRef.current?.target
                const data = {
                    pos: [camera.position.x, camera.position.y, camera.position.z] as [number, number, number],
                    target: tgt ? [tgt.x, tgt.y, tgt.z] as [number, number, number] : [0, 0, 0] as [number, number, number],
                    fov: camera.fov,
                }
                localStorage.setItem('monopoly.dev.camera', JSON.stringify(data))
                console.log('[Dev] Camera saved:', data)
            } catch (e) { console.warn('[Dev] saveCamera failed', e) }
        }
        w.MonopolyDev.loadCamera = () => {
            try {
                const raw = localStorage.getItem('monopoly.dev.camera')
                if (!raw) { console.warn('[Dev] No saved camera'); return }
                const data = JSON.parse(raw)
                if (Array.isArray(data.pos) && data.pos.length === 3) camera.position.set(data.pos[0], data.pos[1], data.pos[2])
                if (typeof data.fov === 'number') { camera.fov = data.fov; camera.updateProjectionMatrix() }
                if (controlsRef.current?.target && Array.isArray(data.target) && data.target.length === 3) {
                    controlsRef.current.target.set(data.target[0], data.target[1], data.target[2])
                    controlsRef.current.update?.()
                }
                setFollowPreset(false)
                console.log('[Dev] Camera loaded:', data)
            } catch (e) { console.warn('[Dev] loadCamera failed', e) }
        }
        w.MonopolyDev.clearCamera = () => { try { localStorage.removeItem('monopoly.dev.camera') } catch { } }
        // Provide direct getter for current camera data
        w.MonopolyDev.getCurrentCamData = () => {
            try {
                const tgt = controlsRef.current?.target
                const data = {
                    pos: [camera.position.x, camera.position.y, camera.position.z] as [number, number, number],
                    target: tgt ? [tgt.x, tgt.y, tgt.z] as [number, number, number] : [0, 0, 0] as [number, number, number],
                    fov: camera.fov,
                }
                console.log('[Dev] Current camera:', data)
                return data
            } catch (e) { console.warn('[Dev] getCurrentCamData failed', e); return null }
        }
    }, [camera, controlsRef, setFollowPreset])

    // React to dev flag: getCurrentCamData -> dump current camera JSON and copy to clipboard
    useEffect(() => {
        if (typeof window === 'undefined') return
        const handler = (e: any) => {
            const det = e?.detail || {}
            if (det?.key === 'getCurrentCamData' && det?.val) {
                try {
                    const tgt = controlsRef.current?.target
                    const data = {
                        pos: [camera.position.x, camera.position.y, camera.position.z] as [number, number, number],
                        target: tgt ? [tgt.x, tgt.y, tgt.z] as [number, number, number] : [0, 0, 0] as [number, number, number],
                        fov: camera.fov,
                    }
                    const json = JSON.stringify(data, null, 2)
                    console.log('[Dev] Current camera data:', data, 'JSON:' + json)
                    try { navigator.clipboard?.writeText?.(json) } catch { }
                    // auto-reset the flag to false, so it can be triggered again easily
                    try { (window as any).MonopolyDev?.set?.('getCurrentCamData', false) } catch { }
                } catch (err) { console.warn('[Dev] getCurrentCamData flag handling failed', err) }
            }
        }
        window.addEventListener('monopoly.devflag' as any, handler as any)
        // If the flag is already set at mount, fire once
        try {
            const armed = getDevFlag('getCurrentCamData' as any)
            if (armed) handler({ detail: { key: 'getCurrentCamData', val: true } })
        } catch { }
        return () => window.removeEventListener('monopoly.devflag' as any, handler as any)
    }, [camera, controlsRef])
    return null
}

// (removed FpsInvalidator in favor of Canvas frameloop="always")

/* Board geometry */
function BoardBody({ size = 10, thickness = 0.025, color = '#000000' }: { size?: number; thickness?: number; color?: string }) {
    return (
        <mesh position={[0, -thickness / 2, 0]} receiveShadow>
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

function ClickableBoardPlane({
    size, url, y, ...rest
}: { size: number; url: string; y: number } & any) {
    const texture = useLoader(THREE.TextureLoader, url) as THREE.Texture; // 👈 narrow the type
    useMemo(() => {
        if (texture) {
            texture.colorSpace = THREE.SRGBColorSpace;
        }
    }, [texture]);
    const { gl } = useThree()
    const maxAniso = gl.capabilities.getMaxAnisotropy()
    texture.anisotropy = Math.max(8, maxAniso)
    texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.magFilter = THREE.LinearFilter
    return (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]} receiveShadow {...rest}>
            <planeGeometry args={[size, size]} />
            <meshStandardMaterial map={texture} roughness={0.9} metalness={0.0} />
        </mesh>
    )
}

function TokenMesh({ cfg, position, yaw = 0, alpha = 1 }: { cfg: TokenModel; position: [number, number, number]; yaw?: number; alpha?: number }) {
    const src = useLoader(STLLoader, cfg.url) as THREE.BufferGeometry
    const geometry = useMemo(() => {
        const g = src.clone()
        g.computeVertexNormals()
        g.computeBoundingBox()
        const bb = g.boundingBox as THREE.Box3
        const cx = (bb.min.x + bb.max.x) / 2
        const cz = (bb.min.z + bb.max.z) / 2
        const minY = bb.min.y
        g.translate(-cx, -minY, -cz)
        return g
    }, [src])
    const scale = useMemo(() => {
        const bb = new THREE.Box3().setFromBufferAttribute(geometry.getAttribute('position') as any)
        const size = new THREE.Vector3(); bb.getSize(size)
        let s = cfg.scale ?? 1
        if (cfg.fitSize && Number.isFinite(cfg.fitSize) && Math.max(size.x, size.y, size.z) > 0) {
            const maxDim = Math.max(size.x, size.y, size.z)
            s = (cfg.fitSize as number) / maxDim
        }
        // Apply per-token scale multiplier from defaults (by model name key)
        const nameKey = nameKeyFromUrl(cfg.url)
        const mul = (nameKey && (DEFAULT_TOKEN_SCALES as any)[nameKey]) || 1
        return s * (typeof mul === 'number' ? mul : 1)
    }, [geometry, cfg.scale, cfg.fitSize, cfg.url])
    const color = cfg.color ?? '#c0c8d0'
    const meshRef = useRef<THREE.Mesh>(null)
    useEffect(() => {
        const m = meshRef.current as any
        if (!m) return
        m.raycast = () => null
        // Enable token shadows (cast onto the board) but do not receive
        m.castShadow = true
        m.receiveShadow = false
    }, [])
    const nameKey = useMemo(() => nameKeyFromUrl(cfg.url), [cfg.url])
    const fixedTilt = useMemo<[number, number, number]>(() => {
        if (cfg.rotation) return cfg.rotation
        const r = (nameKey && DEFAULT_TOKEN_ROTATION[nameKey]) || [-Math.PI / 2, 0, 0]
        return r as [number, number, number]
    }, [cfg.rotation, nameKey])
    return (
        <group position={[position[0], position[1], position[2]]} rotation={[0, yaw, 0]} scale={scale}>
            <group rotation={fixedTilt as any}>
                <mesh ref={meshRef} geometry={geometry} castShadow>
                    <meshStandardMaterial color={color} metalness={1.0} roughness={0.45} envMapIntensity={1.80} transparent opacity={Math.max(0, Math.min(1, alpha))} />
                </mesh>
            </group>
        </group>
    )
}

// AnimatedToken: smoothly interpolate a token from its previous world position to a new target
// and add a vertical "hop" arc during the move.
function AnimatedToken({ id, cfg, to, yaw }: { id: string; cfg: TokenModel; to: [number, number, number]; yaw: number }) {
    const meshRef = useRef<{ pos: [number, number, number]; start: number; from: [number, number, number] } | null>(null)
    const [, trigger] = useState(0) // used to force re-render when animation completes

    // Initialize from stored value (persist across renders) or set immediately
    if (!meshRef.current) {
        meshRef.current = { pos: to, start: 0, from: to }
    }

    // When `to` changes, start an animation from previous pos -> to
    useEffect(() => {
        const now = performance.now()
        const cur = meshRef.current!
        // If identical, do nothing
        if (cur.pos[0] === to[0] && cur.pos[1] === to[1] && cur.pos[2] === to[2]) return
        cur.from = cur.pos.slice() as [number, number, number]
        cur.start = now
        // keep pos as current (will be updated in frame)
    }, [to[0], to[1], to[2]])

    useFrame(() => {
        const cur = meshRef.current!
        if (!cur) return
        const now = performance.now()
        // If no active animation, ensure final position
        const duration = 420 // ms
        const elapsed = Math.max(0, now - cur.start)
        const tRaw = Math.min(1, duration <= 0 ? 1 : elapsed / duration)
        // ease-out cubic
        const t = 1 - Math.pow(1 - tRaw, 3)
        const nx = cur.from[0] + (to[0] - cur.from[0]) * t
        const nz = cur.from[2] + (to[2] - cur.from[2]) * t
        // vertical hop: sin(pi * t) curve scaled by hopHeight
        const baseY = to[1]
        const hopHeight = 0.22 // world units; small tasteful hop
        const ny = baseY + Math.sin(Math.PI * t) * hopHeight
        cur.pos = [nx, ny, nz]
        // if animation finished, snap to exact target and trigger a rerender to clear any stale state
        if (tRaw >= 1) {
            cur.pos = [to[0], to[1], to[2]]
            // reset start so next effect can perform correctly
            cur.start = 0
            trigger(s => s + 1)
        }
    })

    const curPos = meshRef.current!.pos
    return <TokenMesh cfg={cfg} position={curPos} yaw={yaw} />
}

type RouteStep = { to: [number, number, number]; yaw: number; style?: 'hop' | 'linear' }

// RouteAnimatedToken moved out — legacy inline component kept for reference (not used)
function RouteAnimatedToken({
    id,
    cfg,
    route,
    initialFrom,
    initialYaw,
    stepMs = 260,
    hopHeight = 0.22,
    onStart,
    onDone,
    onStepStart,
    onStepEnd,
    onProgress,
    startAt,
}: {
    id: string
    cfg: TokenModel
    route: RouteStep[]
    initialFrom: [number, number, number]
    initialYaw: number
    stepMs?: number
    hopHeight?: number
    onStart?: () => void
    onDone?: () => void
    onStepStart?: (index: number) => void
    onStepEnd?: (index: number) => void
    onProgress?: (phase: number, index: number) => void
    startAt: number
}) {
    const posRef = useRef<[number, number, number] | null>(null)
    const yawRef = useRef<number>(0)
    const groupRef = useRef<THREE.Group>(null)
    const routeStartedRef = useRef(false)
    const animRef = useRef<{
        active: boolean
        from: [number, number, number]
        to: [number, number, number]
        yawFrom: number
        yawTo: number
        start: number
        queue: RouteStep[]
        full: RouteStep[]
        style: 'hop' | 'linear'
        startAt: number
        idx: number
    } | null>(null)
    const [, force] = useState(0)
    const totalRef = useRef(0)

    if (posRef.current == null) {
        posRef.current = initialFrom
        yawRef.current = initialYaw
    }

    useEffect(() => {
        const q = [...route]
        totalRef.current = q.length
        if (!animRef.current) {
            animRef.current = {
                active: false,
                from: posRef.current as [number, number, number],
                to: posRef.current as [number, number, number],
                yawFrom: yawRef.current,
                yawTo: yawRef.current,
                start: 0,
                queue: [...q],
                full: [...q],
                style: 'hop',
                startAt: startAt,
                idx: -1,
            }
        } else {
            animRef.current.queue = [...q]
            animRef.current.full = [...q]
            animRef.current.startAt = startAt
            animRef.current.idx = -1
            animRef.current.active = false
        }
        // New incoming route -> clear the "started" flag so onStart can fire once for this route
        routeStartedRef.current = false
    }, [route, startAt])

    useFrame(() => {
        const st = animRef.current
        if (!st) return

        const same = (a: [number, number, number], b: [number, number, number]) =>
            Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6 && Math.abs(a[2] - b[2]) < 1e-6

        if (!st.active) {
            const now = performance.now()
            const total = st.full.length
            if (!total) return
            // If route already fully elapsed, finish immediately
            if (now - st.startAt >= total * stepMs) {
                const last = st.full[total - 1]
                posRef.current = last.to
                yawRef.current = last.yaw
                if (groupRef.current) {
                    groupRef.current.position.set(last.to[0], last.to[1], last.to[2])
                    groupRef.current.rotation.y = last.yaw
                }
                routeStartedRef.current = false
                onDone?.()
                return
            }
            // Determine current step index based on timeline
            let idx = Math.floor((now - st.startAt) / stepMs)
            if (idx < 0) idx = 0
            if (idx >= total) idx = total - 1
            // Trim queue to current step
            const completed = total - st.queue.length
            const needToDrop = idx - completed
            if (needToDrop > 0) {
                for (let k = 0; k < needToDrop; k++) {
                    const dropped = st.queue.shift()
                    if (!dropped) break
                    // Jump position to dropped step end so visual catches up without replay
                    posRef.current = dropped.to
                    yawRef.current = dropped.yaw
                    if (groupRef.current) {
                        groupRef.current.position.set(dropped.to[0], dropped.to[1], dropped.to[2])
                        groupRef.current.rotation.y = dropped.yaw
                    }
                }
            }
            // Start current step
            if (st.queue.length) {
                const next = st.queue.shift()!
                const from = posRef.current as [number, number, number]
                st.from = from
                st.to = next.to
                st.yawFrom = yawRef.current
                st.yawTo = Math.atan2(st.to[0] - st.from[0], st.to[2] - st.from[2])
                // Align start with timeline (so t reflects elapsed-in-step)
                st.start = st.startAt + idx * stepMs
                st.active = true
                st.style = next.style || 'hop'
                st.idx = idx
                if (!routeStartedRef.current) { routeStartedRef.current = true; onStart?.() }
                try { onStepStart?.(idx) } catch { }
            } else {
                return
            }
        }


        const now = performance.now()
        const tRaw = Math.min(1, (now - st.start) / stepMs)
        const t = 1 - Math.pow(1 - tRaw, 3)

        const nx = st.from[0] + (st.to[0] - st.from[0]) * t
        const nz = st.from[2] + (st.to[2] - st.from[2]) * t

        const baseY = st.to[1]
        const distXZ = Math.hypot(st.to[0] - st.from[0], st.to[2] - st.from[2])
        const hop = distXZ < 1e-5 ? 0 : hopHeight // 👈 no vertical bounce if not moving
        const ny = baseY + Math.sin(Math.PI * t) * hop

        const wrap = (a: number) => (a + Math.PI * 3) % (Math.PI * 2) - Math.PI
        const dy = wrap(st.yawTo - st.yawFrom)
        const yaw = wrap(st.yawFrom + dy * t)
        const ny2 = ((animRef.current?.style || 'hop') === 'linear')
            ? (st.from[1] + (st.to[1] - st.from[1]) * t)
            : ny

        // Mutate wrapper group transform each frame so inner mesh stays at origin
        posRef.current = [nx, ny2, nz]
        yawRef.current = yaw
        if (groupRef.current) {
            groupRef.current.position.set(nx, ny2, nz)
            groupRef.current.rotation.y = yaw
        }

        // Report per-hop progress (phase = t) to parent for synchronized visuals
        try {
            const idx = Math.max(0, totalRef.current - st.queue.length - 1)
            onProgress?.(t, idx)
        } catch { }

        if (tRaw >= 1) {
            try { onStepEnd?.(st.idx) } catch { }
            posRef.current = st.to
            yawRef.current = st.yawTo
            if (groupRef.current) {
                groupRef.current.position.set(st.to[0], st.to[1], st.to[2])
                groupRef.current.rotation.y = st.yawTo
            }
            st.active = false
            // If timeline has more steps elapsed already, the next frame will start the right one immediately
            if (!st.queue.length) {
                routeStartedRef.current = false
                onDone?.()
            }
        }
    })

    // Render a stable wrapper group we mutate per-frame. Keep inner mesh at origin.
    return (
        <group ref={groupRef}>
            <TokenMesh cfg={cfg} position={[0, 0, 0]} yaw={0} />
        </group>
    )
}

// Route debugger: small visual markers for start and each step
// RouteDebugger moved out — legacy inline component kept for reference (not used)
function RouteDebugger({
    id,
    start,
    steps,
}: {
    id: string
    start: [number, number, number]
    steps: { to: [number, number, number]; yaw: number }[]
}) {
    const small = 0.035
    return (
        <group name={`RouteDebugger-${id}`}>
            {/* start marker */}
            <mesh position={start}>
                <sphereGeometry args={[small, 10, 10]} />
                <meshBasicMaterial color="#3b82f6" />
            </mesh>

            {/* per-step markers */}
            {steps.map((s, i) => (
                <group key={`${id}-step-${i}`} position={s.to}>
                    <mesh>
                        <sphereGeometry args={[small, 10, 10]} />
                        <meshBasicMaterial color={i === steps.length - 1 ? '#22c55e' : '#ef4444'} />
                    </mesh>
                    <Html center distanceFactor={14}>
                        <div style={{ color: '#fff', fontSize: 10, background: 'rgba(0,0,0,.55)', padding: '1px 4px', borderRadius: 4 }}>
                            {i + 1}
                        </div>
                    </Html>
                </group>
            ))}
        </group>
    )
}


// Removed AnimatedToken (old movement); tokens update via state changes only

/* Position helper (fallback) */
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

// Map internal tile index (0..39, with 0 at GO, clockwise) to display number
// Requested shift: 31 -> 1, 32 -> 2, ..., 30 -> 40
function displayTileNumber(ti: number): number {
    // Requested shift: 11 -> 1, 12 -> 2, ..., 10 -> 40
    const n = (((ti - 11) % 40) + 40) % 40 // wrap to 0..39
    return n + 1 // to 1..40
}

function indicesBetween(prev: number, curr: number, dir: PathDirection): number[] {
    if (prev === curr) return []
    const step = dir === 'clockwise' ? 1 : -1
    const out: number[] = []
    let i = prev
    do {
        i = (i + step + 40) % 40
        out.push(i)
    } while (i !== curr)
    return out
}

function shortestDir(prev: number, curr: number, tieHint: PathDirection = 'clockwise'): PathDirection {
    const fwd = (curr - prev + 40) % 40
    const back = (prev - curr + 40) % 40
    if (fwd === back) return tieHint // exact opposite (20↔0): break tie with your hint
    return fwd < back ? 'clockwise' : 'counterclockwise'
}


function HoverPulse({ x, z, y, sx, sz, trigger, color = '#ffd54f', opacity = 0.25, pulse = true }: {
    x: number; z: number; y: number; sx: number; sz: number; trigger?: any; color?: string; opacity?: number; pulse?: boolean
}) {
    const meshRef = useRef<THREE.Mesh>(null)
    const matRef = useRef<THREE.MeshBasicMaterial>(null)
    useEffect(() => {
        const m = meshRef.current as any
        if (m) m.raycast = () => null
    }, [])
    useEffect(() => {
        if (matRef.current) {
            try { matRef.current.color.set(color) } catch { }
            matRef.current.opacity = (typeof opacity === 'number' ? opacity : 0.25)
        }
    }, [color, opacity, trigger])
    // Continuous color/opacity pulse only - keep width/length fixed
    useFrame(({ clock }) => {
        if (!pulse) return
        const t = clock.getElapsedTime()
        const base = (typeof opacity === 'number' ? opacity : 0.25) * 0.6
        const amp = (typeof opacity === 'number' ? opacity : 0.25) * 0.8
        const speed = 5.0
        const a = base + amp * (0.5 + 0.5 * Math.sin(t * speed))
        if (matRef.current) matRef.current.opacity = a
    })
    return (
        <mesh ref={meshRef} position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
            <planeGeometry args={[sx, sz]} />
            <meshBasicMaterial ref={matRef} color={color} transparent opacity={opacity} depthWrite={false} />
        </mesh>
    )
}

function PhasePulse({ x, z, y, sx, sz, getPhase, color = '#60a5fa', baseOpacity = 0.14, ampOpacity = 0.28 }: {
    x: number; z: number; y: number; sx: number; sz: number;
    getPhase: () => number | undefined;
    color?: string; baseOpacity?: number; ampOpacity?: number
}) {
    const meshRef = useRef<THREE.Mesh>(null)
    const matRef = useRef<THREE.MeshBasicMaterial>(null)
    useEffect(() => {
        const m = meshRef.current as any
        if (m) m.raycast = () => null
    }, [])
    useEffect(() => {
        if (matRef.current) {
            try { matRef.current.color.set(color) } catch { }
            matRef.current.opacity = baseOpacity
        }
    }, [color, baseOpacity])
    useFrame(() => {
        const phase = getPhase() ?? 0
        const amp = Math.max(0, Math.sin(Math.PI * phase))
        const next = baseOpacity + ampOpacity * amp
        if (matRef.current) matRef.current.opacity = Math.min(1, Math.max(0, next))
    })
    return (
        <mesh ref={meshRef} position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
            <planeGeometry args={[sx, sz]} />
            <meshBasicMaterial ref={matRef} color={color} transparent opacity={baseOpacity} depthWrite={false} />
        </mesh>
    )
}

function FlashFade({ x, z, y, sx, sz, getRemaining, color = '#ffffff', maxOpacity = 0.45 }: {
    x: number; z: number; y: number; sx: number; sz: number;
    getRemaining: () => number | undefined;
    color?: string; maxOpacity?: number
}) {
    const meshRef = useRef<THREE.Mesh>(null)
    const matRef = useRef<THREE.MeshBasicMaterial>(null)
    useEffect(() => {
        const m = meshRef.current as any
        if (m) m.raycast = () => null
    }, [])
    useEffect(() => {
        if (matRef.current) {
            try { matRef.current.color.set(color) } catch { }
            matRef.current.opacity = 0
        }
    }, [color])
    useFrame(() => {
        const rem = Math.max(0, Math.min(1, getRemaining() ?? 0))
        // quick ease-out flash
        const eased = rem * rem
        if (matRef.current) matRef.current.opacity = maxOpacity * eased
    })
    return (
        <mesh ref={meshRef} position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
            <planeGeometry args={[sx, sz]} />
            <meshBasicMaterial ref={matRef} color={color} transparent opacity={0} depthWrite={false} />
        </mesh>
    )
}

// --- Dev-tunable band spacing for zones --------------------------------------
type ZoneBand = { outwardScale: number; outwardBias: number; widthScale: number; depthScale: number; rectSwap?: boolean }
const ZONES_LS_KEY = 'monopoly.dev.zones'
const ZONES_DEFAULT: ZoneBand = { outwardScale: 1.0, outwardBias: 0.0, widthScale: 0.92, depthScale: 1.0, rectSwap: false }
function getZoneBand(): ZoneBand {
    try {
        const raw = typeof window !== 'undefined' ? localStorage.getItem(ZONES_LS_KEY) : null
        if (raw) {
            const j = JSON.parse(raw)
            return {
                outwardScale: Number.isFinite(+j.outwardScale) ? +j.outwardScale : ZONES_DEFAULT.outwardScale,
                outwardBias: Number.isFinite(+j.outwardBias) ? +j.outwardBias : ZONES_DEFAULT.outwardBias,
                widthScale: Number.isFinite(+j.widthScale) ? +j.widthScale : ZONES_DEFAULT.widthScale,
                depthScale: Number.isFinite(+j.depthScale) ? +j.depthScale : ZONES_DEFAULT.depthScale,
                rectSwap: !!j.rectSwap,
            }
        }
    } catch { }
    return { ...ZONES_DEFAULT }
}
// Per-tile group transforms (2D offset and yaw), persisted for dev editing
type ZoneTransform = { dx: number; dz: number; rot: number; yaw?: number; spreadW?: number; spreadD?: number; splitW?: number; slots?: Record<string, [number, number] | [number, number, number]> }
const ZONES_TX_KEY = 'monopoly.dev.zones.tx'
const BAKED_TILE_ZONES_RAW: any[] = Array.isArray(bakedTileZonesRaw) ? bakedTileZonesRaw : []
// Baked-in token zone transforms sourced from public/baked-in-content/token-zones.json
const BAKED_ZONES_DUMP: any[] = Array.isArray(bakedTokenZonesRaw) ? bakedTokenZonesRaw : []
const BAKED_ZONE_TRANSFORMS: Record<string, ZoneTransform> = (() => {
    const m: Record<string, ZoneTransform> = {}
    try {
        if (Array.isArray(BAKED_ZONES_DUMP) && BAKED_ZONES_DUMP.length) {
            for (const it of BAKED_ZONES_DUMP) {
                if (!it) continue
                const t = it.transform || {}
                m[String(it.tile)] = {
                    dx: t.dx || 0,
                    dz: t.dz || 0,
                    rot: t.rot || 0,
                    yaw: t.yaw || 0,
                    spreadW: t.spreadW,
                    spreadD: t.spreadD,
                    splitW: t.splitW,
                    slots: t.slots || undefined,
                }
            }
        }
    } catch { }
    return m
})()
function hasDevZonesInStorage(): boolean {
    try {
        if (typeof window === 'undefined') return false
        const raw = localStorage.getItem(ZONES_TX_KEY)
        if (!raw) return false
        const obj = JSON.parse(raw)
        return !!obj && typeof obj === 'object' && Object.keys(obj).length > 0
    } catch { return false }
}
function shouldUseDevZoneJson(): boolean {
    // Prefer runtime/dev JSON when:
    // - explicit flags OR
    // - any dev zones exist in localStorage (so tokens honor saved edits even without flags)
    return (
        getDevFlag('useDevZoneJson') ||
        getDevFlag('tileZones') ||
        getDevFlag('editZones') ||
        getDevFlag('showZones') ||
        hasDevZonesInStorage()
    )
}
function readTxMap(): Record<string, ZoneTransform> {
    try {
        const raw = typeof window !== 'undefined' ? localStorage.getItem(ZONES_TX_KEY) : null
        if (raw) return JSON.parse(raw)
    } catch { }
    return {}
}
function writeTxMap(m: Record<string, ZoneTransform>) {
    try { if (typeof window !== 'undefined') localStorage.setItem(ZONES_TX_KEY, JSON.stringify(m)) } catch { }
}
function getZoneTx(tile: number): ZoneTransform {
    const k = String(tile)
    if (shouldUseDevZoneJson()) {
        const m = readTxMap()
        if (m[k]) return m[k]
    }
    return BAKED_ZONE_TRANSFORMS[k] || { dx: 0, dz: 0, rot: 0, yaw: 0 }
}
function getZoneTxKey(key: string): ZoneTransform {
    const k = String(key)
    if (shouldUseDevZoneJson()) {
        const m = readTxMap()
        if (m[k]) return m[k]
    }
    return BAKED_ZONE_TRANSFORMS[k] || { dx: 0, dz: 0, rot: 0, yaw: 0 }
}

// Decide jail sub-zone tag for tile 10 based on player state
function jailZoneTag(tileIndex: number, player: Player): 'v' | 'j' | undefined {
    return tileIndex === 10 ? (player.inJail ? 'j' : 'v') : undefined
}
function setZoneTx(tile: number, patch: Partial<ZoneTransform>) {
    const m = readTxMap()
    const k = String(tile)
    const cur: ZoneTransform = m[k] || { dx: 0, dz: 0, rot: 0 }
    const mergedSlots = patch.slots ? { ...(cur.slots || {}), ...(patch.slots || {}) } : (cur.slots || undefined)
    const { slots: _omit, ...rest } = (patch as any)
    const next: ZoneTransform = {
        dx: cur.dx, dz: cur.dz, rot: cur.rot,
        spreadW: cur.spreadW, spreadD: cur.spreadD, splitW: cur.splitW,
        slots: mergedSlots,
        ...(rest as any),
    }
    m[k] = next
    writeTxMap(m)
}
function setZoneTxKey(key: string, patch: Partial<ZoneTransform>) {
    const m = readTxMap()
    const k = String(key)
    const cur: ZoneTransform = m[k] || { dx: 0, dz: 0, rot: 0 }
    const mergedSlots = patch.slots ? { ...(cur.slots || {}), ...(patch.slots || {}) } : (cur.slots || undefined)
    const { slots: _omit, ...rest } = (patch as any)
    const next: ZoneTransform = {
        dx: cur.dx, dz: cur.dz, rot: cur.rot,
        spreadW: cur.spreadW, spreadD: cur.spreadD, splitW: cur.splitW,
        slots: mergedSlots,
        ...(rest as any),
    }
    m[k] = next
    writeTxMap(m)
}

function getTxForTile(index: number, zoneTag?: 'v' | 'j'): ZoneTransform {
    if (index === 10 && zoneTag) return getZoneTxKey(`10${zoneTag}`)
    return getZoneTx(index)
}
function ensureDevZonesAPI() {
    if (typeof window === 'undefined') return
    const w: any = window as any
    w.MonopolyDev = w.MonopolyDev || {}
    w.MonopolyDev.zones = w.MonopolyDev.zones || {}
    if (!w.MonopolyDev.zones.set) {
        w.MonopolyDev.zones.set = (cfg: Partial<ZoneBand>) => {
            try {
                const cur = getZoneBand()
                const next: ZoneBand = {
                    outwardScale: typeof cfg.outwardScale === 'number' ? cfg.outwardScale : cur.outwardScale,
                    outwardBias: typeof cfg.outwardBias === 'number' ? cfg.outwardBias : cur.outwardBias,
                    widthScale: typeof cfg.widthScale === 'number' ? cfg.widthScale : cur.widthScale,
                    depthScale: typeof cfg.depthScale === 'number' ? cfg.depthScale : cur.depthScale,
                    rectSwap: typeof cfg.rectSwap === 'boolean' ? cfg.rectSwap : !!cur.rectSwap,
                }
                localStorage.setItem(ZONES_LS_KEY, JSON.stringify(next))
                console.log('[Dev] zones set:', next)
            } catch (e) { console.warn('[Dev] zones.set failed', e) }
        }
    }
    if (!w.MonopolyDev.zones.get) {
        w.MonopolyDev.zones.get = () => {
            try { return getZoneBand() } catch { return { ...ZONES_DEFAULT } }
        }
    }
    if (!w.MonopolyDev.zones.clear) {
        w.MonopolyDev.zones.clear = () => { try { localStorage.removeItem(ZONES_LS_KEY) } catch { } }
    }
    // Per-tile transforms API
    if (!w.MonopolyDev.zones.setTile) {
        w.MonopolyDev.zones.setTile = (tile: number, cfg: Partial<ZoneTransform>) => {
            try { setZoneTx(Math.max(0, Math.min(39, Math.floor(tile))), cfg) } catch (e) { console.warn('[Dev] zones.setTile failed', e) }
        }
    }
    if (!w.MonopolyDev.zones.getTile) {
        w.MonopolyDev.zones.getTile = (tile: number) => { try { return getZoneTx(tile) } catch { return { dx: 0, dz: 0, rot: 0 } } }
    }
    if (!w.MonopolyDev.zones.setKey) {
        w.MonopolyDev.zones.setKey = (key: string, cfg: Partial<ZoneTransform>) => {
            try { setZoneTxKey(String(key), cfg) } catch (e) { console.warn('[Dev] zones.setKey failed', e) }
        }
    }
    if (!w.MonopolyDev.zones.getKey) {
        w.MonopolyDev.zones.getKey = (key: string) => { try { return getZoneTxKey(String(key)) } catch { return { dx: 0, dz: 0, rot: 0 } } }
    }
    if (!w.MonopolyDev.zones.clearTiles) {
        w.MonopolyDev.zones.clearTiles = () => { try { localStorage.removeItem(ZONES_TX_KEY) } catch { } }
    }
    if (!w.MonopolyDev.zones.download) {
        w.MonopolyDev.zones.download = (filename?: string) => {
            try {
                const dump = w.MonopolyDev?.zones?.dump ? w.MonopolyDev.zones.dump() : []
                const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = filename || 'zones-dump.json'
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(url)
                console.log('[Dev] zones dump downloaded')
                return dump
            } catch (e) { console.warn('[Dev] zones.download failed', e) }
        }
    }
    if (!w.MonopolyDev.zones.applyDump) {
        w.MonopolyDev.zones.applyDump = (arr: any) => {
            try {
                if (!Array.isArray(arr)) { console.warn('[Dev] applyDump expects array'); return }
                for (const it of arr) {
                    if (!it) continue
                    const t = it.transform || {}
                    if (typeof it.key === "string" && (it.key === "10v" || it.key === "10j")) { setZoneTxKey(it.key, t) } else if (typeof it.tile === "number") { setZoneTx(it.tile, t) }
                }
                console.log('[Dev] zones applied from dump:', arr.length)
            } catch (e) { console.warn('[Dev] zones.applyDump failed', e) }
        }
    }
    if (!w.MonopolyDev.zones.seedBaked) {
        w.MonopolyDev.zones.seedBaked = () => {
            try {
                const keys = Object.keys(BAKED_ZONE_TRANSFORMS)
                if (!keys.length) { console.warn('[Dev] No baked zones present'); return }
                const m = readTxMap()
                for (const k of keys) m[k] = BAKED_ZONE_TRANSFORMS[k]
                writeTxMap(m)
                console.log('[Dev] seeded baked zone transforms:', keys.length)
            } catch (e) { console.warn('[Dev] seedBaked failed', e) }
        }
    }
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
function positionFor(index: number, slot: number, S: number, dir: PathDirection, rot: 0 | 90 | 180 | 270, zoneTag?: 'v' | 'j'): [number, number] {
    const step = S / 11
    // Approximate radial dimensions for a side tile:
    //  - sideDepth: outer text/icon band (where player tokens should sit)
    //  - colorBand: inner color bar (reserved for houses/hotels)
    //  - cornerInner: inner square for the four corner tiles
    const sideDepth = step * 0.62
    const cornerInner = step * 0.92
    const colorBand = step * 0.24
    let { row, col, edge } = baseTileForIndex(index, dir)
        ; ({ row, col } = rotateRowCol(row, col, rot))
    let x = (col - 6) * step
    let z = (6 - row) * step
    let cx = x, cz = z, w = step, d = sideDepth
    if (edge === 'corner') {
        cx = x; cz = z; w = cornerInner; d = cornerInner
    } else {
        // Position tokens over the OUTER text band, not the inner color bar.
        // Apply dev-tunable band spacing to control distance between tile groups.
        const conf = getZoneBand()
        const outwardBase = (step / 2) - (sideDepth / 2)
        const outward = outwardBase * conf.outwardScale + (conf.outwardBias * step)
        if (edge === 'bottom') cz -= outward
        if (edge === 'top') cz += outward
        if (edge === 'left') cx -= outward
        if (edge === 'right') cx += outward
        w = step * (ZONES_DEFAULT.widthScale * conf.widthScale); d = sideDepth * conf.depthScale
    }
    // 2x4 grid (2 across width, 4 along depth) with a safety shrink so
    // centers never spill into neighboring tiles.
    const ZONE_SCALE_W = 0.90 // shrink across width
    const ZONE_SCALE_D = 0.80 // shrink along depth
    const baseGrid: Array<[number, number]> = [
        [-1 / 4, 3 / 8], [1 / 4, 3 / 8],
        [-1 / 4, 1 / 8], [1 / 4, 1 / 8],
        [-1 / 4, -1 / 8], [1 / 4, -1 / 8],
        [-1 / 4, -3 / 8], [1 / 4, -3 / 8],
    ]
    // Remap zone numbering as requested:
    // current -> new: 6->1, 4->2, 3->3, 5->4, 2->5, 1->6, 8->7, 7->8
    // 0-based: newIdx -> oldIdx
    const slotRemap = [5, 3, 2, 4, 1, 0, 7, 6] as const
    const rem = slotRemap[slot % 8]
    const [uB, vB] = baseGrid[rem]
    const t = getTxForTile(index, zoneTag)
    const spreadW = t?.spreadW ?? 1
    const spreadD = t?.spreadD ?? 1
    const splitW = t?.splitW ?? 0
    // column: 0 = left, 1 = right, derived from remapped index
    const slotCol = (rem % 2)
    const colSign = slotCol === 0 ? -1 : 1
    const u = (uB * ZONE_SCALE_W * spreadW) + colSign * (splitW / 2)
    const v = (vB * ZONE_SCALE_D * spreadD)
    let lx = 0, lz = 0
    if (edge === 'corner') { lx = u * w; lz = v * d }
    else if (edge === 'bottom') { lx = u * w; lz = v * d }
    else if (edge === 'top') { lx = u * w; lz = -v * d }
    else if (edge === 'left') { lx = v * d; lz = -u * w }
    else if (edge === 'right') { lx = -v * d; lz = u * w }
    // Apply per-tile group transform (rotation around tile center + 2D offset)
    if (t && (t.rot || t.dx || t.dz)) {
        const c = Math.cos(t.rot || 0), s = Math.sin(t.rot || 0)
        const rx = lx * c - lz * s
        const rz = lx * s + lz * c
        lx = rx; lz = rz; cx += t.dx || 0; cz += t.dz || 0
    }
    // Apply per-slot world-space offsets
    const slotOff = t?.slots?.[String(slot)]
    if (slotOff) { lx += slotOff[0] || 0; lz += slotOff[1] || 0 }
    return [cx + lx, cz + lz]
}

// Compute yaw (rotation around Y) to face the direction of travel at a tile
function yawToward(index: number, _S: number, dir: PathDirection, rot: 0 | 90 | 180 | 270): number {
    // Determine side by raw clockwise indexing; then map facing by path direction.
    const i = ((index % 40) + 40) % 40
    const isBottom = (i >= 0 && i <= 9)
    const isLeft = (i >= 10 && i <= 19)
    const isTop = (i >= 20 && i <= 29)
    const isRight = (i >= 30 && i <= 39)
    let yaw = 0
    if (dir === 'clockwise') {
        if (isBottom) yaw = -Math.PI / 2     // -X
        else if (isLeft) yaw = Math.PI       // -Z
        else if (isTop) yaw = Math.PI / 2    // +X
        else if (isRight) yaw = 0            // +Z
    } else {
        if (isBottom) yaw = Math.PI / 2      // +X
        else if (isLeft) yaw = 0             // +Z
        else if (isTop) yaw = -Math.PI / 2   // -X
        else if (isRight) yaw = Math.PI      // -Z
    }
    const rotRad = (rot * Math.PI) / 180
    return yaw + rotRad
}

// Compute the center and size of the playable band (outer text band) per tile
function tileRectFor(index: number, S: number, dir: PathDirection, rot: 0 | 90 | 180 | 270): { cx: number; cz: number; w: number; d: number; edge: Edge } {
    const step = S / 11
    const sideDepth = step * 0.62
    const cornerInner = step * 0.92
    let { row, col, edge } = baseTileForIndex(index, dir)
        ; ({ row, col } = rotateRowCol(row, col, rot))
    let x = (col - 6) * step
    let z = (6 - row) * step
    let cx = x, cz = z, w = step, d = sideDepth
    if (edge === 'corner') {
        cx = x; cz = z; w = cornerInner; d = cornerInner
    } else {
        const conf = getZoneBand()
        const outwardBase = (step / 2) - (sideDepth / 2)
        const outward = outwardBase * conf.outwardScale + (conf.outwardBias * step)
        if (edge === 'bottom') cz -= outward
        if (edge === 'top') cz += outward
        if (edge === 'left') cx -= outward
        if (edge === 'right') cx += outward
        w = step * (ZONES_DEFAULT.widthScale * getZoneBand().widthScale); d = sideDepth * getZoneBand().depthScale
    }
    return { cx, cz, w, d, edge }
}

function propertyRectFor(index: number, S: number, dir: PathDirection, rot: 0 | 90 | 180 | 270): { cx: number; cz: number; w: number; d: number; edge: Edge } {
    const step = S / 11
    const base = tileRectFor(index, S, dir, rot)
    const { edge } = base
    // Start from band center, then move inward toward board center
    const inward = step * 0.18
    let cx = base.cx, cz = base.cz
    if (edge === 'bottom') cz += inward
    else if (edge === 'top') cz -= inward
    else if (edge === 'left') cx += inward
    else if (edge === 'right') cx -= inward
    // Narrower rectangle for houses/hotels strip
    const w = base.w * 0.60
    const d = base.d * 0.38
    return { cx, cz, w, d, edge }
}

function ZonesOverlay({ S, dir, rot, showLabels = true }: { S: number; dir: PathDirection; rot: 0 | 90 | 180 | 270; showLabels?: boolean }) {
    const colors = ['#22c55e', '#3b82f6', '#eab308', '#a855f7', '#ef4444', '#14b8a6', '#f97316', '#64748b']
    const tiles = Array.from({ length: 40 }, (_, i) => i)
    const [, force] = useState(0)
    const [selected, setSelected] = useState<number | null>(null)
    const [selectedTag, setSelectedTag] = useState<'v' | 'j' | null>(null)
    const [selSlot, setSelSlot] = useState<number | null>(null)
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (!getDevFlag('editZones')) return
            const step = S / 11
            // Smaller movement steps for precise placement
            const unit = (e.shiftKey ? 0.08 : 0.02) * step
            const k = e.key.toLowerCase()
            // Global toggle for rectangle orientation
            if (k === 'b') {
                const c = getZoneBand()
                try { (window as any).MonopolyDev?.zones?.set?.({ rectSwap: !c.rectSwap }) } catch { }
                force(v => v + 1)
                return
            }
            // For tile 10: toggle visitor/jail set
            if (k === 'v') { if (selected === 10) { setSelectedTag('v'); } return }
            if (k === 'j') { if (selected === 10) { setSelectedTag('j'); } return }
            // Digit keys select slot 1..8 (or 0 to select the whole group)
            if (k >= '1' && k <= '8') { setSelSlot(parseInt(k) - 1); return }
            if (k === '0' || k === 'backspace') { setSelSlot(null); return }
            if (selected == null) return
            const cur = (selected === 10 && (selectedTag === 'v' || selectedTag === 'j')) ? getZoneTxKey(`10${selectedTag}`) : getZoneTx(selected)
            const apply = (patch: Partial<ZoneTransform>) => {
                if (selected === 10 && (selectedTag === 'v' || selectedTag === 'j')) setZoneTxKey(`10${selectedTag}`, patch)
                else setZoneTx(selected, patch)
            }
            // Rotation
            if (selSlot == null) {
                // Group rotation: coarse (E/Q) rotates the group's layout (positions)
                if (k === 'e') { apply({ rot: (cur.rot || 0) + Math.PI / 2 }); force(v => v + 1); return }
                if (k === 'q') { apply({ rot: (cur.rot || 0) - Math.PI / 2 }); force(v => v + 1); return }
                // Group facing (tokens face this) with fine control; does NOT move positions
                const ang = ((e.shiftKey ? 15 : 5) * Math.PI) / 180
                if (k === 'r') { apply({ yaw: (cur.yaw || 0) + ang }); force(v => v + 1); return }
                if (k === 'f') { apply({ yaw: (cur.yaw || 0) - ang }); force(v => v + 1); return }
            }
            if (k === 'escape') { setSelected(null); setSelSlot(null); return }
            // Spread and split controls (avoid Arrow keys to prevent camera conflicts)
            // Depth spread (along tile): T=more, G=less (smaller increments)
            if (k === 't') { apply({ spreadD: (cur.spreadD ?? 1) + 0.02 }); force(v => v + 1); return }
            if (k === 'g') { apply({ spreadD: Math.max(0.5, (cur.spreadD ?? 1) - 0.02) }); force(v => v + 1); return }
            // Width spread (across tile): Y=more, H=less (smaller increments)
            if (k === 'y') { apply({ spreadW: (cur.spreadW ?? 1) + 0.02 }); force(v => v + 1); return }
            if (k === 'h') { apply({ spreadW: Math.max(0.5, (cur.spreadW ?? 1) - 0.02) }); force(v => v + 1); return }
            // Split between 2 columns: U=more gap, J=less gap (use smaller factor)
            if (k === 'u' || k === ']') { apply({ splitW: (cur.splitW ?? 0) + unit * 0.1 }); force(v => v + 1); return }
            if (k === 'j' || k === '[') { apply({ splitW: (cur.splitW ?? 0) - unit * 0.1 }); force(v => v + 1); return }
            // Toggle overlay rectangle orientation (B)
            if (k === 'b') {
                const c = getZoneBand()
                try { (window as any).MonopolyDev?.zones?.set?.({ rectSwap: !c.rectSwap }) } catch { }
                force(v => v + 1)
                return
            }
            // Movement: group or individual slot
            if (selSlot == null) {
                if (k === 'w') { apply({ dz: (cur.dz || 0) + unit }); force(v => v + 1); return }
                if (k === 's') { apply({ dz: (cur.dz || 0) - unit }); force(v => v + 1); return }
                if (k === 'a') { apply({ dx: (cur.dx || 0) - unit }); force(v => v + 1); return }
                if (k === 'd') { apply({ dx: (cur.dx || 0) + unit }); force(v => v + 1); return }
            } else {
                const slots = cur.slots || {}
                const key = String(selSlot)
                const curOff = slots[key] || [0, 0, 0]
                // Per-zone rotation: R/F small increments
                const ang = ((e.shiftKey ? 15 : 5) * Math.PI) / 180
                const applySlots = (patch: any) => apply({ slots: patch } as any)
                if (k === 'r') { applySlots({ [key]: [curOff[0], curOff[1], (curOff[2] || 0) + ang] }); force(v => v + 1); return }
                if (k === 'f') { applySlots({ [key]: [curOff[0], curOff[1], (curOff[2] || 0) - ang] }); force(v => v + 1); return }
                if (k === 'w') { applySlots({ [key]: [curOff[0], curOff[1] + unit, curOff[2] || 0] }); force(v => v + 1); return }
                if (k === 's') { applySlots({ [key]: [curOff[0], curOff[1] - unit, curOff[2] || 0] }); force(v => v + 1); return }
                if (k === 'a') { applySlots({ [key]: [curOff[0] - unit, curOff[1], curOff[2] || 0] }); force(v => v + 1); return }
                if (k === 'd') { applySlots({ [key]: [curOff[0] + unit, curOff[1], curOff[2] || 0] }); force(v => v + 1); return }
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [selected, selSlot, S])
    return (
        <group>
            {tiles.map((ti) => {
                const { cx, cz, w, d, edge } = tileRectFor(ti, S, dir, rot)
                const cw = w / 2
                const cd = d / 4
                const isSel = selected === ti
                return (
                    <group key={`zones-${ti}`}>
                        {ti !== 10 && Array.from({ length: 8 }, (_, s) => {
                            const [x, z] = positionFor(ti, s, S, dir, rot)
                            const baseYaw = yawToward(ti, S, dir, rot)
                            const tx = getZoneTx(ti)
                            const groupYaw = tx?.yaw || 0
                            const sl = tx?.slots?.[String(s)]
                            const slotYaw = (sl && sl[2]) ? sl[2] : 0
                            const yaw = baseYaw + groupYaw + slotYaw
                            const color = colors[s % colors.length]
                            const rectSwap = !!getZoneBand().rectSwap
                            return (
                                <group key={`zone-${ti}-${s}`} position={[x, 0.004, z]}
                                    onClick={(e: any) => { if (getDevFlag('editZones')) { e.stopPropagation(); setSelected(ti); setSelectedTag(null); setSelSlot(null); } }}
                                >
                                    <mesh rotation={[-Math.PI / 2, 0, 0]}>
                                        <planeGeometry args={[(rectSwap ? cd : cw) * 0.9, (rectSwap ? cw : cd) * 0.9]} />
                                        <meshBasicMaterial color={color} transparent opacity={isSel ? (selSlot === s ? 0.6 : 0.45) : 0.25} />
                                    </mesh>
                                    <mesh position={(() => { const d = (S / 11) * 0.10; return [Math.sin(yaw) * d, 0.006, Math.cos(yaw) * d] })()}>
                                        <sphereGeometry args={[0.02, 10, 10]} />
                                        <meshBasicMaterial color="#ff3333" />
                                    </mesh>
                                    {showLabels && (
                                        <Html center distanceFactor={12}>
                                            <div style={{ color: '#ffffff', fontSize: 10, fontWeight: 600, textShadow: '0 0 2px #000, 0 0 4px #000' }}>{ti}z{(s + 1)}</div>
                                        </Html>
                                    )}
                                </group>
                            )
                        })}
                        {ti === 10 && ['v', 'j'].map((tag) => (
                            <group key={`t10-${tag}`}>
                                {Array.from({ length: 8 }, (_, s) => {
                                    const [x, z] = positionFor(ti, s, S, dir, rot, tag as 'v' | 'j')
                                    const baseYaw = yawToward(ti, S, dir, rot)
                                    const tx = getTxForTile(ti, tag as 'v' | 'j')
                                    const groupYaw = tx?.yaw || 0
                                    const sl = tx?.slots?.[String(s)]
                                    const slotYaw = (sl && sl[2]) ? sl[2] : 0
                                    const yaw = baseYaw + groupYaw + slotYaw
                                    const color = tag === 'v' ? '#3b82f6' : '#ef4444'
                                    const rectSwap = !!getZoneBand().rectSwap
                                    const isSel10 = selected === 10 && (selectedTag ? selectedTag === tag : true)
                                    return (
                                        <group key={`zone-${ti}-${tag}-${s}`} position={[x, 0.004, z]}
                                            onClick={(e: any) => { if (getDevFlag('editZones')) { e.stopPropagation(); setSelected(10); setSelectedTag(tag as 'v' | 'j'); setSelSlot(null); } }}
                                        >
                                            <mesh rotation={[-Math.PI / 2, 0, 0]}>
                                                <planeGeometry args={[(rectSwap ? cd : cw) * 0.9, (rectSwap ? cw : cd) * 0.9]} />
                                                <meshBasicMaterial color={color} transparent opacity={isSel10 ? (selSlot === s ? 0.6 : 0.45) : 0.25} />
                                            </mesh>
                                            <mesh position={(() => { const d = (S / 11) * 0.10; return [Math.sin(yaw) * d, 0.006, Math.cos(yaw) * d] })()}>
                                                <sphereGeometry args={[0.02, 10, 10]} />
                                                <meshBasicMaterial color="#ff3333" />
                                            </mesh>
                                            {showLabels && (
                                                <Html center distanceFactor={12}>
                                                    <div style={{ color: '#ffffff', fontSize: 10, fontWeight: 600, textShadow: '0 0 2px #000, 0 0 4px #000' }}>{`10${tag}z${s + 1}`}</div>
                                                </Html>
                                            )}
                                        </group>
                                    )
                                })}
                            </group>
                        ))}
                    </group>
                )
            })}
        </group>
    )
}

/* Camera rig */
function CameraRig({ preset, lerp = 0.08, instant = false, suspend = false }: {
    preset: { pos: [number, number, number]; target: [number, number, number]; fov?: number }
    lerp?: number
    instant?: boolean
    suspend?: boolean
}) {
    const camera = useThree((s) => s.camera as THREE.PerspectiveCamera)
    const internalTarget = useRef(new THREE.Vector3(...preset.target))
    const desiredPos = useRef(new THREE.Vector3(...preset.pos))
    const desiredFov = useRef(preset.fov ?? camera.fov)
    useEffect(() => {
        desiredPos.current.set(...preset.pos)
        internalTarget.current.set(...preset.target)
        desiredFov.current = preset.fov ?? camera.fov
        if (instant) {
            camera.position.set(...preset.pos)
            camera.fov = desiredFov.current
            camera.updateProjectionMatrix()
            camera.lookAt(internalTarget.current)
        }
    }, [preset, camera.fov, instant, camera])
    useFrame(() => {
        if (instant || suspend) return
        camera.position.lerp(desiredPos.current, lerp)
        camera.fov += (desiredFov.current - camera.fov) * lerp
        camera.updateProjectionMatrix()
        camera.lookAt(internalTarget.current)
    })
    return null
}

function ensureHouseZonesAPI(getDump: () => any[]) {
    if (typeof window === 'undefined') return;
    const w: any = window as any;
    w.MonopolyDev = w.MonopolyDev || {};
    w.MonopolyDev.houseZones = w.MonopolyDev.houseZones || {};

    if (!w.MonopolyDev.houseZones.get) {
        w.MonopolyDev.houseZones.get = (tile: number) => {
            const m = readHouseZones();
            return m[String(tile)] || {};
        };
    }
    if (!w.MonopolyDev.houseZones.set) {
        w.MonopolyDev.houseZones.set = (tile: number, patch: Partial<HouseZoneTx>) => {
            const m = readHouseZones();
            const k = String(tile);
            m[k] = { ...(m[k] || {}), ...(patch || {}) };
            writeHouseZones(m);
        };
    }
    if (!w.MonopolyDev.houseZones.clear) {
        w.MonopolyDev.houseZones.clear = () => {
            try { localStorage.removeItem(HOUSE_ZONES_LS); } catch { }
        };
    }
    if (!w.MonopolyDev.houseZones.dump) {
        w.MonopolyDev.houseZones.dump = () => {
            const d = getDump();
            try { console.log('[houseZones dump]', d); } catch { }
            return d;
        };
    }
    if (!w.MonopolyDev.houseZones.download) {
        w.MonopolyDev.houseZones.download = (filename?: string) => {
            const data = getDump();
            try {
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = filename || 'house-zones.json';
                document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
            } catch { }
            return data;
        };
    }
    if (!w.MonopolyDev.houseZones.applyDump) {
        w.MonopolyDev.houseZones.applyDump = (arr: any) => {
            try {
                if (!Array.isArray(arr)) { console.warn('[houseZones] applyDump expects array'); return; }
                const m: HouseZonesMap = {};
                for (const it of arr) {
                    if (!it || typeof it.tile !== 'number') continue;
                    m[String(it.tile)] = { ...(it.tx || {}) };
                }
                writeHouseZones(m);
                console.log('[houseZones] applied', Object.keys(m).length, 'entries');
            } catch (e) {
                console.warn('[houseZones applyDump failed]', e);
            }
        };
    }
}
function HouseZonesOverlay({
    S, dir, rot,
}: { S: number; dir: PathDirection; rot: 0 | 90 | 180 | 270 }) {
    // --- Easy-to-edit constants ---
    const HOUSE_SCALE = 0.0125;

    const HOTEL_SCALE = 0.018;

    const HOUSE_Y_OFFSET = 0.08;

    const HOTEL_Y_OFFSET = 0.13;

    const [selTile, setSelTile] = useState<number | null>(null);
    const [selSlot, setSelSlot] = useState<number | 'hotel' | null>(null);
    const [, force] = useState(0);

    useEffect(() => {
        const dump = () => {
            const out: any[] = [];
            for (const ti of HOUSE_TILES) {
                out.push({ tile: ti, tx: readHouseZones()[String(ti)] || {} });
            }
            return out;
        };
        ensureHouseZonesAPI(dump);
    }, []);
    useEffect(() => { /* ... forceRender listener ... */ }, []);

    useEffect(() => {
        if (!getDevFlag('editPropertyZones')) return;

        const onKey = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();

            // Global House/Hotel Toggles
            if (key === 'n' || key === 'm' || key === 'b') {
                e.preventDefault();
                const m = readHouseZones();
                let targetCount = 0;

                if (key === 'n') {
                    targetCount = (m['1']?.houseCount === 4) ? 0 : 4;
                } else if (key === 'm') {
                    targetCount = (m['1']?.houseCount === 5) ? 0 : 5;
                } else if (key === 'b') {
                    targetCount = 0;
                }

                for (const ti of HOUSE_TILES) {
                    const k = String(ti);
                    m[k] = { ...(m[k] || {}), houseCount: targetCount };
                }

                writeHouseZones(m);
                force(v => v + 1);
                return;
            }

            // Individual Editing Logic
            if (selTile == null) return;

            const step = S / 11;
            const move = (e.shiftKey ? 0.02 : 0.008) * step;
            const m = readHouseZones();
            const k = String(selTile);
            const cur: HouseZoneTx = m[k] || {};
            let changed = false;
            const set = (patch: Partial<HouseZoneTx>) => { m[k] = { ...cur, ...patch }; changed = true; };

            // --- Part 1: Handle Slot-Specific Movement (WASD) ---
            if (selSlot === 'hotel') {
                const hotelTx = cur.hotel || {};
                const nextHotelTx: HouseZoneHotelTx = { ...hotelTx };
                switch (key) {
                    case 'w': nextHotelTx.dz = (nextHotelTx.dz || 0) + move; break;
                    case 's': nextHotelTx.dz = (nextHotelTx.dz || 0) - move; break;
                    case 'a': nextHotelTx.dx = (nextHotelTx.dx || 0) - move; break;
                    case 'd': nextHotelTx.dx = (nextHotelTx.dx || 0) + move; break;
                }
                if (nextHotelTx.dx !== hotelTx.dx || nextHotelTx.dz !== hotelTx.dz) set({ hotel: nextHotelTx });

            } else if (typeof selSlot === 'number') {
                const slots = cur.slots || {};
                const slotKey = String(selSlot);
                const curSlotTx = slots[slotKey] || {};
                const nextSlotTx: HouseZoneSlotTx = { ...curSlotTx };
                switch (key) {
                    case 'w': nextSlotTx.dz = (nextSlotTx.dz || 0) + move; break;
                    case 's': nextSlotTx.dz = (nextSlotTx.dz || 0) - move; break;
                    case 'a': nextSlotTx.dx = (nextSlotTx.dx || 0) - move; break;
                    case 'd': nextSlotTx.dx = (nextSlotTx.dx || 0) + move; break;
                }
                if (nextSlotTx.dx !== curSlotTx.dx || nextSlotTx.dz !== curSlotTx.dz) set({ slots: { ...slots, [slotKey]: nextSlotTx } });
            }

            // --- Part 2: Handle Group-Level Controls (Movement, Scale, Rotation) ---
            const scaleStep = e.shiftKey ? 0.04 : 0.015;
            const yawStep = ((e.shiftKey ? 15 : 5) * Math.PI) / 180;
            switch (key) {
                // Group movement (only if no specific slot is selected)
                case 'w': if (selSlot === null) set({ dz: (cur.dz || 0) + move }); break;
                case 's': if (selSlot === null) set({ dz: (cur.dz || 0) - move }); break;
                case 'a': if (selSlot === null) set({ dx: (cur.dx || 0) - move }); break;
                case 'd': if (selSlot === null) set({ dx: (cur.dx || 0) + move }); break;
                // Scaling (always active)
                case 't': set({ wScale: (cur.wScale || 1) + scaleStep }); break;
                case 'g': set({ wScale: Math.max(0.2, (cur.wScale || 1) - scaleStep) }); break;
                case 'y': set({ dScale: (cur.dScale || 1) + scaleStep }); break;
                case 'h': set({ dScale: Math.max(0.2, (cur.dScale || 1) - scaleStep) }); break;
                // Rotation (always active)
                case 'e': set({ rot: (((cur.rot || 0) + Math.PI / 2) % (Math.PI * 2)) }); break;
                case 'r': set({ modelYaw: (cur.modelYaw || 0) + yawStep }); break;
                case 'f': set({ modelYaw: (cur.modelYaw || 0) - yawStep }); break;
            }

            // --- Part 3: Global Keys ---
            if (key === 'escape') { setSelTile(null); setSelSlot(null); }
            if (changed) { e.preventDefault(); writeHouseZones(m); force(v => v + 1); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [selTile, selSlot, S]);;

    return (
        <group>
            {Array.from(HOUSE_TILES).map((ti) => {
                const pz = propertyRectForHouse(ti, S, dir, rot);
                const tx = readHouseZones()[String(ti)] || {};
                const sx = pz.w * (tx.wScale || 1), sz = pz.d * (tx.dScale || 1);
                const cx = pz.cx + (tx.dx || 0), cz = pz.cz + (tx.dz || 0);
                const rotY = tx.rot || 0;
                const sel = selTile === ti;
                const houseCount = tx.houseCount || 0;

                const innerD = (sz - (0.08 * sz) * 3) / 4;
                const houseSlots = Array.from({ length: 4 }, (_, i) => ({ lx: 0, lz: -sz / 2 + innerD / 2 + i * (innerD + (0.08 * sz)) }));
                const hotelTx = tx.hotel || {};

                return (
                    <group key={`hz-${ti}`} position={[cx, 0.007, cz]} rotation={[0, rotY, 0]}>
                        {/* Render 3D Models */}
                        <Suspense fallback={null}>
                            {houseCount > 0 && houseCount < 5 && (
                                Array.from({ length: houseCount }).map((_, houseIdx) => {
                                    const slot = houseSlots[houseIdx]; if (!slot) return null;
                                    const slotTx = tx.slots?.[String(houseIdx)] || {};
                                    const position: [number, number, number] = [slot.lx + (slotTx.dx || 0), HOUSE_Y_OFFSET, slot.lz + (slotTx.dz || 0)];
                                    return <HouseModel key={`house-on-${ti}-${houseIdx}`} position={position} rotation={[0, getHouseModelYaw(ti), 0]} scale={HOUSE_SCALE} />;
                                })
                            )}
                            {houseCount === 5 && (
                                <HotelModel position={[hotelTx.dx || 0, HOTEL_Y_OFFSET, hotelTx.dz || 0]} rotation={[0, getHouseModelYaw(ti), 0]} scale={HOTEL_SCALE} />
                            )}
                        </Suspense>

                        {/* Always render all 5 editor planes */}

                        {/* Hotel Editor Plane */}
                        <group position={[hotelTx.dx || 0, 0, hotelTx.dz || 0]}>
                            <mesh rotation={[-Math.PI / 2, 0, 0]} onPointerDown={(e) => { e.stopPropagation(); setSelTile(ti); setSelSlot('hotel'); }}>
                                <planeGeometry args={[sx * 0.7, sz * 0.35]} />
                                <meshBasicMaterial color={'#fca5a5'} transparent opacity={sel && selSlot === 'hotel' ? 0.5 : 0.2} />
                            </mesh>
                        </group>

                        {/* House Slot Editor Planes */}
                        {houseSlots.map((slot, idx) => {
                            const isSlotSel = sel && selSlot === idx;
                            const slotTx = tx.slots?.[String(idx)] || {};
                            return (
                                <group key={`hslot-${ti}-${idx}`} position={[slot.lx + (slotTx.dx || 0), 0, slot.lz + (slotTx.dz || 0)]}>
                                    <mesh rotation={[-Math.PI / 2, 0, 0]} onPointerDown={(e) => { e.stopPropagation(); setSelTile(ti); setSelSlot(idx); }}>
                                        <planeGeometry args={[sx * 0.94, innerD * 0.90]} />
                                        <meshBasicMaterial color={'#7dd3fc'} transparent opacity={isSlotSel ? 0.5 : 0.15} depthWrite={false} />
                                    </mesh>
                                </group>
                            );
                        })}
                    </group>
                );
            })}
        </group>
    );
}
/* Main */
function Board3D({
    players = {},
    order = [],
    worldSize = 10,
    indexRotation = 0,
    pathDirection = 'clockwise',
    displayOffset = 0,
    tokenBaseY = 0.26,

    lighting,
    models = {},
    boardImageUrl = '/board.png',
    showLabels = false,
    showFallbackSpheres = false,

    boardThickness = 0.25,
    boardBodyColor = '#000000',
    outfill = 0.06,
    rimHeight = 0.04,
    rimColor = '#000',

    presets,
    presetIndex = 0,
    cameraLerp = 0.08,
    waitingMode = false,
    waitingPreset = { pos: [0, 12, 0], target: [0, 0, 0], fov: 30 },

    placementOverrides,
    placementAliases = {},
    tokenGapsY,
    children,
    overlayChildren,
    onTokenRouteStart,
    onTokenRouteComplete,
    routeCompleteDelayMs = 0,
    routeStartDelayMs = 0,
    onGoToJail,
    currentPlayerId,
    activityKey,
    onCardRectsChange,
    showHud,
    isFullscreen,
    onToggleFullscreen,
    onInitiateTrade,
    onOpenTradeModal,
    tradeActive,
    tradePlayerIds,
    onBuyHouse,
    onSellHouse,
    onBuyHotel,
    onSellHotel,
    onMortgage,
    onOptions,
}: Props) {

    const [, forceUpdate] = useState(0);

    useEffect(() => {
        const handler = () => {
            // When any dev flag changes, force the component to re-render
            forceUpdate(v => v + 1);
        };
        window.addEventListener('monopoly.devflag', handler);
        return () => window.removeEventListener('monopoly.devflag', handler);
    }, []);
    // Ensure dev runtime API exists
    useEffect(() => { ensureDevFlagsAPI(); ensureDevZonesAPI() }, [])
    // Expose runtime token gap API once on mount
    useEffect(() => { ensureRuntimeTokenYAPI() }, [])
    const plist = useMemo(() => {
        const arr = order.map(id => players[id]).filter(Boolean) as Player[]
        return arr.length ? arr : Object.values(players || {})
    }, [players, order])

    const occupancy = useMemo(() => {
        const map = new Map<number, string[]>()
        for (const p of plist) {
            const tile = ((p.position + (displayOffset % 40) + 40) % 40)
            if (!map.has(tile)) map.set(tile, [])
            map.get(tile)!.push(p.id)
        }
        return map
    }, [plist, displayOffset])

    const L = {
        ambient: lighting?.ambient ?? 0.3,
        hemi: lighting?.hemi ?? 0.2,
        key: lighting?.key ?? 0.85,
        fill: lighting?.fill ?? 0.4,
        exposure: lighting?.exposure ?? 1.0,
        background: lighting?.background ?? '#333333',
    }

    const inset = Math.max(0, Math.min(outfill, worldSize / 2 - 0.001))
    const topSize = Math.max(0.001, worldSize - 2 * inset)

    const defaultPresets = [
        { pos: [8.5, 8.5, 8.5] as [number, number, number], target: [0, 0, 0] as [number, number, number], fov: 56 },
        { pos: [0.0, 8.5, 8.5] as [number, number, number], target: [0, 0, 0] as [number, number, number], fov: 56 },
        { pos: [-8.5, 8.5, 0.0] as [number, number, number], target: [0, 0, 0] as [number, number, number], fov: 56 },
        { pos: [0.0, 8.5, -8.5] as [number, number, number], target: [0, 0, 0] as [number, number, number], fov: 56 },
    ]
    const allPresets = presets && presets.length ? presets : defaultPresets
    const safeIndex = (presetIndex % allPresets.length + allPresets.length) % allPresets.length
    const fromPropsPreset = allPresets[safeIndex]
    const activePreset = waitingMode ? waitingPreset : fromPropsPreset
    const instant = waitingMode
    const completeTimersRef = useRef<Record<string, number | null>>({})
    Board3D



    // WebGL renderer ref for dynamic pixel ratio tweaks during interaction
    const glRef = useRef<THREE.WebGLRenderer | null>(null)

    const prevTileRef = useRef<Record<string, number>>({})
    // Route state (stable across renders)
    const movingRef = useRef<Set<string>>(new Set())
    const routeCacheRef = useRef<Record<string, RouteStep[]>>({})
    const fromCacheRef = useRef<Record<string, [number, number, number]>>({})
    const yawFromCacheRef = useRef<Record<string, number>>({})
    const routeStartAtRef = useRef<Record<string, number>>({})
    const hopStepsRef = useRef<Record<string, HopStep[]>>({})
    const hopBreakRef = useRef<Record<string, { goSeg?: number; fired?: boolean }>>({})
    // Track current hop tile + phase per player for highlights
    const currentHopTileRef = useRef<Record<string, number>>({})
    const routePhaseRef = useRef<Record<string, number>>({})
    const routeFlashRef = useRef<Record<string, { tile: number; until: number; duration: number }>>({})
    // Global route-activity signal for spectators/UI overlays
    const globalRouteActiveRef = useRef<boolean>(false)
    const setGlobalRouteActive = () => {
        try {
            const active = (movingRef.current.size > 0)
            if (globalRouteActiveRef.current !== active) {
                globalRouteActiveRef.current = active
                    ; (window as any).MonopolyRouteActive = active
                window.dispatchEvent(new CustomEvent('monopoly:routeActive', { detail: { active } }))
            } else {
                ; (window as any).MonopolyRouteActive = active
            }
        } catch { }
    }
    // Defer route-start callbacks to after commit to avoid setState during render
    const pendingStartRef = useRef<Set<string>>(new Set())
    useEffect(() => {
        if (pendingStartRef.current.size) {
            const ids = Array.from(pendingStartRef.current)
            pendingStartRef.current.clear()
            try {
                for (const id of ids) {
                    movingRef.current.add(id)
                    setGlobalRouteActive()
                    onTokenRouteStart?.(id)
                }
            } catch { }
        }
    })

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const w: any = window as any;
        if (!w.MonopolyDev) w.MonopolyDev = {};

        w.MonopolyDev.buyHouseForPlayer = (playerId: string) => {
            // Use the 'players' prop which is available in Board3D
            if (!players || !players[playerId]) {
                console.warn(`[buyHouseForPlayer] Player with ID "${playerId}" not found.`);
                return;
            }

            const targetPlayer = players[playerId];
            const tileIndex = targetPlayer.position;

            console.log(`[buyHouseForPlayer] Simulating house placement for player "${playerId}" on tile ${tileIndex}`);

            const m = readHouseZones();
            const k = String(tileIndex);
            const cur: HouseZoneTx = m[k] || {};
            const count = cur.houseCount || 0;

            if (count < 5) {
                m[k] = { ...cur, houseCount: count + 1 };
                writeHouseZones(m);
                window.dispatchEvent(new CustomEvent('monopoly:forceRender'));
            } else {
                console.warn(`[buyHouseForPlayer] Tile ${tileIndex} already has a hotel.`);
            }
        };

        return () => {
            if (w.MonopolyDev) delete w.MonopolyDev.buyHouseForPlayer;
        };
    }, [players]);
    // Force a React re-render when highlight attachments change (step start/end, route done)
    const [, forceScene] = useState(0)
    // Guarded route logger to avoid spamming the console every frame
    const lastLogRef = useRef<string>('')
    function logRoute(playerId: string, prev: number, curr: number, hops: number) {
        const line = `[route ${playerId}] prev=${prev} curr=${curr} hops=${hops} |`
        if (lastLogRef.current !== line) {
            lastLogRef.current = line
            // Optional: gate behind a flag if needed
            // if (getDevFlag('logRoutes')) console.log(line)
            console.log(line)
        }
    }
    // Track the last observed tile per player to compute hops reliably
    const lastTileRef = useRef<Record<string, number>>({})
    // Prevent starting the same target move more than once per-player
    const lastProcessedTargetRef = useRef<Record<string, number>>({})

    // Free-roam camera via OrbitControls; suspend rig while interacting
    const [orbiting, setOrbiting] = useState(false)
    const [followPreset, setFollowPreset] = useState(true)
    const controlsRef = useRef<any>(null)
    useEffect(() => {
        const t = activePreset.target
        if (controlsRef.current?.target && Array.isArray(t)) {
            controlsRef.current.target.set(t[0], t[1], t[2])
            controlsRef.current.update?.()
        }
    }, [activePreset.target])
    // When preset index changes, re-enable following that preset
    useEffect(() => { setFollowPreset(true) }, [safeIndex, waitingMode])

    // Normalize prop token gaps to UPPER keys
    const propTokenGaps = useMemo(() => {
        const m = new Map<string, number>()
        // Seed with global defaults (shared across all clients)
        for (const [k, v] of Object.entries(DEFAULT_TOKEN_GAPS_Y || {})) {
            if (typeof v === 'number' && Number.isFinite(v)) m.set(k.toUpperCase(), v)
        }
        if (tokenGapsY) {
            for (const [k, v] of Object.entries(tokenGapsY)) {
                if (typeof v === 'number' && Number.isFinite(v)) m.set(k.toUpperCase(), v)
            }
        }
        return m
    }, [tokenGapsY])

    const getGapY = (nameKey: string | null) => {
        if (!nameKey) return 0
        if (propTokenGaps.has(nameKey)) return propTokenGaps.get(nameKey) as number
        return tokenGapYFor(nameKey)
    }

    // Dev placement click markers
    const [devMarkers, setDevMarkers] = useState<Array<[number, number]>>([])

    const tokenPositions = useMemo(() => {
        const positions: Record<string, [number, number, number]> = {}
        for (const p of plist) {
            const tileIndex = ((p.position + (displayOffset % 40) + 40) % 40)
            const orderIdx = order ? order.indexOf(p.id) : -1
            const slot = Math.max(0, Math.min(7, orderIdx >= 0 ? orderIdx : 0))
            const sourceIndex = placementAliases?.[tileIndex] ?? tileIndex
            const ov = placementOverrides?.[sourceIndex]?.[slot]
            const cfg = models[p.id]
            if (cfg?.url) {
                const zoneTag: 'v' | 'j' | undefined = jailZoneTag(tileIndex, p)
                const [x, z] = (ov && sourceIndex !== 10) ? ov : positionFor(tileIndex, slot, topSize, pathDirection, indexRotation, zoneTag)
                const nameKey = nameKeyFromUrl(cfg.url)
                const y = tokenBaseY + (cfg.y ?? 0) + (cfg.offsetY ?? 0) + getGapY(nameKey)
                positions[p.id] = [x, y, z]
            }
        }
        return positions
    }, [plist, displayOffset, occupancy, models, worldSize, pathDirection, indexRotation, placementOverrides, placementAliases, tokenBaseY, getGapY])

    // Jail cinematic state per player
    type JailCine = { phase: 'out' | 'wait' | 'in'; t0: number; startTile: number }
    const jailCineRef = useRef<Record<string, JailCine | undefined>>({})
    const setJailCine = (pid: string, val: JailCine | undefined) => { jailCineRef.current[pid] = val; forceScene(v => v + 1) }

    // Dev: expose a dump() that returns location + rotation details for every zone
    useEffect(() => {
        const w: any = typeof window !== 'undefined' ? window : null
        if (!w) return
        w.MonopolyDev = w.MonopolyDev || {}
        w.MonopolyDev.zones = w.MonopolyDev.zones || {}
        w.MonopolyDev.zones.dump = () => {
            const S = topSize
            const dir = pathDirection
            const rot = indexRotation
            const all: any[] = []
            for (let ti = 0; ti < 40; ti++) {
                const tx = getZoneTx(ti)
                const rect = tileRectFor(ti, S, dir, rot)
                const zones: any[] = []
                for (let s = 0; s < 8; s++) {
                    const [x, z] = positionFor(ti, s, S, dir, rot)
                    const baseYaw = yawToward(ti, S, dir, rot)
                    const groupYaw = tx?.yaw || 0
                    const slotArr = tx?.slots?.[String(s)]
                    const slotYaw = (slotArr && slotArr[2]) ? slotArr[2] : 0
                    zones.push({ zone: s + 1, position: [x, z], x, z, yaw: baseYaw + groupYaw + slotYaw, baseYaw, groupYaw, slotYaw })
                }
                all.push({ tile: ti, label: String(ti), rect, transform: tx, zones }); if (ti === 10) { const tv = getZoneTxKey("10v"); const tj = getZoneTxKey("10j"); if (tv && (tv.dx || tv.dz || tv.rot || tv.yaw || tv.slots)) { all.push({ key: "10v", label: "10v", tile: 10, rect, transform: tv }) } if (tj && (tj.dx || tj.dz || tj.rot || tj.yaw || tj.slots)) { all.push({ key: "10j", label: "10j", tile: 10, rect, transform: tj }) } }
            }
            try { console.log('[MonopolyDev] zones dump', all) } catch { }
            return all
        }
    }, [topSize, pathDirection, indexRotation])

    // Dev placement save function and state exposure
    const __plState = useRef<DevPlacementState>({ enabled: false, tileIndex: null, zone: '', slot: 0, lastAutoTile: null, areas: {} })
    const __plSave = useRef<(tile: number, slot: number, x: number, z: number) => void>((tile, slot, x, z) => {
        try {
            const raw = localStorage.getItem(PL_SAVE_KEY)
            const obj = raw ? JSON.parse(raw) : {}
            const zone = __plState.current.zone
            const key = (tile === 10 && zone) ? `${tile}${zone}` : String(tile)
            const maxSlots = (tile === 10 && zone === 'v') ? 6 : (tile === 10 && zone === 'j') ? 4 : 4
            const arr: Array<[number, number] | null> = Array.isArray(obj[key]) ? obj[key] : Array(maxSlots).fill(null)
            const idx = Math.max(0, Math.min(maxSlots - 1, slot))
            arr[idx] = [x, z]
            obj[key] = arr
            localStorage.setItem(PL_SAVE_KEY, JSON.stringify(obj))
        } catch (e) { console.warn('[Dev] placement save failed', e) }
    })
    useEffect(() => {
        // expose refs globally for dev API
        const w: any = window as any
        if (w) { w.__plState = __plState; w.__plSave = __plSave }
        ensureDevPlacementAPI(__plState, __plSave)
        try { if (localStorage.getItem(PL_ENABLE_KEY) === '1') __plState.current.enabled = true } catch { }
        try {
            const w: any = window as any
            (w.MonopolyDev = w.MonopolyDev || {}).placement = w.MonopolyDev.placement || {}
            w.MonopolyDev.placement.clearMarkers = () => setDevMarkers([])
        } catch { }
    }, []);
    const shadowsEnabled = !getDevFlag('disableShadows')
    const fogEnabled = !getDevFlag('disableFog')
    const lowDpr = getDevFlag('lowDpr')
    // Selected property card to show (on click)
    const [openCardId, setOpenCardId] = useState<number | null>(null)
    // Preload all property card images (front/back)
    useEffect(() => {
        try {
            const ids = (board as any).spaces?.map((sp: any, i: number) => {
                const t = sp?.type
                return (t === 'PROPERTY' || t === 'STATION' || t === 'UTILITY') ? i : null
            }).filter((v: number | null) => v != null) as number[]
            // Warm both the browser cache and the R3F loader cache
            ids.forEach((id: number) => {
                const f = `/propertyCards/${id}f.png`
                const b = `/propertyCards/${id}b.png`
                try { const a = new Image(); a.src = f } catch { }
                try { const c = new Image(); c.src = b } catch { }
                try { (useTexture as any).preload?.(f); (useTexture as any).preload?.(b) } catch { }
            })
        } catch { }
    }, [])

    // --- Hover highlight over buyable tiles --------------------------------
    const [hoverTile, setHoverTile] = useState<number | null>(null)
    const isBuyableTile = (i: number) => {
        try {
            const t = (board as any).spaces?.[i]?.type
            return t === 'PROPERTY' || t === 'STATION' || t === 'UTILITY'
        } catch { return false }

    }



    // Runtime API like tileZones
    function ensureHouseZonesAPI(getDump: () => any[]) {
        if (typeof window === 'undefined') return;
        const w: any = window as any;
        w.MonopolyDev = w.MonopolyDev || {};
        w.MonopolyDev.houseZones = w.MonopolyDev.houseZones || {};

        if (!w.MonopolyDev.houseZones.get) {
            w.MonopolyDev.houseZones.get = (tile: number) => {
                const m = readHouseZones();
                return m[String(tile)] || {};
            };
        }
        if (!w.MonopolyDev.houseZones.set) {
            w.MonopolyDev.houseZones.set = (tile: number, patch: Partial<HouseZoneTx>) => {
                const m = readHouseZones();
                const k = String(tile);
                m[k] = { ...(m[k] || {}), ...(patch || {}) };
                writeHouseZones(m);
            };
        }
        if (!w.MonopolyDev.houseZones.clear) {
            w.MonopolyDev.houseZones.clear = () => {
                try { localStorage.removeItem(HOUSE_ZONES_LS); } catch { }
            };
        }
        if (!w.MonopolyDev.houseZones.dump) {
            w.MonopolyDev.houseZones.dump = () => {
                const d = getDump();
                try { console.log('[houseZones dump]', d); } catch { }
                return d;
            };
        }
        if (!w.MonopolyDev.houseZones.download) {
            w.MonopolyDev.houseZones.download = (filename?: string) => {
                const data = getDump();
                try {
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url; a.download = filename || 'house-zones.json';
                    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                } catch { }
                return data;
            };
        }
        if (!w.MonopolyDev.houseZones.applyDump) {
            w.MonopolyDev.houseZones.applyDump = (arr: any) => {
                try {
                    if (!Array.isArray(arr)) { console.warn('[houseZones] applyDump expects array'); return; }
                    const m: HouseZonesMap = {};
                    for (const it of arr) {
                        if (!it || typeof it.tile !== 'number') continue;
                        m[String(it.tile)] = { ...(it.tx || {}) };
                    }
                    writeHouseZones(m);
                    console.log('[houseZones] applied', Object.keys(m).length, 'entries');
                } catch (e) {
                    console.warn('[houseZones applyDump failed]', e);
                }
            };
        }
    }




    // --- Dev: tile zones (toggle via MonopolyDev.set('tileZones', true)) ----
    const tileZonesEnabled = getDevFlag('tileZones')
    const dumpTileZonesFlag = getDevFlag('dumpTileZones')
    // When dev tooling is active (or the explicit flag is set) prefer runtime JSON over baked defaults
    const useDevZoneJson = tileZonesEnabled || getDevFlag('editZones') || getDevFlag('useDevZoneJson')
    type ZoneKind = 'hz' | 'pz'
    type ZoneTx = { dx?: number; dz?: number; wScale?: number; dScale?: number; rot?: number }
    type TileZones = Record<string, Partial<Record<ZoneKind, ZoneTx>>>
    const TILE_ZONES_LS = 'monopoly.dev.tileZones'
    const bakedTileZones = useMemo<TileZones>(() => {
        const map: TileZones = {}
        for (const entry of BAKED_TILE_ZONES_RAW) {
            if (!entry || typeof entry.tile !== 'number') continue
            const key = String(entry.tile)
            const next: Partial<Record<ZoneKind, ZoneTx>> = {}
            if (entry.hz && typeof entry.hz === 'object') next.hz = { ...(entry.hz as any) }
            if (entry.pz && typeof entry.pz === 'object') next.pz = { ...(entry.pz as any) }
            if (Object.keys(next).length) map[key] = next
        }
        return map
    }, [])
    const cloneTileZones = (src: TileZones): TileZones => JSON.parse(JSON.stringify(src || {})) as TileZones
    function readTileZones(): TileZones {
        if (useDevZoneJson) {
            try {
                const raw = localStorage.getItem(TILE_ZONES_LS)
                if (raw) {
                    const parsed = JSON.parse(raw)
                    if (parsed && typeof parsed === 'object') return parsed
                }
            } catch { }
        }
        return cloneTileZones(bakedTileZones)
    }
    function writeTileZones(m: TileZones) {
        if (!useDevZoneJson) return
        try { localStorage.setItem(TILE_ZONES_LS, JSON.stringify(m)) } catch { }
    }
    const twoZoneTiles = useMemo(() => new Set<number>([0, 1, 3, 6, 8, 9, 11, 13, 14, 16, 18, 19, 21, 23, 24, 26, 27, 29, 31, 32, 34, 37, 39]), [])
    const lastSeenTileRef = useRef<Record<string, number>>({});
    useEffect(() => {
        for (const p of plist) {
            const tileNow = ((p.position + (displayOffset % 40) + 40) % 40);

            const lastSeen = lastSeenTileRef.current[p.id];
            if (lastSeen == null) {
                // First time we see this player: remember where they are.
                lastSeenTileRef.current[p.id] = tileNow;
                continue;
            }
            const hasActiveRoute = (routeCacheRef.current[p.id] || []).length > 0
            if (lastSeen !== tileNow && !hasActiveRoute) {
                // Seed "previous" so the first movement actually animates.
                prevTileRef.current[p.id] = lastSeen;
                lastTileRef.current[p.id] = lastSeen;
                delete lastProcessedTargetRef.current[p.id]; // allow building a fresh route
                lastSeenTileRef.current[p.id] = tileNow;
            } else {
                // Keep last-seen up to date when idle.
                lastSeenTileRef.current[p.id] = tileNow;
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [plist, displayOffset, pathDirection, indexRotation]);
    const FORCE_NON_PROP = useMemo(() => new Set<number>([2, 7, 17, 22, 33, 36, 4, 38]), [])
    const HIGHLIGHT_EXCLUDED = useMemo(() => new Set<number>([0, 10, 20, 30, 2, 4, 7, 17, 22, 33, 36, 38]), [])
    const [tzMap, setTzMap] = useState<TileZones>(() => readTileZones())
    const tileZoneInitRef = useRef(true)
    const [selZone, setSelZone] = useState<{ tile: number; kind: ZoneKind } | null>(null)
    useEffect(() => { if (!tileZonesEnabled) setSelZone(null) }, [tileZonesEnabled])
    useEffect(() => {
        if (tileZoneInitRef.current) { tileZoneInitRef.current = false; return }
        setTzMap(readTileZones())
    }, [useDevZoneJson, bakedTileZones])
    // Expose a small runtime API and handle dump flag
    const dumpOnceRef = useRef(false)
    const makeDump = useMemo(() => () => {
        const tiles = Array.from({ length: 40 }, (_, i) => i)
        return tiles.map((ti) => {
            const base = tileRectFor(ti, topSize, pathDirection, indexRotation)
            const tileKind = base.edge === 'corner' ? 0 : (isBuyableTile(ti) ? 1 : 2)
            const defHZ: ZoneTx = (tileKind === 0) ? { wScale: 1.56, dScale: 1.56 }
                : (tileKind === 1) ? { wScale: 1.03, dScale: 1.76 }
                    : { wScale: 1.02, dScale: 2.30 }
            const defPZ: ZoneTx | null = tileKind === 1 ? { wScale: 1.71, dScale: 1.33 } : null
            const saved = tzMap[String(ti)] || {}
            const hz = { ...defHZ, ...(saved.hz || {}) }
            const pzRaw = saved.pz || (defPZ || null)
            const pz = (twoZoneTiles.has(ti) && tileKind === 1) ? pzRaw : null
            return { tile: ti, hz, pz }
        })
    }, [tzMap, topSize, pathDirection, indexRotation])
    useEffect(() => {
        if (typeof window === 'undefined') return
        const w: any = window as any
        w.MonopolyDev = w.MonopolyDev || {}
        w.MonopolyDev.tileZones = w.MonopolyDev.tileZones || {}
        w.MonopolyDev.tileZones.dump = () => {
            const data = makeDump()
            try { console.log('[tileZones dump]', data) } catch { }
            return data
        }
        w.MonopolyDev.tileZones.download = (filename?: string) => {
            try {
                const data = makeDump()
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = filename || 'tile-zones.json'
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(url)
                return data
            } catch (e) { console.warn('[tileZones download failed]', e) }
        }
        w.MonopolyDev.tileZones.applyDump = (arr: any) => {
            try {
                if (!Array.isArray(arr)) { console.warn('[tileZones] applyDump expects an array'); return }
                if (!useDevZoneJson) { console.warn('[tileZones] applyDump ignored because useDevZoneJson flag is disabled'); return }
                const m: TileZones = {}
                for (const it of arr) {
                    if (!it) continue
                    const t = String(it.tile)
                    m[t] = {}
                    if (it.hz && typeof it.hz === 'object') (m[t] as any).hz = it.hz
                    if (it.pz && typeof it.pz === 'object') (m[t] as any).pz = it.pz
                }
                setTzMap(m); writeTileZones(m)
                console.log('[tileZones] applied', arr.length, 'entries')
            } catch (e) { console.warn('[tileZones applyDump failed]', e) }
        }
    }, [makeDump, useDevZoneJson])
    useEffect(() => {
        if (!dumpTileZonesFlag || dumpOnceRef.current === true) return
        // Trigger one-time download when flag is enabled
        dumpOnceRef.current = true
        try {
            const data = makeDump()
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'tile-zones.json'
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
        } catch (e) { console.warn('[tileZones dump flag failed]', e) }
    }, [dumpTileZonesFlag, makeDump])
    useEffect(() => {
        if (!tileZonesEnabled) return
        const handler = (e: KeyboardEvent) => {
            if (!selZone) return
            const { tile, kind } = selZone
            const step = topSize / 11
            // Finer-grained controls by default; Shift for larger nudges
            const move = (e.shiftKey ? 0.015 : 0.005) * step
            const scaleStep = e.shiftKey ? 0.03 : 0.01
            const m: TileZones = { ...tzMap }
            m[String(tile)] = m[String(tile)] || {}
            m[String(tile)]![kind] = m[String(tile)]![kind] || {}
            const t = m[String(tile)]![kind] as ZoneTx
            const k = e.key.toLowerCase()
            let changed = false
            if (k === 'w') { t.dz = (t.dz || 0) + move; changed = true }
            if (k === 's') { t.dz = (t.dz || 0) - move; changed = true }
            if (k === 'a') { t.dx = (t.dx || 0) - move; changed = true }
            if (k === 'd') { t.dx = (t.dx || 0) + move; changed = true }
            // Remove upper bounds so zones can grow freely; keep a small lower bound
            if (k === 't') { t.wScale = (t.wScale || 1) + scaleStep; changed = true }
            if (k === 'g') { t.wScale = Math.max(0.2, (t.wScale || 1) - scaleStep); changed = true }
            if (k === 'y') { t.dScale = (t.dScale || 1) + scaleStep; changed = true }
            if (k === 'h') { t.dScale = Math.max(0.2, (t.dScale || 1) - scaleStep); changed = true }
            // Rotate 90° per keypress
            if (k === 'q') { t.rot = (((t.rot || 0) - (Math.PI / 2)) + Math.PI * 4) % (Math.PI * 2); changed = true }
            if (k === 'e') { t.rot = (((t.rot || 0) + (Math.PI / 2)) + Math.PI * 4) % (Math.PI * 2); changed = true }
            if (changed) { e.preventDefault(); setTzMap(m); writeTileZones(m) }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [tileZonesEnabled, selZone, tzMap, topSize])



    return (
        <div className="scene" style={{ position: 'relative', cursor: (hoverTile != null ? 'pointer' : 'default') as any }}>
            <Canvas
                camera={{ fov: activePreset.fov ?? 56, position: activePreset.pos }}
                shadows={shadowsEnabled}
                dpr={lowDpr ? 1 : [1, 1.25]}
                frameloop="always"
                gl={{ antialias: !getDevFlag('noAA'), powerPreference: 'high-performance', precision: 'highp', alpha: false, stencil: false, depth: true }}
                onCreated={({ gl }) => {
                    glRef.current = gl
                    gl.toneMapping = THREE.NoToneMapping
                    gl.toneMappingExposure = L.exposure
                    // Soften shadows and use physically-based lighting
                    gl.shadowMap.enabled = shadowsEnabled
                    gl.shadowMap.type = THREE.PCFSoftShadowMap
                        ; (gl as any).physicallyCorrectLights = true
                    try { gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)) } catch { }
                }}
            >
                {/* Dev: expose save/load camera helpers */}
                <DevCameraAPI controlsRef={controlsRef} setFollowPreset={setFollowPreset} />
                <CameraRig preset={activePreset} lerp={cameraLerp} instant={instant} suspend={orbiting || !followPreset} />
                {!getDevFlag('disableControls') && !waitingMode && (
                    <OrbitControls
                        ref={controlsRef}
                        makeDefault
                        enabled
                        enableRotate={!getDevFlag('lockCameraDrag')}
                        enablePan={!getDevFlag('lockCameraDrag')}
                        enableDamping
                        dampingFactor={0.12}
                        rotateSpeed={0.8}
                        zoomSpeed={0.9}
                        panSpeed={0.9}
                        minDistance={4}
                        maxDistance={26}
                        maxPolarAngle={Math.PI * 0.495}
                        target={activePreset.target}
                        onStart={() => {
                            setOrbiting(true);
                            setFollowPreset(false);
                        }}
                        onEnd={() => {
                            setOrbiting(false);
                        }}
                    />
                )}
                {/* House zones editor (4 slots) */}
                {getDevFlag('editPropertyZones') && (
                    <HouseZonesOverlay S={topSize} dir={pathDirection} rot={indexRotation} />
                )}

                {/* Lights & Atmosphere */}
                <color attach="background" args={[L.background]} />
                {/* Mild distance fog to blend with site background */}
                {fogEnabled && <fog attach="fog" args={[L.background, worldSize * 2.2, worldSize * 4.0]} />}
                <ambientLight intensity={1} />
                <hemisphereLight color="#ffffff" groundColor="#cfd8dc" intensity={L.hemi} />
                <directionalLight
                    position={[6, 10, 6]}
                    intensity={L.key}
                    castShadow={shadowsEnabled}
                    shadow-mapSize-width={1024}
                    shadow-mapSize-height={1024}
                    shadow-camera-near={1}
                    shadow-camera-far={50}
                    shadow-camera-left={-12}
                    shadow-camera-right={12}
                    shadow-camera-top={12}
                    shadow-camera-bottom={-12}
                    shadow-radius={2}
                    shadow-bias={-0.0001}
                />
                <directionalLight position={[-6, 8, -6]} intensity={L.fill} />

                {/* Board */}
                <BoardBody size={worldSize} thickness={boardThickness} color={boardBodyColor} />
                <BoardRim size={worldSize} innerSize={topSize} height={rimHeight} color={rimColor} y={0.006} />
                {/* Dev zones overlay */}
                {(getDevFlag('showZones') || getDevFlag('editZones')) && (
                    <ZonesOverlay S={topSize} dir={pathDirection} rot={indexRotation} showLabels />
                )}
                {/* Optional ground receiver removed to avoid large wedges on some devices */}
                <Suspense fallback={null}>
                    <ClickableBoardPlane
                        size={topSize}
                        url={boardImageUrl || '/board.png'}
                        y={0.002}
                        onPointerDown={(e: any) => {
                            try {
                                const x = e.point.x as number
                                const z = e.point.z as number
                                const idx = tileIndexFromPosition(x, z, topSize, pathDirection, indexRotation)
                                if (HIGHLIGHT_EXCLUDED.has(idx)) return
                                // Build highlight zone and test containment just like hover
                                const base = tileRectFor(idx, topSize, pathDirection, indexRotation)
                                const tileKind = base.edge === 'corner' ? 0 : (FORCE_NON_PROP.has(idx) ? 2 : (isBuyableTile(idx) ? 1 : 2))
                                if (tileKind !== 1) return // only properties (incl. stations/utilities)

                                // only properties reach here
                                const defHZ: ZoneTx = { wScale: 1.03, dScale: 1.76 }
                                const savedHZ = (tzMap[String(idx)]?.hz || {}) as ZoneTx
                                const tx = { ...defHZ, ...savedHZ } as ZoneTx
                                const baseW = base.w, baseD = base.d
                                const wScale = (tx.wScale || 1), dScale = (tx.dScale || 1)
                                const sx = baseW * wScale
                                const sz = baseD * dScale
                                let cx = base.cx + (tx.dx || 0)
                                let cz = base.cz + (tx.dz || 0)
                                const dw = (sx - baseW) / 2
                                const dd = (sz - baseD) / 2
                                switch (base.edge) {
                                    case 'bottom': { cx += dw; cz += dd; break }
                                    case 'top': { cx += dw; cz -= dd; break }
                                    case 'left': { cz += dw; cx += dd; break }
                                    case 'right': { cz += dw; cx -= dd; break }
                                    default: break
                                }
                                const rotY = tx.rot || 0
                                const dx = x - cx
                                const dz = z - cz
                                const c = Math.cos(-rotY), s = Math.sin(-rotY)
                                const lx = dx * c - dz * s
                                const lz = dx * s + dz * c
                                const inside = Math.abs(lx) <= sx / 2 && Math.abs(lz) <= sz / 2
                                if (inside) { setOpenCardId(idx); e.stopPropagation() }
                            } catch { }
                        }}
                        onPointerMove={(e: any) => {
                            try {
                                const x = e.point.x as number
                                const z = e.point.z as number
                                const idx = tileIndexFromPosition(x, z, topSize, pathDirection, indexRotation)
                                // Build this tile's highlight zone rect (hz), merging defaults + saved
                                const base = tileRectFor(idx, topSize, pathDirection, indexRotation)
                                const tileKind = base.edge === 'corner' ? 0 : (FORCE_NON_PROP.has(idx) ? 2 : (isBuyableTile(idx) ? 1 : 2))
                                const defHZ: ZoneTx = (tileKind === 0) ? { wScale: 1.56, dScale: 1.56 }
                                    : (tileKind === 1) ? { wScale: 1.03, dScale: 1.76 }
                                        : { wScale: 1.02, dScale: 2.30 }
                                const savedHZ = (tzMap[String(idx)]?.hz || {}) as ZoneTx
                                const tx = { ...defHZ, ...savedHZ } as ZoneTx
                                const baseW = base.w, baseD = base.d
                                const wScale = (tx.wScale || 1), dScale = (tx.dScale || 1)
                                const sx = baseW * wScale
                                const sz = baseD * dScale
                                let cx = base.cx + (tx.dx || 0)
                                let cz = base.cz + (tx.dz || 0)
                                const dw = (sx - baseW) / 2
                                const dd = (sz - baseD) / 2
                                switch (base.edge) {
                                    case 'bottom': { cx += dw; cz += dd; break }
                                    case 'top': { cx += dw; cz -= dd; break }
                                    case 'left': { cz += dw; cx += dd; break }
                                    case 'right': { cz += dw; cx -= dd; break }
                                    default: break
                                }
                                const rotY = tx.rot || 0
                                // Transform pointer to zone-local coordinates and test containment
                                const dx = x - cx
                                const dz = z - cz
                                const c = Math.cos(-rotY), s = Math.sin(-rotY)
                                const lx = dx * c - dz * s
                                const lz = dx * s + dz * c
                                const inside = Math.abs(lx) <= sx / 2 && Math.abs(lz) <= sz / 2
                                const next = (inside && !HIGHLIGHT_EXCLUDED.has(idx)) ? idx : null
                                setHoverTile((prev) => (prev === next ? prev : next))
                            } catch { setHoverTile(null) }
                        }}
                        onPointerOut={() => setHoverTile((prev) => (prev == null ? prev : null))}
                        // Dev placement click: save intersections
                        onClick={(e: any) => {
                            try {
                                const devRef = (window as any)
                                const stRef = (devRef && devRef.__plState) as React.MutableRefObject<DevPlacementState> | undefined
                                const saveRef = (devRef && devRef.__plSave) as React.MutableRefObject<(tile: number, slot: number, x: number, z: number) => void> | undefined
                                if (!stRef?.current?.enabled || !saveRef) return
                                const p = e.point as THREE.Vector3
                                const x = p.x, z = p.z
                                const st = stRef.current
                                // Determine current tile in auto or locked mode (no auto-detect by click)
                                let tile = st.tileIndex != null
                                    ? st.tileIndex
                                    : (st.lastAutoTile != null ? st.lastAutoTile : 0)
                                if (st.tileIndex == null) st.lastAutoTile = tile
                                // Default zone when hitting tile 10 in auto mode
                                if (tile === 10 && (!st.zone || (st.zone !== 'v' && st.zone !== 'j'))) st.zone = 'v'
                                const zone = st.zone
                                const maxSlots = (tile === 10 && zone === 'v') ? 6 : (tile === 10 && zone === 'j') ? 4 : 4
                                const slot = st.slot
                                // Save
                                saveRef.current(tile, slot, x, z)
                                setDevMarkers(prev => { const n = prev.slice(-49); n.push([x, z]); return n })
                                // Advance slot
                                st.slot = (slot + 1) % maxSlots
                                // Auto-advance tile/zone sequence if unlocked tile and wrapped
                                if (st.tileIndex == null && st.slot === 0) {
                                    if (tile === 10 && zone === 'v') {
                                        // after 6, switch to jail 10j
                                        st.zone = 'j'
                                    } else if (tile === 10 && zone === 'j') {
                                        // after 4, move to 11 and clear zone
                                        st.lastAutoTile = 11
                                        st.zone = ''
                                    } else {
                                        // other tiles: after 4, go to next tile
                                        st.lastAutoTile = (tile + 1) % 40
                                        st.zone = (st.lastAutoTile === 10 ? 'v' : '')
                                    }
                                }
                                const keyLog = (tile === 10 && zone) ? `${tile}${zone}` : String(tile)
                                console.log('[Dev] placed:', { key: keyLog, tile, zone, slot, x, z })
                            } catch { }
                        }}
                    />
                </Suspense>

                {/* Hover highlight driven by tile highlight (hz) zones for all tiles */}
                {hoverTile != null && !HIGHLIGHT_EXCLUDED.has(hoverTile) && (() => {
                    const base = tileRectFor(hoverTile, topSize, pathDirection, indexRotation)
                    const tileKind = base.edge === 'corner' ? 0 : (FORCE_NON_PROP.has(hoverTile) ? 2 : (isBuyableTile(hoverTile) ? 1 : 2))
                    // Defaults as earlier
                    const defHZ: ZoneTx = (tileKind === 0) ? { wScale: 1.56, dScale: 1.56 }
                        : (tileKind === 1) ? { wScale: 1.03, dScale: 1.76 }
                            : { wScale: 1.02, dScale: 2.30 }
                    const savedHZ = (tzMap[String(hoverTile)]?.hz || {}) as ZoneTx
                    const tx = { ...defHZ, ...savedHZ } as ZoneTx
                    const baseW = base.w, baseD = base.d
                    const wScale = (tx.wScale || 1)
                    const dScale = (tx.dScale || 1)
                    const sx = baseW * wScale
                    const sz = baseD * dScale
                    let cx = base.cx + (tx.dx || 0)
                    let cz = base.cz + (tx.dz || 0)
                    const dw = (sx - baseW) / 2
                    const dd = (sz - baseD) / 2
                    switch (base.edge) {
                        case 'bottom': { cx += dw; cz += dd; break }
                        case 'top': { cx += dw; cz -= dd; break }
                        case 'left': { cz += dw; cx += dd; break }
                        case 'right': { cz += dw; cx -= dd; break }
                        default: break
                    }
                    const y = 0.004
                    const rotY = tx.rot || 0
                    return (
                        <group key={`hov-${hoverTile}`} position={[cx, y, cz]} rotation={[0, rotY, 0]}>
                            <HoverPulse x={0} z={0} y={0} sx={sx} sz={sz} trigger={hoverTile} />
                        </group>
                    )
                })()}

                {/* Tile zones dev overlay */}
                {tileZonesEnabled && (() => {
                    const tiles = Array.from({ length: 40 }, (_, i) => i)
                    return (
                        <group>
                            {tiles.map((ti) => {
                                const hvBase = tileRectFor(ti, topSize, pathDirection, indexRotation)
                                // Treat specific non-property tiles as type 2 for sizing
                                const forceNonProp = new Set<number>([5, 15, 25, 35, 12, 28, 2, 7, 17, 22, 33, 36, 4, 38])
                                const tileKind = hvBase.edge === 'corner' ? 0 : (forceNonProp.has(ti) ? 2 : (isBuyableTile(ti) ? 1 : 2))
                                const showPZ = twoZoneTiles.has(ti) && tileKind === 1
                                // Defaults from provided template snippet
                                const defHZ: ZoneTx = (tileKind === 0) ? { wScale: 1.56, dScale: 1.56 }
                                    : (tileKind === 1) ? { wScale: 1.03, dScale: 1.76 }
                                        : { wScale: 1.02, dScale: 2.30 }
                                const defPZ: ZoneTx | null = tileKind === 1 ? { wScale: 1.71, dScale: 1.33 } : null
                                const savedHZ = (tzMap[String(ti)]?.hz || {}) as ZoneTx
                                const savedPZ = (tzMap[String(ti)]?.pz || {}) as ZoneTx
                                const hzTx = { ...defHZ, ...savedHZ } as ZoneTx
                                const pzTx = defPZ ? ({ ...defPZ, ...savedPZ } as ZoneTx) : (savedPZ as ZoneTx)
                                const disp = displayTileNumber(ti)
                                const zones: Array<{ kind: ZoneKind; rect: { cx: number; cz: number; w: number; d: number; edge: Edge }; tx: ZoneTx; color: string; label: string }>
                                    = [{ kind: 'hz', rect: hvBase, tx: hzTx, color: '#60a5fa', label: `${disp}-hovered` }]
                                if (showPZ) zones.push({ kind: 'pz', rect: propertyRectFor(ti, topSize, pathDirection, indexRotation), tx: (pzTx || (defPZ as ZoneTx)), color: '#10b981', label: `${disp}-pz` })
                                return zones.map(({ kind, rect, tx, color, label }) => {
                                    const baseW = rect.w, baseD = rect.d
                                    const wScale = (tx.wScale || 1)
                                    const dScale = (tx.dScale || 1)
                                    const sx = baseW * wScale
                                    const sz = baseD * dScale
                                    // Start from base center plus manual offsets
                                    let cx = rect.cx + (tx.dx || 0)
                                    let cz = rect.cz + (tx.dz || 0)
                                    // Grow only to one side by shifting the center
                                    const dw = (sx - baseW) / 2
                                    const dd = (sz - baseD) / 2
                                    switch (rect.edge) {
                                        case 'bottom': {
                                            // width grows toward +X, depth grows inward (+Z)
                                            cx += dw; cz += dd; break
                                        }
                                        case 'top': {
                                            // width grows toward +X, depth grows inward (-Z)
                                            cx += dw; cz -= dd; break
                                        }
                                        case 'left': {
                                            // width grows toward +Z, depth grows inward (+X)
                                            cz += dw; cx += dd; break
                                        }
                                        case 'right': {
                                            // width grows toward +Z, depth grows inward (-X)
                                            cz += dw; cx -= dd; break
                                        }
                                        default: break
                                    }
                                    const y = 0.005
                                    const selected = selZone && selZone.tile === ti && selZone.kind === kind
                                    const rotY = tx.rot || 0
                                    return (
                                        <group key={`${ti}-${kind}`} position={[cx, y, cz]} rotation={[0, rotY, 0]}>
                                            {/* Zone plane */}
                                            <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}
                                                onPointerDown={(e: any) => { e.stopPropagation(); setSelZone({ tile: ti, kind }) }}
                                            >
                                                <planeGeometry args={[sx, sz]} />
                                                <meshBasicMaterial color={color} transparent opacity={selected ? 0.35 : 0.22} depthWrite={false} />
                                            </mesh>
                                            {/* Outline */}
                                            <mesh position={[0, 0.0001, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={4}>
                                                <planeGeometry args={[sx, sz]} />
                                                <meshBasicMaterial color={selected ? '#ffffff' : '#111827'} wireframe transparent opacity={0.6} depthWrite={false} />
                                            </mesh>
                                            {/* Label */}
                                            <Html center distanceFactor={12} position={[0, 0.0015, 0]}>
                                                <div style={{ background: 'rgba(0,0,0,0.55)', color: 'white', padding: '2px 6px', fontSize: 11, borderRadius: 6 }}>{label}</div>
                                            </Html>
                                        </group>
                                    )
                                })
                            })}
                        </group>
                    )
                })()}

                {/* Current hop highlight (white, bounce-synced) and drop flash */}
                {(() => {
                    const entries = Object.entries(currentHopTileRef.current)
                    if (!entries.length) return null
                    const groups: ReactNode[] = []
                    for (const [pid, ti] of entries) {
                        if (typeof ti === 'number') {
                            const base = tileRectFor(ti, topSize, pathDirection, indexRotation)
                            const tileKind = base.edge === 'corner' ? 0 : (FORCE_NON_PROP.has(ti) ? 2 : (isBuyableTile(ti) ? 1 : 2))
                            const defHZ: ZoneTx = (tileKind === 0) ? { wScale: 1.56, dScale: 1.56 }
                                : (tileKind === 1) ? { wScale: 1.03, dScale: 1.76 }
                                    : { wScale: 1.02, dScale: 2.30 }
                            const savedHZ = (tzMap[String(ti)]?.hz || {}) as ZoneTx
                            const tx = { ...defHZ, ...savedHZ } as ZoneTx
                            const baseW = base.w, baseD = base.d
                            const wScale = (tx.wScale || 1)
                            const dScale = (tx.dScale || 1)
                            const sx = baseW * wScale
                            const sz = baseD * dScale
                            let cx = base.cx + (tx.dx || 0)
                            let cz = base.cz + (tx.dz || 0)
                            const dw = (sx - baseW) / 2
                            const dd = (sz - baseD) / 2
                            switch (base.edge) {
                                case 'bottom': { cx += dw; cz += dd; break }
                                case 'top': { cx += dw; cz -= dd; break }
                                case 'left': { cz += dw; cx += dd; break }
                                case 'right': { cz += dw; cx -= dd; break }
                                default: break
                            }
                            const y = 0.004
                            const rotY = tx.rot || 0
                            const getPhase = () => routePhaseRef.current[pid]
                            groups.push(
                                <group key={`hop-${pid}-${ti}`} position={[cx, y, cz]} rotation={[0, rotY, 0]}>
                                    <PhasePulse
                                        x={0}
                                        z={0}
                                        y={0}
                                        sx={sx}
                                        sz={sz}
                                        getPhase={getPhase}
                                    />
                                </group>
                            );
                        }
                        // drop flash (short fade after landing)
                        const flash = routeFlashRef.current[pid]
                        if (flash && (typeof performance !== 'undefined' ? performance.now() : Date.now()) < flash.until) {
                            const ti = flash.tile
                            const base = tileRectFor(ti, topSize, pathDirection, indexRotation)
                            const tileKind = base.edge === 'corner' ? 0 : (FORCE_NON_PROP.has(ti) ? 2 : (isBuyableTile(ti) ? 1 : 2))
                            const defHZ: ZoneTx = (tileKind === 0) ? { wScale: 1.56, dScale: 1.56 }
                                : (tileKind === 1) ? { wScale: 1.03, dScale: 1.76 }
                                    : { wScale: 1.02, dScale: 2.30 }
                            const savedHZ = (tzMap[String(ti)]?.hz || {}) as ZoneTx
                            const tx = { ...defHZ, ...savedHZ } as ZoneTx
                            const baseW = base.w, baseD = base.d
                            const wScale = (tx.wScale || 1)
                            const dScale = (tx.dScale || 1)
                            const sx = baseW * wScale
                            const sz = baseD * dScale
                            let cx = base.cx + (tx.dx || 0)
                            let cz = base.cz + (tx.dz || 0)
                            const dw = (sx - baseW) / 2
                            const dd = (sz - baseD) / 2
                            switch (base.edge) {
                                case 'bottom': { cx += dw; cz += dd; break }
                                case 'top': { cx += dw; cz -= dd; break }
                                case 'left': { cz += dw; cx += dd; break }
                                case 'right': { cz += dw; cx -= dd; break }
                                default: break
                            }
                            const y = 0.004
                            const rotY = tx.rot || 0
                            const getRemaining = () => {
                                const now = (typeof performance !== 'undefined' ? performance.now() : Date.now())
                                const rem = (flash.until - now) / (flash.duration || 200)
                                return Math.max(0, Math.min(1, rem))
                            }
                            groups.push(
                                <group key={`flash-${pid}-${ti}`} position={[cx, y, cz]} rotation={[0, rotY, 0]}>
                                    <FlashFade x={0} z={0} y={0} sx={sx} sz={sz} getRemaining={getRemaining} color="#ffffff" maxOpacity={0.50} />
                                </group>
                            )
                        }
                    }
                    return <group>{groups}</group>
                })()}

                {/* Tokens */}
                {!getDevFlag('disableTokens') && plist.map((p, idx) => {
                    const tileIndex = (p.position + (displayOffset % 40) + 40) % 40
                    const orderIdx = order ? order.indexOf(p.id) : -1
                    const slot = Math.max(0, Math.min(7, orderIdx >= 0 ? orderIdx : 0))
                    const cfg = models[p.id]
                    if (!cfg?.url) return <group key={p.id} /> // no model

                    // Use the most recently observed tile (from lastTileRef) if available.
                    // Fallback to prevTileRef (committed previous tile) or the current tileIndex.
                    const prev =
                        prevTileRef.current[p.id] ??
                        lastSeenTileRef.current[p.id] ??
                        tileIndex;
                    const debugOn = getDevFlag('debugRoutes' as any)
                    // Hop direction should be opposite of the board path direction
                    const routeDir: PathDirection = (pathDirection === 'clockwise') ? 'counterclockwise' : 'clockwise'


                    // Build a step at any tile index (final step may apply overrides/aliases)
                    const makeStep = (ti: number, isFinal: boolean): RouteStep => {
                        const sourceIndex = isFinal ? (placementAliases?.[ti] ?? ti) : ti
                        const ov = isFinal ? placementOverrides?.[sourceIndex]?.[slot] : undefined
                        const nameKey = nameKeyFromUrl(cfg.url)
                        const zoneTag: 'v' | 'j' | undefined = (ti === 10) ? (p.inJail ? 'j' : 'v') : undefined
                        const [px, pz] = (ov && sourceIndex !== 10)
                            ? ov
                            : positionFor(ti, slot, topSize, pathDirection, indexRotation, zoneTag)
                        const py = tokenBaseY + (cfg.y ?? 0) + (cfg.offsetY ?? 0) + getGapY(nameKey)
                        const txFor = getTxForTile(sourceIndex, zoneTag)
                        const slotRot = (txFor?.slots?.[String(slot)] && (txFor.slots![String(slot)][2] || 0)) || 0
                        const faceDir: PathDirection = isFinal ? pathDirection : routeDir
                        const yaw = yawToward(ti, worldSize, faceDir, indexRotation) + (txFor?.yaw || 0) + slotRot
                        return { to: [px, py, pz] as [number, number, number], yaw }
                    }

                    // If not already moving, (re)compute a route from prev -> tileIndex
                    const hasActiveRoute = (routeCacheRef.current[p.id] || []).length > 0
                    if (!hasActiveRoute) {
                        // Skip zero-hop moves entirely
                        if (prev === tileIndex) {
                            // small dev log when debugRoutes enabled (guarded)
                            if (debugOn) logRoute(p.id, prev, tileIndex, 0)
                        } else {
                            // Avoid re-processing the same target twice
                            const lastProcessed = lastProcessedTargetRef.current[p.id]
                            if (lastProcessed === tileIndex) {
                                // already queued/processed this target; skip
                            } else {
                                const seq = indicesBetween(prev, tileIndex, routeDir)
                                const startStep = makeStep(prev, false)
                                const finalStep = makeStep(tileIndex, true)
                                // Build intermediate route steps (use movement heading for intermediate steps)
                                const route: RouteStep[] = seq.map((ti) => makeStep(ti, false))
                                if (route.length) route[route.length - 1] = finalStep

                                // Compute per-step heading (from previous step -> this step) for intermediate steps
                                // so debug markers and queued yaw values represent travel direction.
                                try {
                                    let prevPos = startStep.to
                                    for (let i = 0; i < route.length; i++) {
                                        if (i < route.length - 1) {
                                            const to = route[i].to
                                            // yaw = atan2(dx, dz) (consistent with movement math in animator)
                                            route[i].yaw = Math.atan2(to[0] - prevPos[0], to[2] - prevPos[2])
                                            prevPos = to
                                        } else {
                                            // keep final step's curated tile yaw (finalStep.yaw)
                                        }
                                    }
                                } catch { }

                                // Seed caches and set pre-route delay so dice result is visible
                                const now = (typeof performance !== 'undefined' ? performance.now() : Date.now())
                                routeCacheRef.current[p.id] = route
                                fromCacheRef.current[p.id] = startStep.to
                                yawFromCacheRef.current[p.id] = startStep.yaw
                                routeStartAtRef.current[p.id] = now + Math.max(0, routeStartDelayMs)
                                // Queue start callback to run after commit (avoid setState in render)
                                pendingStartRef.current.add(p.id)
                                // Snapshot hop steps at route creation to keep them stable during UI updates
                                try {
                                    const baseSteps: HopStep[] = [
                                        { to: [startStep.to[0], startStep.to[1], startStep.to[2]], yaw: startStep.yaw },
                                        ...route.map((s) => ({ to: [s.to[0], s.to[1], s.to[2]] as [number, number, number], yaw: s.yaw })),
                                    ]
                                    const hops: HopStep[] = baseSteps.map((s) => ({ to: [s.to[0], s.to[1], s.to[2]] as [number, number, number], yaw: s.yaw }))
                                    for (let i = 0; i < hops.length - 1; i++) {
                                        const a = hops[i], b = hops[i + 1]
                                        a.yaw = Math.atan2(b.to[0] - a.to[0], b.to[2] - a.to[2])
                                    }
                                    // Preserve final tile yaw for the last hop
                                    if (hops.length) hops[hops.length - 1].yaw = finalStep.yaw
                                    hopStepsRef.current[p.id] = hops
                                    // Record GO breakpoint segment (if we will arrive at tile 0 along the path)
                                    try {
                                        const goIdxInSeq = seq.indexOf(0)
                                        if (goIdxInSeq >= 0) {
                                            hopBreakRef.current[p.id] = { goSeg: goIdxInSeq, fired: false }
                                        } else {
                                            hopBreakRef.current[p.id] = { goSeg: undefined, fired: false }
                                        }
                                    } catch { hopBreakRef.current[p.id] = { goSeg: undefined, fired: false } }
                                } catch { }
                                // Mark processed target so we don't enqueue it again
                                lastProcessedTargetRef.current[p.id] = tileIndex

                                if (debugOn) {
                                    const seqLog = seq.join(' -> ')
                                    logRoute(p.id, prev, tileIndex, seq.length)
                                    // additional verbose trace once per change
                                    console.log(`[route ${p.name}] ${seqLog}`)
                                }
                            }
                        }
                    }

                    const route = routeCacheRef.current[p.id] || []
                    const startFrom = fromCacheRef.current[p.id] || makeStep(tileIndex, true).to
                    const startYaw = yawFromCacheRef.current[p.id] ?? makeStep(tileIndex, true).yaw
                    const idle = makeStep(tileIndex, true)
                    // Use cached hop steps and start time captured at route creation
                    const hopSteps: HopStep[] = hopStepsRef.current[p.id] || []
                    const hopStartAt = routeStartAtRef.current[p.id] ?? (typeof performance !== 'undefined' ? performance.now() : Date.now())
                    // pass-go event scheduling handled via onSegmentEnd + hopBreakRef

                    const fallback = showFallbackSpheres ? (
                        <group position={idle.to}>
                            <mesh castShadow>
                                <sphereGeometry args={[0.18, 24, 24]} />
                                <meshStandardMaterial color={TOKEN_COLORS[idx % TOKEN_COLORS.length]} metalness={0.05} roughness={0.6} />
                            </mesh>
                            {showLabels && (
                                <Html center distanceFactor={12}>
                                    <div style={{ background: 'rgba(0,0,0,0.6)', color: 'white', padding: '2px 6px', fontSize: 12, borderRadius: 6, whiteSpace: 'nowrap' }}>
                                        {p.name}
                                    </div>
                                </Html>
                            )}
                        </group>
                    ) : null

                    return (
                        <Suspense key={p.id} fallback={fallback}>
                            {/* idle OR animated */}
                            {(() => {
                                const cine = jailCineRef.current[p.id]
                                if (cine) {
                                    const orderIdx = order ? order.indexOf(p.id) : -1
                                    const slot = Math.max(0, Math.min(7, orderIdx >= 0 ? orderIdx : 0))
                                    const S = topSize
                                    const dir = pathDirection
                                    const rot = indexRotation
                                    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now())
                                    const dt = Math.max(0, now - cine.t0)
                                    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
                                    const easeInCubic = (t: number) => Math.pow(t, 3)
                                    if (cine.phase === 'out') {
                                        const startTile = 30
                                        const [x, z] = positionFor(startTile, slot, S, dir, rot)
                                        const yBase = tokenPositions[p.id]?.[1] ?? tokenBaseY
                                        const t = Math.min(1, dt / 600)
                                        const y = yBase + easeOutCubic(t) * 1.0
                                        const alpha = 1 - t
                                        if (t >= 1) {
                                            try { onGoToJail?.(p.id) } catch { }
                                            setJailCine(p.id, { phase: 'wait', t0: (typeof performance !== 'undefined' ? performance.now() : Date.now()), startTile })
                                        }
                                        return (
                                            <group position={[x, y, z]} rotation={[0, yawToward(startTile, S, dir, rot), 0]}>
                                                <TokenMesh cfg={cfg} position={[0, 0, 0]} yaw={0} alpha={alpha} />
                                            </group>
                                        )
                                    }
                                    if (cine.phase === 'wait') {
                                        if (dt >= 400 && p.inJail && ((p.position + (displayOffset % 40) + 40) % 40) === 10) {
                                            setJailCine(p.id, { phase: 'in', t0: (typeof performance !== 'undefined' ? performance.now() : Date.now()), startTile: cine.startTile })
                                        }
                                        return null
                                    }
                                    const destTile = 10
                                    const zoneTag: 'v' | 'j' | undefined = jailZoneTag(destTile, p)
                                    const [dx, dz] = positionFor(destTile, slot, S, dir, rot, zoneTag)
                                    const yBase = tokenPositions[p.id]?.[1] ?? tokenBaseY
                                    const t = Math.min(1, dt / 500)
                                    const y = yBase + (1.0 - easeInCubic(t)) * 1.0
                                    const alpha = Math.min(1, t)
                                    if (t >= 1) setJailCine(p.id, undefined)
                                    const tx = getTxForTile(destTile, zoneTag)
                                    const slotArr = tx?.slots?.[String(slot)]
                                    const slotRot = (slotArr && slotArr[2]) ? slotArr[2] : 0
                                    const yaw = yawToward(destTile, S, dir, rot) + (tx?.yaw || 0) + slotRot
                                    return (
                                        <group position={[dx, y, dz]} rotation={[0, yaw, 0]}>
                                            <TokenMesh cfg={cfg} position={[0, 0, 0]} yaw={0} alpha={alpha} />
                                        </group>
                                    )
                                }
                                return null
                            })()}
                            {!jailCineRef.current[p.id] && (
                                (hopSteps.length >= 2) ? (
                                    <HopAnimator steps={hopSteps} startAt={hopStartAt}
                                        stepMs={260}
                                        hopHeight={0.40}
                                        lastStepScale={2}
                                        lastHopScale={2}
                                        onSegmentEnd={(seg) => {
                                            try {
                                                const bp = hopBreakRef.current[p.id]
                                                if (bp && !bp.fired && bp.goSeg != null && seg === bp.goSeg) {
                                                    bp.fired = true
                                                    window.dispatchEvent(new CustomEvent('monopoly:passGo', { detail: { playerId: p.id } }))
                                                }
                                            } catch { }
                                        }}
                                        onStart={() => { try { movingRef.current.add(p.id); setGlobalRouteActive(); onTokenRouteStart?.(p.id) } catch { } }}
                                        onDone={() => {
                                            try {
                                                // Commit final tile and clear moving flag
                                                prevTileRef.current[p.id] = tileIndex;
                                                movingRef.current.delete(p.id);
                                                setGlobalRouteActive();
                                                // Clear cached route so future moves can rebuild fresh timing/state
                                                routeCacheRef.current[p.id] = [];
                                                delete hopStepsRef.current[p.id];
                                                delete routeStartAtRef.current[p.id];
                                                delete fromCacheRef.current[p.id as any];
                                                delete yawFromCacheRef.current[p.id as any];
                                                (onTokenRouteComplete as any)?.({ playerId: p.id, tileIndex })
                                            } catch { }
                                        }}
                                    >
                                        <TokenMesh cfg={cfg} position={[0, 0, 0]} yaw={0} />
                                    </HopAnimator>
                                ) : (
                                    <group position={idle.to} rotation={[0, idle.yaw, 0]}>
                                        <TokenMesh cfg={cfg} position={[0, 0, 0]} yaw={0} />
                                    </group>
                                )
                            )}
                        </Suspense>
                    )
                })}



                {/* If tokens are disabled via dev flag, still show fallback spheres when requested */}
                {getDevFlag('disableTokens') && showFallbackSpheres && plist.map((p, idx) => {
                    const tileIndex = (p.position + (displayOffset % 40) + 40) % 40
                    const orderIdx = order ? order.indexOf(p.id) : -1
                    const slot = Math.max(0, Math.min(7, orderIdx >= 0 ? orderIdx : 0))
                    const sourceIndex = placementAliases?.[tileIndex] ?? tileIndex
                    const ov = placementOverrides?.[sourceIndex]?.[slot]
                    const zoneTag: 'v' | 'j' | undefined = jailZoneTag(tileIndex, p)
                    const [x, z] = ov ? ov : positionFor(tileIndex, slot, topSize, pathDirection, indexRotation, zoneTag)
                    return (
                        <group key={`disabled-${p.id}`} position={[x, tokenBaseY, z]}>
                            <mesh castShadow>
                                <sphereGeometry args={[0.18, 24, 24]} />
                                <meshStandardMaterial color={TOKEN_COLORS[idx % TOKEN_COLORS.length]} metalness={0.05} roughness={0.6} />
                            </mesh>
                            {showLabels && (
                                <Html center distanceFactor={12}>
                                    <div style={{ background: 'rgba(0,0,0,0.6)', color: 'white', padding: '2px 6px', fontSize: 12, borderRadius: 6, whiteSpace: 'nowrap' }}>{p.name}</div>
                                </Html>
                            )}
                        </group>
                    )
                })}
                {/* Dev click markers */}
                {devMarkers && devMarkers.length > 0 && (
                    <group>
                        {devMarkers.map(([mx, mz], i) => (
                            <mesh key={`mark-${i}`} position={[mx, 0.004, mz]}>
                                <sphereGeometry args={[0.03, 12, 12]} />
                                <meshBasicMaterial color="#ff0000" />
                            </mesh>
                        ))}
                    </group>
                )}                {/* Extra scene content (e.g., animated dice) */}
                {children}
            </Canvas>
            <div className='modernButtonContainer'
                style={{
                    position: 'absolute',
                    top: 27,
                    right: 27,
                    zIndex: 60,
                    pointerEvents: 'auto',
                    display: 'flex',
                    gap: 8,
                    background: 'transparent',
                    border: '0px solid rgba(255,255,255,0.16)',
                    borderRadius: '50%',
                    backdropFilter: getDevFlag('disableBackdropBlur') ? 'none' : 'blur(25px)'
                }}
            >
                <Tippy content={isFullscreen ? 'Tam Ekrandan Çık' : 'Tam Ekran'}
                    followCursor={true}
                    plugins={[followCursor]}
                    offset={isFullscreen ? [-70, -50] : [65, -50]}
                    arrow={false}
                    appendTo={() => document.querySelector('#game') || document.body}
                    theme="custom">
                    <button id='fullscreenButton' className={'no-style modernButton'} onClick={onToggleFullscreen}>
                        {!isFullscreen ?
                            <svg viewBox="0 0 24 24">
                                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 
            7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                            </svg>
                            : <svg viewBox="0 0 24 24">
                                <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 
            11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
                            </svg>}
                    </button>
                </Tippy>

            </div>

            <div className='modernButtonContainer'
                style={{
                    position: 'absolute',
                    top: 27,
                    left: 30,
                    zIndex: 60,
                    pointerEvents: 'auto',
                    display: 'flex',
                    gap: 8,
                    background: 'transparent',
                    border: '0px solid rgba(255,255,255,0.16)',
                    borderRadius: '50%',
                    width: 40,
                    height: 40,

                    backdropFilter: getDevFlag('disableBackdropBlur') ? 'none' : 'blur(25px)'
                }}
            >
                <Tippy content={'Seçenekler'}
                    followCursor={true}
                    plugins={[followCursor]}
                    offset={[70, -50]}
                    arrow={false}
                    appendTo={() => document.querySelector('#game') || document.body}
                    theme="custom">
                    <button id='optionsButton' className={'no-style modernButton'}>
                        <svg viewBox="0 0 24 24">

                            <path d="M10 6a2 2 0 1 0 4 0a2 2 0 1 0-4 0zm0 6a2 2 0 1 0 4 0a2 2 0 1 0-4 0zm0 6a2 2 0 1 0 4 0a2 2 0 1 0-4 0z" />
                        </svg>

                    </button>
                </Tippy>
            </div>

            <div className='modernButtonContainer'
                style={{
                    position: 'absolute',
                    top: isFullscreen ? 75 * 1.2 : 75,
                    left: isFullscreen ? 30 * 0.7 : 30,
                    zIndex: 60,
                    pointerEvents: 'auto',
                    display: 'flex',
                    gap: 8,
                    background: 'transparent',
                    border: '0px solid rgba(255,255,255,0.16)',
                    borderRadius: '50%',
                    width: isFullscreen ? 40 * 1.5 : 40,
                    height: isFullscreen ? 40 * 1.5 : 40,
                    backdropFilter: getDevFlag('disableBackdropBlur') ? 'none' : 'blur(25px)'
                }}
            >
                <Tippy content={'Ev Al'}
                    followCursor={true}
                    plugins={[followCursor]}
                    offset={[50, -50]}
                    arrow={false}
                    appendTo={() => document.querySelector('#game') || document.body}
                    theme="custom">
                    <button className={'no-style modernButton'} style={{
                        width: isFullscreen ? 40 * 1.5 : 40,
                        height: isFullscreen ? 40 * 1.5 : 40,
                    }}>
                        <img src={BuyHouseIcon.src} alt="Ev Al" className="icon" style={{
                            width: isFullscreen ? 24 * 1.5 : 24, height: 'auto'
                        }} />
                    </button>
                </Tippy>
            </div>

            <div className='modernButtonContainer'
                style={{
                    position: 'absolute',
                    // top: 108,
                    // left: 65,
                    top: isFullscreen ? 123 * 1.3 : 123,
                    left: isFullscreen ? 30 * 0.7 : 30,
                    zIndex: 60,
                    pointerEvents: 'auto',
                    display: 'flex',
                    gap: 8,
                    background: 'transparent',
                    border: '0px solid rgba(255,255,255,0.16)',
                    borderRadius: '50%',
                    width: isFullscreen ? 40 * 1.5 : 40,
                    height: isFullscreen ? 40 * 1.5 : 40,

                    backdropFilter: getDevFlag('disableBackdropBlur') ? 'none' : 'blur(25px)'
                }}
            >
                <Tippy content={'Ev Sat'}
                    followCursor={true}
                    plugins={[followCursor]}
                    offset={[55, -50]}
                    arrow={false}
                    appendTo={() => document.querySelector('#game') || document.body}
                    theme="custom">
                    <button className={'no-style modernButton'} style={{
                        width: isFullscreen ? 40 * 1.5 : 40,
                        height: isFullscreen ? 40 * 1.5 : 40,
                    }}>
                        <img src={SellHouseIcon.src} alt="Ev Sat" className="icon" style={{
                            width: isFullscreen ? 24 * 1.5 : 24, height: 'auto'
                        }} />
                    </button>
                </Tippy>
            </div>

            <div className='modernButtonContainer'
                style={{
                    position: 'absolute',
                    // top: 108,
                    // left: 65,
                    top: isFullscreen ? 171 * 1.35 : 171,
                    left: isFullscreen ? 30 * 0.7 : 30,
                    zIndex: 60,
                    pointerEvents: 'auto',
                    display: 'flex',
                    gap: 8,
                    background: 'transparent',
                    border: '0px solid rgba(255,255,255,0.16)',
                    borderRadius: '50%',
                    width: isFullscreen ? 40 * 1.5 : 40,
                    height: isFullscreen ? 40 * 1.5 : 40,

                    backdropFilter: getDevFlag('disableBackdropBlur') ? 'none' : 'blur(25px)'
                }}
            >
                <Tippy content={'Teklif Yap'}
                    followCursor={true}
                    plugins={[followCursor]}
                    offset={[65, -50]}
                    arrow={false}
                    appendTo={() => document.querySelector('#game') || document.body}
                    theme="custom">
                    <button
                        className={'no-style modernButton'}
                        onClick={onOpenTradeModal}
                        style={{
                            width: isFullscreen ? 40 * 1.5 : 40,
                            height: isFullscreen ? 40 * 1.5 : 40,
                        }}>

                        <TbCards color='black' size={isFullscreen ? 1.5 * 24 : 24} />
                    </button>
                </Tippy>
            </div>

            <div className='modernButtonContainer'
                style={{
                    position: 'absolute',
                    // top: 60,
                    // right: 12,
                    top: isFullscreen ? 75 * 1.2 : 75,
                    right: isFullscreen ? 27 * 0.6 : 27,
                    zIndex: 60,
                    pointerEvents: 'auto',
                    display: 'flex',
                    gap: 8,
                    background: 'transparent',
                    border: '0px solid rgba(255,255,255,0.16)',
                    borderRadius: '50%',
                    width: isFullscreen ? 40 * 1.5 : 40,
                    height: isFullscreen ? 40 * 1.5 : 40,

                    backdropFilter: getDevFlag('disableBackdropBlur') ? 'none' : 'blur(25px)'
                }}
            >
                <Tippy content={'Otel Al'}
                    followCursor={true}
                    plugins={[followCursor]}
                    offset={isFullscreen ? [-40, -50] : [55, -50]}
                    arrow={false}
                    appendTo={() => document.querySelector('#game') || document.body}
                    theme="custom">
                    <button className={'no-style modernButton'} style={{
                        width: isFullscreen ? 40 * 1.5 : 40,
                        height: isFullscreen ? 40 * 1.5 : 40,
                    }}>
                        <img src={BuyHotelIcon.src} alt="Otel Al" className="icon" style={{
                            width: isFullscreen ? 24 * 1.5 : 24, height: 'auto'
                        }} />
                    </button>
                </Tippy>
            </div>

            <div className='modernButtonContainer'
                style={{
                    position: 'absolute',
                    // top: 108,
                    // right: 12,
                    top: isFullscreen ? 123 * 1.3 : 123,
                    right: isFullscreen ? 27 * 0.6 : 27,
                    zIndex: 60,
                    pointerEvents: 'auto',
                    display: 'flex',
                    gap: 8,
                    background: 'transparent',
                    border: '0px solid rgba(255,255,255,0.16)',
                    borderRadius: '50%',
                    width: isFullscreen ? 40 * 1.5 : 40,
                    height: isFullscreen ? 40 * 1.5 : 40,

                    backdropFilter: getDevFlag('disableBackdropBlur') ? 'none' : 'blur(25px)'
                }}
            >
                <Tippy content={'Otel Sat'}
                    followCursor={true}
                    plugins={[followCursor]}
                    offset={isFullscreen ? [-40, -50] : [60, -50]}
                    arrow={false}
                    appendTo={() => document.querySelector('#game') || document.body}
                    theme="custom">
                    <button className={'no-style modernButton'} style={{
                        width: isFullscreen ? 40 * 1.5 : 40,
                        height: isFullscreen ? 40 * 1.5 : 40,
                    }}>
                        <img src={SellHotelIcon.src} alt="Otel Sat" className="icon" style={{
                            width: isFullscreen ? 24 * 1.5 : 24, height: 'auto'
                        }} />
                    </button>
                </Tippy>
            </div>

            <div className='modernButtonContainer'
                style={{
                    position: 'absolute',
                    // top: 108,
                    // right: 12,
                    top: isFullscreen ? 171 * 1.35 : 171,
                    right: isFullscreen ? 27 * 0.6 : 27,
                    zIndex: 60,
                    pointerEvents: 'auto',
                    display: 'flex',
                    gap: 8,
                    background: 'transparent',
                    border: '0px solid rgba(255,255,255,0.16)',
                    borderRadius: '50%',
                    width: isFullscreen ? 40 * 1.5 : 40,
                    height: isFullscreen ? 40 * 1.5 : 40,

                    backdropFilter: getDevFlag('disableBackdropBlur') ? 'none' : 'blur(25px)'
                }}
            >
                <Tippy content={'İpotek Yap'}
                    followCursor={true}
                    plugins={[followCursor]}
                    offset={isFullscreen ? [-45, -50] : [70, -50]}
                    arrow={false}
                    appendTo={() => document.querySelector('#game') || document.body}
                    theme="custom">
                    <button className={'no-style modernButton'} style={{
                        width: isFullscreen ? 40 * 1.5 : 40,
                        height: isFullscreen ? 40 * 1.5 : 40,
                    }}>
                        <img
                            src={MortgageIcon.src}
                            alt="İpotek Yap"
                            className="icon"
                            width={isFullscreen ? 24 * 1.5 : 24}
                            height={isFullscreen ? 24 * 1.5 : 24}
                        />
                    </button>
                </Tippy>
            </div>


            {/* Overlay (2D) children inside the scene container */}
            {overlayChildren && (
                <div style={{ position: 'absolute', left: 0, right: 0, top: 8, display: 'flex', justifyContent: 'center', zIndex: 30, pointerEvents: 'none' }}>
                    {overlayChildren}
                </div>
            )}
            {/* Players strip HUD over the map (hidden until game starts) */}
            {showHud && (
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '0 12px', zIndex: 25, pointerEvents: 'auto' }}>
                    <PlayersStrip players={players as any} order={order as any} currentId={currentPlayerId} activityKey={activityKey} onCardRectsChange={onCardRectsChange} isFullscreen={isFullscreen as any} onInitiateTrade={onInitiateTrade} />
                </div>
            )}
            {/* Fullscreen 3D property card viewer over a blue background */}
            {openCardId != null && (
                <PropertyCardModal3D id={openCardId as number} onClose={() => setOpenCardId(null)} />
            )}
        </div>
    )
}

export default memo(Board3D)












