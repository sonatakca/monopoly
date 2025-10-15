// public/socket.worker.js

// You need a way to include the socket.io client library in the worker.
// This command imports the script from a CDN.
importScripts("https://cdn.socket.io/4.7.5/socket.io.min.js");

let socket;

// Listen for messages from the main React app
self.onmessage = (e) => {
    const { type, payload } = e.data;

    if (type === 'connect') {
        // Disconnect any existing socket
        if (socket) {
            socket.disconnect();
        }

        // Connect to the server
        socket = io(payload.serverUrl, {
            transports: ["websocket"],
        });

        // Forward all 'event' messages from the server back to the main app
        socket.on("event", (data) => {
            self.postMessage({ type: 'event', payload: data });
        });

        socket.on("connect", () => {
            self.postMessage({ type: 'connect', payload: { id: socket.id } });
        });

        socket.on("disconnect", () => {
            self.postMessage({ type: 'disconnect' });
        });
    }

    if (type === 'send') {
        // When the main app wants to send an event, emit it through the worker's socket
        if (socket) {
            socket.emit('event', payload);
        }
    }
};