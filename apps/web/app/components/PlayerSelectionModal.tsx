// app/components/PlayerSelectionModal.tsx
'use client';

import React from 'react';
import type { Player } from '@shared/types';

type Props = {
    order: string[];
    players: Record<string, Player>;
    meId: string | null;
    onSelectPlayer: (playerId: string) => void;
    onCancel: () => void;
};

export default function PlayerSelectionModal({ order, players, meId, onSelectPlayer, onCancel }: Props) {
    // We remove the `position: 'fixed'` and other positioning styles
    // because the <Html> component will now handle the positioning in 3D space.
    const panelStyle: React.CSSProperties = {
        width: '350px',
        borderRadius: 16,
        boxShadow: '0 18px 80px rgba(0,0,0,0.5)',
        // Using a semi-transparent background works better than backdrop-filter here
        background: 'rgba(25, 30, 45, 0.9)',
        color: '#fff',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '15px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
    };

    return (
        <div style={panelStyle}>
            <h2 style={{ textAlign: 'center', margin: 0, fontSize: '20px' }}>Kiminle takas yapmak istersin?</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {order.filter(pid => pid !== meId).map(pid => (
                    <button
                        key={pid}
                        onClick={() => onSelectPlayer(pid)}
                        style={{
                            padding: '12px', borderRadius: '8px',
                            background: 'rgba(255,255,255,0.1)', color: '#fff',
                            border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer',
                            fontSize: '16px', textAlign: 'left'
                        }}
                    >
                        {players[pid]?.name || 'Unknown Player'}
                    </button>
                ))}
            </div>
            <button
                onClick={onCancel}
                style={{
                    marginTop: '10px', padding: '10px 20px', borderRadius: '8px',
                    background: '#ef4444', color: '#fff', border: 'none',
                    cursor: 'pointer', fontSize: '16px'
                }}
            >
                İptal
            </button>
        </div>
    );
}