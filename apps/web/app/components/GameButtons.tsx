'use client'
import React, { useMemo, useState } from 'react'
import { Dices, Flag } from 'lucide-react'

type Props = {
  canRoll: boolean
  canEndTurn: boolean
  onRoll: () => void
  onEndTurn: () => void
  showAuction?: boolean
  accentColor?: string
}

/* tiny color utils */
const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
const hexToRgb = (hex: string) => {
  const m = String(hex).trim().replace('#', '')
  if (m.length === 3) return { r: parseInt(m[0] + m[0], 16), g: parseInt(m[1] + m[1], 16), b: parseInt(m[2] + m[2], 16) }
  if (m.length === 6) return { r: parseInt(m.slice(0, 2), 16), g: parseInt(m.slice(2, 4), 16), b: parseInt(m.slice(4, 6), 16) }
  return null
}
const rgbToHex = (r: number, g: number, b: number) => {
  const h = (n: number) => n.toString(16).padStart(2, '0')
  const c = (v: number) => Math.max(0, Math.min(255, v))
  return `#${h(Math.round(c(r)))}${h(Math.round(c(g)))}${h(Math.round(c(b)))}`
}
const lighten = (hex: string, amt: number) => {
  const c = hexToRgb(hex); if (!c) return hex
  const t = clamp01(amt)
  return rgbToHex(c.r + (255 - c.r) * t, c.g + (255 - c.g) * t, c.b + (255 - c.b) * t)
}
const darken = (hex: string, amt: number) => {
  const c = hexToRgb(hex); if (!c) return hex
  const t = clamp01(amt)
  return rgbToHex(c.r * (1 - t), c.g * (1 - t), c.b * (1 - t))
}
const luminance = (hex: string) => {
  const c = hexToRgb(hex); if (!c) return 0.5
  const s = [c.r, c.g, c.b].map(v => {
    const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2]
}

/* Reusable metallic action button */
export function MetallicActionButton({
  label,
  icon,
  onClick,
  accentColor = '#3b82f6',
  width,  // optional fixed width for the shell
  disabled = false,
}: {
  label: string
  icon: React.ReactNode
  onClick: () => void
  accentColor?: string
  width?: number
  disabled?: boolean
}) {

  const OUTER_HEIGHT = 40
  const RING = 3               // ring thickness
  const RADIUS = 999
  const METAL_BASE = '#b9c1cb'

  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)
  const [focused, setFocused] = useState(false)

  const light = useMemo(() => lighten(accentColor, 0.38), [accentColor])
  const dark = useMemo(() => darken(accentColor, 0.25), [accentColor])
  const textOnAccent = useMemo(() => (luminance(light) > 0.65 ? '#111827' : '#ffffff'), [light])

  // OUTER SHELL
  const shell: React.CSSProperties = {
    position: 'relative',
    display: 'flex',             // (inline-flex -> flex) so width:100% works within the column
    alignItems: 'center',
    justifyContent: 'center',
    height: OUTER_HEIGHT,
    padding: RING,
    boxSizing: 'border-box',
    borderRadius: RADIUS,
    overflow: 'hidden',
    isolation: 'isolate',
    width: '100%',               // <- stretch to the parent’s width
    transform: pressed ? 'translateY(1px) scale(0.985)' : hovered ? 'translateY(-1px)' : 'translateY(0)',
    transition: 'transform 120ms ease',
  }

  // METALLIC UNDERLAY — separate element; never mutate its background
  const metalUnderlay: React.CSSProperties & {
    ['--metal']?: string
    ['--convexity']?: number | string
  } = {
    position: 'absolute',
    inset: 0,
    borderRadius: RADIUS,
    backgroundColor: METAL_BASE,
    ['--metal']: 'silver',
    ['--convexity']: 12,
    pointerEvents: 'none',
    zIndex: 0,
  }

  // INNER PILL
  const innerBtn: React.CSSProperties = {
    position: 'relative',
    zIndex: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',    // <- keep content centered
    gap: 8,
    height: '100%',
    width: '100%',               // <- fill shell so both buttons are equal width
    padding: '0 16px',
    border: 0,
    borderRadius: RADIUS,
    background: `linear-gradient(180deg, ${light}, ${dark})`,
    color: textOnAccent,
    fontWeight: 800,
    letterSpacing: 0.2,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    cursor: disabled ? 'not-allowed' : 'pointer',
    userSelect: 'none',
    outline: 'none',
    appearance: 'none' as any,
    filter: hovered && !disabled ? 'brightness(1.06)' : 'none',
    boxShadow:
      (focused ? '0 0 0 2px #ffffff88 inset,' : '') +
      'inset 0 1px 0 rgba(255,255,255,0.20), inset 0 -1px 0 rgba(0,0,0,0.35)',
    transition: 'filter 120ms ease, box-shadow 120ms ease, opacity 120ms ease',
    opacity: disabled ? 0.65 : 1,
  }

  return (
    <div
      style={shell}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false) }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
    >
      <div className="metallicss" style={metalUnderlay} />
      <button
        type="button"
        style={innerBtn}
        onClick={disabled ? undefined : onClick}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        aria-label={label}
        disabled={disabled}
      >
        {icon} {label}
      </button>
    </div>
  )
}

/* Exported buttons */
export default function GameButtons({
  canRoll, canEndTurn, onRoll, onEndTurn, showAuction, accentColor = '#3b82f6'
}: Props) {
  const wrap: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    alignItems: 'center',
    padding: '10px 14px',
    borderRadius: 14,
    color: '#fff',
  }

  return (
    <div style={wrap}>
      {canRoll && (
        <MetallicActionButton
          label="Zar At"
          icon={<Dices size={18} />}
          onClick={onRoll}
          accentColor={accentColor}
        />
      )}
      {!showAuction && canEndTurn && (
        <MetallicActionButton
          label="Sırayı Bitir"
          icon={<Flag size={18} />}
          onClick={onEndTurn}
          accentColor={accentColor}
        />
      )}
    </div>
  )
}
