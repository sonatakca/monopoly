// In app/hooks/useSocketWorker.js

import { useState, useEffect, useRef } from 'react';
import type { RoomState } from '@shared/types'; // Import your main state type

export const useSocketWorker = () => {
    // Give useState a proper type to fix all the "'...' does not exist on type 'never'" errors
    const [state, setState] = useState<RoomState | null>(null);
    const [connected, setConnected] = useState(false);
    const [meId, setMeId] = useState<string | null>(null); // State to hold our own ID
    const workerRef = useRef<Worker | null>(null);

    useEffect(() => {
        const worker = new Worker('/socket.worker.js');
        workerRef.current = worker;

        const serverUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || window.location.origin;
        worker.postMessage({ type: 'connect', payload: { serverUrl: serverUrl } });

        // worker.postMessage({ type: 'connect', payload: { serverUrl: window.location.origin } });

        worker.onmessage = (e) => {
            const { type, payload } = e.data;

            if (type === 'connect') {
                setConnected(true);
                setMeId(payload.id); // Save our ID from the worker
            } else if (type === 'disconnect') {
                setConnected(false);
                setMeId(null);
            } else if (type === 'event') {
                if (payload.type === 'state') {
                    setState(payload.state);
                } else if (payload.type === 'tradeProposal') {
                    try { window.dispatchEvent(new CustomEvent('monopoly:tradeProposal', { detail: payload.proposal })) } catch {}
                } else if (payload.type === 'tradeTimerStart') {
                    try { window.dispatchEvent(new CustomEvent('monopoly:tradeTimerStart', { detail: payload })) } catch {}
                } else if (payload.type === 'tradeTimerEnd') {
                    try { window.dispatchEvent(new CustomEvent('monopoly:tradeTimerEnd', { detail: payload })) } catch {}
                } else if (payload.type === 'msg') {
                    try {
                        console.log('[MSG]', payload.text)
                        // Broadcast to app for lightweight toast/notice UIs
                        window.dispatchEvent(new CustomEvent('monopoly:msg', { detail: String(payload.text || '') }))
                    } catch {}
                } else if (payload.type === 'error') {
                    try {
                        const msg = String(payload.text || '')
                        console.warn('[ERROR]', msg)
                        // Suppress noisy turn-order alerts — UI already gates these actions
                        const normalized = msg.normalize('NFKD').toLowerCase()
                        const isTurnMsg = normalized.includes('siran') || normalized.includes('sıran') || normalized.includes('sira') && normalized.includes('degil') || normalized.includes('değil')
                        if (!isTurnMsg) alert(msg)
                    } catch {}
                }
            }
        };

        return () => {
            worker.terminate();
        };
    }, []);

    const send = (data: any) => {
        if (workerRef.current) {
            workerRef.current.postMessage({ type: 'send', payload: data });
        }
    };

    // Return the meId from the hook as well
    return { state, connected, send, meId };
};
