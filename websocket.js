// websocket.js
const WebSocket = require('ws');

let wss;

// Store clients with metadata
const clients = new Map(); 
// ws → { userId, role }

function init(server) {
    wss = new WebSocket.Server({ server });

    wss.on('connection', (ws, req) => {
        console.log("Client connected");

        // 👉 You can extract session/cookies here later
        const user = {
            userId: null,
            role: null
        };

        clients.set(ws, user);

        ws.on('message', (msg) => {
            try {
                const data = JSON.parse(msg);

                // 🔐 AUTH HANDSHAKE
                if (data.type === 'auth') {
                    user.userId = data.userId;
                    user.role = data.role;

                    console.log("Authenticated:", user);
                }

            } catch (err) {
                console.error("Invalid WS message");
            }
        });

        ws.on('close', () => {
            console.log("Client disconnected");
            clients.delete(ws);
        });
    });
}

// 🎯 Broadcast to ALL
function broadcast(type, payload) {
    const msg = JSON.stringify({ type, payload });

    for (const [ws] of clients) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(msg);
        }
    }
}

// 🎯 Send to ONE USER
function sendToUser(userId, type, payload) {
    const msg = JSON.stringify({ type, payload });

    for (const [ws, meta] of clients) {
        if (meta.userId === userId && ws.readyState === WebSocket.OPEN) {
            ws.send(msg);
        }
    }
}

// 🎯 Send by ROLE (admin, player, etc)
function sendToRole(role, type, payload) {
    const msg = JSON.stringify({ type, payload });

    for (const [ws, meta] of clients) {
        if (meta.role === role && ws.readyState === WebSocket.OPEN) {
            ws.send(msg);
        }
    }
}

module.exports = {
    init,
    broadcast,
    sendToUser,
    sendToRole
};