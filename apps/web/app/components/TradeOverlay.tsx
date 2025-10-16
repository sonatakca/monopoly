"use client"

import React, { useState, useMemo, useEffect } from 'react';
import type { RoomState, Player } from '@shared/types';
import { PROPERTY_TEMPLATE, kindOf, colorOf, isMortgaged, nameOf } from './propertyTemplate';
import { SET_COLORS, NEUTRAL, STATION_COLOR, UTILITY_COLOR, PLAYER_DOTS } from './playerColors';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import { followCursor } from 'tippy.js';
import PlayerCard from './PlayerCard';
import { MetallicActionButton } from './GameButtons';
import { Check, X } from 'lucide-react';
import { HiArrowSmRight, HiArrowSmLeft } from "react-icons/hi";
import MonopolyMoney from './icons/MonopolyMoney';

export type TradeOverlayProps = {
    players: Record<string, Player>;
    order: string[];
    meId: string | null;
    otherPlayerId: string | null;
    send: (e: any) => void;
    onClose: () => void;
    isFullscreen?: boolean;
    // Optional initial values to prefill when opening (e.g., from a counter-offer)
    initialMoneyToGive?: number;
    initialMoneyToGet?: number;
    initialPropertiesToGive?: number[];
    initialPropertiesToGet?: number[];
};

