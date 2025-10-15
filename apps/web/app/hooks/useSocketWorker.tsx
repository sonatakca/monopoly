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
            } else if (type === 'event' && payload.type === 'state') {
                setState(payload.state);
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