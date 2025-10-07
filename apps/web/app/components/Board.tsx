'use client'
import Image from 'next/image'
import { memo, useMemo } from 'react'
import type { Board as BoardModel, Player } from '@shared/types'
import boardModel from '@shared/board.tr.json'

type Props = {
    players: Record<string, Player>
    size?: number // px, outer square (defaults to 760)
    boardImageUrl?: string // defaults to /board.png
}

/**
 * Visual layout:
 * - 11x11 CSS grid; we use only the outer ring (corners + 9 inner edge slots per side).
 * - Position indices follow classic Monopoly: 0 = GO (bottom-right), then clockwise.
 * - We overlay tokens in the center of each slot.
 */
function posToGrid(index: number): { row: number; col: number; rot: number } {
    // grid rows/cols: 1..11
    // corners:
    // 0: GO            => row 11, col 11 (bottom-right)
    // 10: JAIL         => row 11, col 1  (bottom-left)
    // 20: FREE PARKING => row 1,  col 1  (top-left)
    // 30: GO TO JAIL   => row 1,  col 11 (top-right)

    // bottom row (row 11), col 10..2 => indices 1..9 (right -> left)
    if (index >= 1 && index <= 9) return { row: 11, col: 11 - index, rot: 0 }
    // left column (col 1), row 10..2 => indices 11..19 (bottom -> top)
    if (index >= 11 && index <= 19) return { row: 22 - index, col: 1, rot: 90 }
    // top row (row 1), col 2..10 => indices 21..29 (left -> right)
    if (index >= 21 && index <= 29) return { row: 1, col: index - 19, rot: 180 }
    // right column (col 11), row 2..10 => indices 31..39 (top -> bottom)
    if (index >= 31 && index <= 39) return { row: index - 29, col: 11, rot: 270 }

    // corners
    switch (index) {
        case 0: return { row: 11, col: 11, rot: 0 }
        case 10: return { row: 11, col: 1, rot: 90 }
        case 20: return { row: 1, col: 1, rot: 180 }
        case 30: return { row: 1, col: 11, rot: 270 }
    }
    // fallback (shouldn’t happen)
    return { row: 6, col: 6, rot: 0 }
}

const TOKEN_COLORS = [
    '#111827', '#1f2937', '#6b7280', '#ef4444', '#f59e0b', '#10b981',
    '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'
]

function tokenColor(i: number) { return TOKEN_COLORS[i % TOKEN_COLORS.length] }

function initials(name: string) {
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[1][0]).toUpperCase()
}

/**
 * Render the board image as a background and overlay tokens, one per player.
 */
function Board({ players, size = 760, boardImageUrl = '/board.png' }: Props) {
    const entries = useMemo(() => Object.values(players), [players])

    return (
        <div
            style={{
                width: size,
                height: size,
                position: 'relative',
                userSelect: 'none',
            }}
        >
            {/* Board image */}
            <Image
                src={boardImageUrl}
                alt="MonopolyTR Board"
                fill
                priority
                sizes={`${size}px`}
                style={{ objectFit: 'cover', borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}
            />

            {/* 11x11 grid overlay to place tokens */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(11, 1fr)',
                    gridTemplateRows: 'repeat(11, 1fr)',
                    pointerEvents: 'none',
                }}
            >
                {/* tokens */}
                {entries.map((p, idx) => {
                    const { row, col } = posToGrid(p.position)
                    return (
                        <div
                            key={p.id}
                            style={{
                                gridColumn: col,
                                gridRow: row,
                                position: 'relative',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <div
                                title={`${p.name} — ₺${p.cash} • Poz: ${p.position}`}
                                style={{
                                    pointerEvents: 'auto',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: 26, height: 26,
                                    borderRadius: 9999,
                                    background: tokenColor(idx),
                                    color: 'white',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    transform: `translate(${(idx % 3 - 1) * 14}px, ${Math.floor(idx / 3) * -14}px)`,
                                    border: '2px solid rgba(255,255,255,0.85)',
                                    boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                                }}
                            >
                                {initials(p.name)}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export default memo(Board)