export default function TradeOverlay({
    players,
    order,
    meId,
    otherPlayerId,
    send,
    onClose,
    isFullscreen,
    initialMoneyToGive,
    initialMoneyToGet,
    initialPropertiesToGive,
    initialPropertiesToGet,
}: TradeOverlayProps) {
    if (!players || !order || !meId || !otherPlayerId) return null;

    const me = players[meId];
    const otherPlayer = players[otherPlayerId];
    if (!me || !otherPlayer) return null;

    const playerIdToSlotIndexMap = useMemo(() => {
        const SLOTS = 8;
        const playerList = order.map(id => players[id]).filter(Boolean);
        const offset = Math.max(0, Math.floor((SLOTS - playerList.length) / 2));
        const map = new Map<string, number>();
        for (let i = 0; i < playerList.length; i++) {
            const slotIndex = i + offset;
            const playerId = playerList[i].id;
            if (slotIndex < SLOTS) { map.set(playerId, slotIndex); }
        }
        return map;
    }, [order, players]);

    const meSlotIndex = playerIdToSlotIndexMap.get(me.id) ?? 0;
    const myColor = PLAYER_DOTS[meSlotIndex % PLAYER_DOTS.length];
    const otherPlayerSlotIndex = playerIdToSlotIndexMap.get(otherPlayer.id) ?? 0;
    const otherPlayerColor = PLAYER_DOTS[otherPlayerSlotIndex % PLAYER_DOTS.length];

    const [moneyToGive, setMoneyToGive] = useState(initialMoneyToGive ?? 0);
    const [moneyToGet, setMoneyToGet] = useState(initialMoneyToGet ?? 0);
    const [propertiesToGive, setPropertiesToGive] = useState<number[]>(initialPropertiesToGive ?? []);
    const [propertiesToGet, setPropertiesToGet] = useState<number[]>(initialPropertiesToGet ?? []);

    // Update when new initial values are provided (e.g., via counter-offer prefill)
    useEffect(() => { setMoneyToGive(initialMoneyToGive ?? 0) }, [initialMoneyToGive]);
    useEffect(() => { setMoneyToGet(initialMoneyToGet ?? 0) }, [initialMoneyToGet]);
    useEffect(() => { setPropertiesToGive(initialPropertiesToGive ?? []) }, [initialPropertiesToGive]);
    useEffect(() => { setPropertiesToGet(initialPropertiesToGet ?? []) }, [initialPropertiesToGet]);

    useEffect(() => {
        setMoneyToGive(0);
        setMoneyToGet(0);
        setPropertiesToGive([]);
        setPropertiesToGet([]);
    }, [meId, otherPlayerId]);

    const handleToggleProperty = (
        propertyId: number,
        list: number[],
        setList: React.Dispatch<React.SetStateAction<number[]>>
    ) => {
        if (list.includes(propertyId)) {
            setList(list.filter(p => p !== propertyId));
        } else {
            setList([...list, propertyId]);
        }
    };

    const scaleValue = isFullscreen ? 1 : 0.50;

    const panelStyle: React.CSSProperties = {
        position: 'absolute',
        top: isFullscreen ? '40%' : '40%',
        left: '50%',
        transform: `translate(-50%, -50%) scale(${scaleValue})`,
        zIndex: 100,
        width: isFullscreen ? 'min(900px, 92vw)' : 'min(900px, 92vw)',
        borderRadius: 16,
        overflow: 'visible',
        boxShadow: '0 18px 80px rgba(0,0,0,0.5)',
        background: 'rgba(25, 30, 45, 0.9)',
        color: '#fff',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '20px',
        padding: '20px',
    };

    const columnStyle: React.CSSProperties = {
        display: 'flex',
        flexDirection: 'column',
        gap: '15px',
        alignItems: 'center',
    };

    const moneyInputContainerStyle: React.CSSProperties = {
        width: isFullscreen ? '40%' : '50%',
        padding: '10px 15px',
        borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.2)',
        background: 'rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        margin: '0 auto',
    };

    const moneyInputStyle: React.CSSProperties = {
        flex: 1,
        background: 'transparent',
        border: 'none',
        outline: 'none',
        color: '#fff',
        textAlign: 'center',
        fontSize: '18px',
        width: '100%',
    };

    const numberInputSpinnerReset =
        `input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button {-webkit-appearance: none; margin: 0;} input[type=number] {-moz-appearance: textfield;}`;

    const sliderStyle: React.CSSProperties = { width: '100%' };

    const propertiesGridStyle: React.CSSProperties = {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(20px, 1fr))',
        gap: isFullscreen ? '5px' : '5px',
        padding: isFullscreen ? '10px' : '10px',
        background: 'rgba(0,0,0,0.2)',
        borderRadius: '8px',
        width: isFullscreen ? '100%' : '100%',
        flex: 1,
        minHeight: '100px',
    };

    const propertyChipStyle = (id: number, owned: boolean, selected: boolean): React.CSSProperties => {
        const kind = kindOf(id);
        const setColor = colorOf(id);
        const bg = (kind === 'PROPERTY'
            ? (SET_COLORS[String(setColor)] || NEUTRAL)
            : (kind === 'STATION' ? STATION_COLOR : UTILITY_COLOR));
        return {
            width: isFullscreen ? '100%' : '100%',
            height: isFullscreen ? '20px' : '20px',
            borderRadius: '4px',
            background: bg,
            opacity: owned ? (selected ? 1 : 1) : 0.2,
            border: selected ? '2px solid #fff' : '1px solid rgba(0,0,0,0.65)',
            cursor: owned ? 'pointer' : 'not-allowed',
            position: 'relative',
        };
    };

    const renderProperties = (
        player: Player,
        selectedProperties: number[],
        onToggle: (id: number) => void
    ) => {
        const ownedSet = new Set(player.properties);
        return (
            <div style={propertiesGridStyle}>
                {PROPERTY_TEMPLATE.map(id => {
                    const isOwned = ownedSet.has(id);
                    const isSelected = selectedProperties.includes(id);
                    return (
                        <Tippy
                            key={id}
                            content={nameOf(id)}
                            followCursor={true}
                            plugins={[followCursor]}
                            arrow={false}
                            theme="custom"
                        >
                            <div
                                style={propertyChipStyle(id, isOwned, isSelected)}
                                onClick={() => isOwned && onToggle(id)}
                            >
                                {isMortgaged(id) && (
                                    <div
                                        style={{
                                            position: 'absolute',
                                            inset: 0,
                                            background:
                                                'repeating-linear-gradient(45deg, rgba(255,0,0,0.7) 0 1px, transparent 1px 3px)'
                                        }}
                                    />
                                )}
                            </div>
                        </Tippy>
                    );
                })}
            </div>
        );
    };

    /**
     * Rows that visually pair: [Left image] | [Middle arrows] | [Right image]
     * The middle column is always perfectly centered between the two images.
     * - If left has an image on the row, show a right arrow slightly higher.
     * - If right has an image on the row, show a right arrow slightly lower.
     * We use max length to render all rows; nulls produce empty cells.
     */
    function TradeSelectedStacks({
        leftIds,
        rightIds,
    }: {
        leftIds: number[];
        rightIds: number[];
    }) {
        const gridStyle: React.CSSProperties = {
            display: 'grid',
            gridTemplateColumns: '1fr 48px 1fr', // middle column for arrows
            columnGap: 10,
            alignItems: 'stretch',
            width: '100%',
            marginTop: 10,
            maxHeight: 350,
            overflowY: 'auto',
            paddingRight: 6,
        };

        const stackBase: React.CSSProperties = {
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            minHeight: 0,
        };
        const leftStackStyle: React.CSSProperties = {
            ...stackBase,
            gridColumn: 1,
            alignItems: 'flex-start',   // ← left images hug the left
        };
        const rightStackStyle: React.CSSProperties = {
            ...stackBase,
            gridColumn: 3,
            alignItems: 'flex-end',     // ← right images hug the right
        };

        const arrowColStyle: React.CSSProperties = {
            gridColumn: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',   // ← vertically centered between stacks
            pointerEvents: 'none',
            gap: 8,
        };

        const imgStyle: React.CSSProperties = {
            display: 'block',
            width: 'auto',
            maxWidth: 260,
            height: 'auto',
            borderRadius: 5,
        };

        const renderCard = (id: number) => {
            const mortgaged = isMortgaged(id);
            const imageUrl = `/PropertyViewTrading/${id}${mortgaged ? 'b' : 'f'}.png`;
            return (
                <img
                    key={id}
                    src={imageUrl}
                    alt={`Property card for ${nameOf(id)}`}
                    style={imgStyle}
                />
            );
        };

        return (
            <div style={gridStyle}>
                {/* Left stack */}
                <div style={leftStackStyle}>
                    {leftIds.map(renderCard)}
                </div>

                {/* One arrow per side, vertically centered */}
                <div style={arrowColStyle}>
                    {leftIds.length > 0 && (
                        <HiArrowSmRight
                            size={34}
                            color="rgba(255,255,255,0.95)"
                            style={{ transform: 'translateY(-6px)' }} // a little higher for left
                        />
                    )}
                    {rightIds.length > 0 && (
                        <HiArrowSmRight
                            size={34}
                            color="rgba(255,255,255,0.95)"
                            style={{ transform: 'translateY(6px)' }} // a little lower for right
                        />
                    )}
                </div>

                {/* Right stack */}
                <div style={rightStackStyle}>
                    {rightIds.map(renderCard)}
                </div>
            </div>
        );
    }



    return (
        <div style={panelStyle}>
            <style>{numberInputSpinnerReset}</style>

            {/* LEFT COLUMN */}
            <div style={columnStyle}>
                <PlayerCard
                    player={me}
                    totalPlayers={order.length}
                    orderIndex={playerIdToSlotIndexMap.get(me.id)}
                    layoutScale={0.9}
                    hideProperties={true}
                />

                <div style={{ width: '100%' }}>
                    <div style={moneyInputContainerStyle}>
                        <MonopolyMoney size={20} />
                        <input
                            type="number"
                            style={moneyInputStyle}
                            value={moneyToGive}
                            onChange={e =>
                                setMoneyToGive(Math.min(me.cash, Math.max(0, parseInt(e.target.value) || 0)))
                            }
                        />
                    </div>
                    <input
                        type="range"
                        min="0"
                        max={me.cash}
                        value={moneyToGive}
                        className="custom-slider"
                        onChange={e => setMoneyToGive(parseInt(e.target.value))}
                        style={{ ...sliderStyle, '--slider-color': myColor } as React.CSSProperties}
                    />
                </div>

                {renderProperties(me, propertiesToGive, (id) =>
                    handleToggleProperty(id, propertiesToGive, setPropertiesToGive)
                )}
            </div>

            {/* RIGHT COLUMN */}
            <div style={columnStyle}>
                <PlayerCard
                    player={otherPlayer}
                    totalPlayers={order.length}
                    orderIndex={playerIdToSlotIndexMap.get(otherPlayer.id)}
                    layoutScale={0.9}
                    hideProperties={true}
                />

                <div style={{ width: '100%' }}>
                    <div style={moneyInputContainerStyle}>
                        <MonopolyMoney size={20} />
                        <input
                            type="number"
                            style={moneyInputStyle}
                            value={moneyToGet}
                            onChange={e =>
                                setMoneyToGet(Math.min(otherPlayer.cash, Math.max(0, parseInt(e.target.value) || 0)))
                            }
                        />
                    </div>
                    <input
                        type="range"
                        min="0"
                        max={otherPlayer.cash}
                        value={moneyToGet}
                        className="custom-slider"
                        onChange={e => setMoneyToGet(parseInt(e.target.value))}
                        style={{ ...sliderStyle, '--slider-color': otherPlayerColor } as React.CSSProperties}
                    />
                </div>

                {renderProperties(otherPlayer, propertiesToGet, (id) =>
                    handleToggleProperty(id, propertiesToGet, setPropertiesToGet)
                )}
            </div>

            {/* PAIRED ROWS: center arrows perfectly between images */}
            <div style={{ gridColumn: 'span 2' }}>
                <TradeSelectedStacks
                    leftIds={propertiesToGive}
                    rightIds={propertiesToGet}
                />
            </div>

            {/* ACTIONS */}
            <div
                style={{
                    gridColumn: 'span 2',
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '20px',
                    marginTop: '10px'
                }}
            >
                <div style={{ width: 130 }}>
                    <MetallicActionButton
                        label="Vazgeç"
                        icon={<X size={18} />}
                        onClick={onClose}
                        accentColor={myColor}
                    />
                </div>
                <div style={{ width: 140 }}>
                    <MetallicActionButton
                        label="Teklif Et"
                        icon={<Check size={18} />}
                        onClick={() => {
                            const proposal = {
                                id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                                from: meId,
                                to: otherPlayerId,
                                moneyToGive,
                                propertiesToGive,
                                moneyToGet,
                                propertiesToGet
                            };
                            // Send to server (no-op if unsupported)
                            send({ type: 'proposeTrade', ...proposal });
                            // Dispatch a local browser event so page can show a proposal overlay
                            try { window.dispatchEvent(new CustomEvent('monopoly:tradeProposal', { detail: proposal })) } catch {}
                            onClose();
                        }}
                        accentColor={myColor}
                    />
                </div>
            </div>
        </div>
    );
}
