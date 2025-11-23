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

app.get('/api/games', (req, res) => {
    try {
        const games = dbOperations.getAllGames();
        res.json(games);
    } catch (error) {
        console.log('Error fetching games:', error);
        res.status(500).json({ error: 'Failed to fetch games' });
    }
});

app.get('/api/games/:gameId/players', (req, res) => {
    try {
        const players = dbOperations.getPlayers(req.params.gameId);
        res.json(players);
    } catch (error) {
        console.log('Error fetching players:', error);
        res.status(500).json({ error: 'Failed to fetch players' });
    }
});

app.get('/api/games/:gameId/stats', (req, res) => {
    try {
        const stats = dbOperations.getGameStats(req.params.gameId);
        res.json(stats);
    } catch (error) {
        console.log('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
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

app.post('/api/games/:gameId/players', (req, res) => {
    try {
        const { name, jerseyNumber, position } = req.body;
        const playerId = dbOperations.addPlayer(
            req.params.gameId,
            name,
            jerseyNumber,
            position
        );

        const players = dbOperations.getPlayers(req.params.gameId);

        broadcastToGame(req.params.gameId, {
            type: 'player_added',
            players
        });

        res.status(201).json({ playerId, message: 'Player added successfully'});
    } catch (error) {
        console.error('Error adding player:', error);
        res.status(500).json({ error: 'Failed to add player' });
    }
});

app.post('api/games/:gameId/stats', (req, res) => {
    try {
        const { playerId, statType } = req.body;
        const result = dbOperations.recordStat(
            req.params.gameId,
            playerId,
            statType
        );

        const stats = dbOperations.getGameStats(req.params.gameId);

        broadcastToGame(req.params.gameId, {
            type: 'stat_updated',
            stat: result,
            stats
        });

        res.status(201).json(result);
    } catch (error) {
        console.error('Error recording stat:', error);
        res.status(500).json({ error: 'Failed to record stat' });
    }
});

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

(async () => {
    await initializeDatabase();

    server.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        console.log(`WebSocket available on ws://localhost:${PORT}`);
    });
})();
