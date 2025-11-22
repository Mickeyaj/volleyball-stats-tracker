const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const http = require('http');
const { initializeDatabase, dbOperations } = require('./database');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res)=> {
    res.json({ status: 'ok', message: 'Server is running' });
});

app.post('/api/games', (req, res) => {
    try {
        const { teamName, opponentName } = req.body;
        const date = new Date().toISOString();
        const gameId = dbOperations.createGame(teamName, opponentName, date);
        res.status(201).json({ gameId, message: 'Game created successfully!' });
    } catch (error) {
        console.error('Error creating game:', error);
        res.status(500).json({ error: 'Failed to create game' });
    }
});

initializeDatabase();

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const gameConnections = new Map();

wss.on('connection', (ws) => {
    console.log('New WebSocket connection');

    ws.on('message', (message) => {
        const data = JSON.parse(message);

        if (data.type === 'subscribe' && data.gameId) {
            ws.gameId = data.gameId;
            if (!gameConnections.has(data.gameId)) {
                gameConnections.set(data.gameId, new Set());
            }
            gameConnections.get(data.gameId).add(ws);
            console.log(`Client subscribed to game ${data.gameId}`);
        }
    });

    ws.on('close', () => {
        if (ws.gameId && gameConnections.has(ws.gameId)) {
            gameConnections.get(ws.gameId).delete(ws);
        }
    });
});

function broadcastToGame(gameId, data) {
    if(gameConnections.has(gameId)) {
        const message = JSON.stringify(data);
        gameConnections.get(gameId).forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }
}

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`WebSocket available on ws://localhost:${PORT}`);
});