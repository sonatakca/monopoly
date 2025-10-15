"use client"

import React, { useState } from 'react';
import type { RoomState, Player } from '@shared/types';
import { PROPERTY_TEMPLATE, kindOf, colorOf, isMortgaged, nameOf } from './propertyTemplate';
import { SET_COLORS, NEUTRAL, STATION_COLOR, UTILITY_COLOR } from './playerColors';
import MonopolyMoney from './icons/MonopolyMoney';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import { followCursor } from 'tippy.js';
import PlayerCard from './PlayerCard';

export type TradeOverlayProps = {
    // state?: RoomState | null;
    meId: string | null;
    otherPlayerId: string | null;
    send: (e: any) => void;
    onClose: () => void;
    players: Record<string, Player>;
    order: string[];

};

export default function TradeOverlay({ players, order, meId, otherPlayerId, send, onClose }: TradeOverlayProps) {
    if (!players || !order || !meId || !otherPlayerId) return null;

    const me = players[meId];
    const otherPlayer = players[otherPlayerId];

    if (!me || !otherPlayer) return null;

    const [moneyToGive, setMoneyToGive] = useState(0);
    const [moneyToGet, setMoneyToGet] = useState(0);

    const [propertiesToGive, setPropertiesToGive] = useState<number[]>([]);
    const [propertiesToGet, setPropertiesToGet] = useState<number[]>([]);

    const handleToggleProperty = (propertyId: number, list: number[], setList: React.Dispatch<React.SetStateAction<number[]>>) => {
        if (list.includes(propertyId)) {
            setList(list.filter(p => p !== propertyId));
        } else {
            setList([...list, propertyId]);
        }
    };

    const panelStyle: React.CSSProperties = {
        // --- ADD THESE LINES BACK ---
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 100,
        // --- END OF ADDED LINES ---

        width: 'min(800px, 90vw)',
        borderRadius: 16,
        overflow: 'visible',
        boxShadow: '0 18px 80px rgba(0,0,0,0.5)',
        background: 'rgba(25, 30, 45, 0.9)',
        color: '#fff',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '20px',
        padding: '20px'
    };

    const columnStyle: React.CSSProperties = {
        display: 'flex',
        flexDirection: 'column',
        gap: '15px',
        alignItems: 'center',
    };

    // ... (the rest of the style objects and functions are the same) ...

    const moneyInputStyle: React.CSSProperties = {
        width: '100%',
        padding: '10px',
        borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.2)',
        background: 'rgba(0,0,0,0.3)',
        color: '#fff',
        textAlign: 'center',
        fontSize: '18px'
    };

    const sliderStyle: React.CSSProperties = {
        width: '100%',
    };

    const propertiesGridStyle: React.CSSProperties = {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(20px, 1fr))',
        gap: '5px',
        padding: '10px',
        background: 'rgba(0,0,0,0.2)',
        borderRadius: '8px',
        minHeight: '100px',
        width: '100%',
    };

    const propertyChipStyle = (id: number, owned: boolean, selected: boolean): React.CSSProperties => {
        const kind = kindOf(id);
        const setColor = colorOf(id);
        const bg = (kind === 'PROPERTY' ? (SET_COLORS[String(setColor)] || NEUTRAL)
            : (kind === 'STATION' ? STATION_COLOR : UTILITY_COLOR));

        return {
            width: '100%',
            height: '20px',
            borderRadius: '4px',
            background: bg,
            opacity: owned ? (selected ? 1 : 0.8) : 0.1,
            border: selected ? '2px solid #fff' : '1px solid rgba(0,0,0,0.65)',
            cursor: owned ? 'pointer' : 'not-allowed',
            position: 'relative'
        };
    };

    const renderProperties = (player: Player, selectedProperties: number[], onToggle: (id: number) => void) => {
        const ownedSet = new Set(player.properties);
        return (
            <div style={propertiesGridStyle}>
                {PROPERTY_TEMPLATE.map(id => {
                    const isOwned = ownedSet.has(id);
                    const isSelected = selectedProperties.includes(id);
                    return (
                        <Tippy key={id} content={nameOf(id)} followCursor={true} plugins={[followCursor]} arrow={false} theme="custom">
                            <div style={propertyChipStyle(id, isOwned, isSelected)} onClick={() => isOwned && onToggle(id)}>
                                {isMortgaged(id) && <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(45deg, rgba(255,0,0,0.7) 0 1px, transparent 1px 3px)' }} />}
                            </div>
                        </Tippy>
                    );
                })}
            </div>
        );
    };

    return (
        <div style={panelStyle}>
            {/* "Give" Column */}
            <div style={columnStyle}>
                <PlayerCard
                    player={me}
                    totalPlayers={order.length} // Use order.length
                    orderIndex={order.indexOf(me.id)} // Use order.indexOf
                    layoutScale={0.9}
                />
                <div style={{ width: '100%' }}>
                    <input
                        type="number"
                        style={moneyInputStyle}
                        value={moneyToGive}
                        onChange={e => setMoneyToGive(Math.min(me.cash, Math.max(0, parseInt(e.target.value) || 0)))}
                    />
                    <input
                        type="range"
                        min="0"
                        max={me.cash}
                        value={moneyToGive}
                        style={sliderStyle}
                        onChange={e => setMoneyToGive(parseInt(e.target.value))}
                    />
                </div>
                {renderProperties(me, propertiesToGive, (id) => handleToggleProperty(id, propertiesToGive, setPropertiesToGive))}
            </div>

            {/* "Get" Column */}
            <div style={columnStyle}>
                <PlayerCard
                    player={otherPlayer}
                    totalPlayers={order.length} // Use order.length
                    orderIndex={order.indexOf(otherPlayer.id)} // Use order.indexOf
                    layoutScale={0.9}
                />
                <div style={{ width: '100%' }}>
                    <input
                        type="number"
                        style={moneyInputStyle}
                        value={moneyToGet}
                        onChange={e => setMoneyToGet(Math.min(otherPlayer.cash, Math.max(0, parseInt(e.target.value) || 0)))}
                    />
                    <input
                        type="range"
                        min="0"
                        max={otherPlayer.cash}
                        value={moneyToGet}
                        style={sliderStyle}
                        onChange={e => setMoneyToGet(parseInt(e.target.value))}
                    />
                </div>
                {renderProperties(otherPlayer, propertiesToGet, (id) => handleToggleProperty(id, propertiesToGet, setPropertiesToGet))}
            </div>

            <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '10px' }}>
                <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '16px' }}>Cancel</button>
                <button onClick={() => {
                    send({ type: 'proposeTrade', to: otherPlayerId, moneyToGive, propertiesToGive, moneyToGet, propertiesToGet });
                    onClose();
                }} style={{ padding: '10px 20px', borderRadius: '8px', background: '#22c55e', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '16px' }}>Propose Trade</button>
            </div>
        </div>
    );
}