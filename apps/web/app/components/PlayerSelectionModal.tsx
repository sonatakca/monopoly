'use client';

import React, { useMemo } from 'react';
import type { Player } from '@shared/types';
import { PLAYER_DOTS } from './playerColors';
// 1. IMPORT the MetallicActionButton and X icon
import { MetallicActionButton } from './GameButtons';
import { X } from 'lucide-react';

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const hexToRgb = (hex: string) => {
    const m = String(hex).trim().replace('#', '');
    if (m.length === 3) return { r: parseInt(m[0] + m[0], 16), g: parseInt(m[1] + m[1], 16), b: parseInt(m[2] + m[2], 16) };
    if (m.length === 6) return { r: parseInt(m.slice(0, 2), 16), g: parseInt(m.slice(2, 4), 16), b: parseInt(m.slice(4, 6), 16) };
    return null;
};
const rgbToHex = (r: number, g: number, b: number) => {
    const h = (n: number) => n.toString(16).padStart(2, '0');
    const c = (v: number) => Math.max(0, Math.min(255, v));
    return `#${h(Math.round(c(r)))}${h(Math.round(c(g)))}${h(Math.round(c(b)))}`;
};
const lighten = (hex: string, amt: number) => {
    const c = hexToRgb(hex); if (!c) return hex;
    const t = clamp01(amt);
    return rgbToHex(c.r + (255 - c.r) * t, c.g + (255 - c.g) * t, c.b + (255 - c.b) * t);
};
const darken = (hex: string, amt: number) => {
    const c = hexToRgb(hex); if (!c) return hex;
    const t = clamp01(amt);
    return rgbToHex(c.r * (1 - t), c.g * (1 - t), c.b * (1 - t));
};
const luminance = (hex: string) => {
    const c = hexToRgb(hex);
    if (!c) return 0;
    const s = [c.r, c.g, c.b].map(v => {
        const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
    });
    return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
};

type Props = {
    order: string[];
    players: Record<string, Player>;
    meId: string | null;
    onSelectPlayer: (playerId: string) => void;
    onCancel: () => void;
    isFullscreen: boolean;
};

export default function PlayerSelectionModal({ order, players, meId, onSelectPlayer, onCancel, isFullscreen, }: Props) {

    const panelStyle: React.CSSProperties = {
        position: 'absolute',
        alignItems: 'center',
        top: '40%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 101,
        width: isFullscreen ? '350px' : '342px',
        borderRadius: 16,
        boxShadow: '0 18px 80px rgba(0,0,0,0.5)',
        background: 'rgba(25, 30, 45, 0.9)',
        color: '#fff',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '15px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
    };

    const playerIdToSlotIndexMap = useMemo(() => {
        const SLOTS = 8;
        const playerList = order.map(id => players[id]).filter(Boolean);
        const offset = Math.max(0, Math.floor((SLOTS - playerList.length) / 2));

        const map = new Map<string, number>();
        for (let i = 0; i < playerList.length; i++) {
            const slotIndex = i + offset;
            const playerId = playerList[i].id;
            if (slotIndex < SLOTS) {
                map.set(playerId, slotIndex);
            }
        }
        return map;
    }, [order, players]);

    // 2. GET the current player's color for the cancel button
    const meSlotIndex = meId ? playerIdToSlotIndexMap.get(meId) ?? 0 : 0;
    const myColor = PLAYER_DOTS[meSlotIndex % PLAYER_DOTS.length];

    return (
        <div style={{ ...panelStyle }}>
            <h2 style={{ textAlign: 'center', margin: 0, fontSize: isFullscreen ? '20px' : '20px' }}>Kime teklif yapmak istiyorsun?</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {order.filter(pid => pid !== meId).map(pid => {
                    const player = players[pid];
                    if (!player) return null;

                    const slotIndex = playerIdToSlotIndexMap.get(pid) ?? 0;
                    const playerColor = PLAYER_DOTS[slotIndex % PLAYER_DOTS.length];
                    const textColor = luminance(playerColor) > 0.65 ? '#111827' : '#ffffff';

                    const light = lighten(playerColor, 0.38);
                    const dark = darken(playerColor, 0.25);

                    const pillStyle: React.CSSProperties = {
                        display: 'flex',
                        alignItems: 'center',
                        gap: isFullscreen ? '10px' : '10px',
                        width: '100%',
                        padding: isFullscreen ? '8px 12px' : '6px 9px',
                        borderRadius: '999px',
                        background: `linear-gradient(180deg, ${light}, ${dark})`,
                        color: textColor,
                        border: '1px solid rgba(255, 255, 255, 0.25)',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.20), inset 0 -1px 0 rgba(0,0,0,0.35)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: isFullscreen ? '16px' : '16px',
                        transition: 'transform 0.1s ease-out, filter 0.1s ease-out',
                    };

                    const dotStyle: React.CSSProperties = {
                        width: isFullscreen ? '14px' : '12px',
                        height: isFullscreen ? '14px' : '12px',
                        borderRadius: '50%',
                        backgroundColor: textColor,
                        border: `2px solid ${dark}`,
                        flexShrink: 0,
                    };

                    const nameStyle: React.CSSProperties = {
                        flex: 1, fontWeight: 800, overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: 0.3
                    };

                    return (
                        <button
                            key={pid}
                            onClick={() => onSelectPlayer(pid)}
                            style={pillStyle}
                            className="player-pill-button"
                        >
                            <span style={dotStyle}></span>
                            <span style={nameStyle}>{player.name || 'Unknown Player'}</span>
                        </button>
                    );
                })}
            </div>
            {/* 3. REPLACE the old button with the MetallicActionButton */}
            <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: '140px' }}>
                    <MetallicActionButton
                        label="Vazgeç"
                        icon={<X size={18} />}
                        onClick={onCancel}
                        accentColor={myColor}
                    />
                </div>
            </div>
        </div>
    );
}