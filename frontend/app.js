const API_URL = 'http://localhost:3000/api';
const WS_URL = 'ws://localhost:3000';

let currentGameId = null;
let currentPlayers = [];
let selectedPlayerId = null;
let ws = null;

const setupSection = document.getElementById('setup-section');
const playerSetupSection = document.getElementById('player-setup-section');
const trackingSection = document.getElementById('tracking-section');
const connectionStatus = document.getElementById('connection-status');

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    connectWebSocket();
});

function setupEventListeners() {
    document.getElementById('create-game-btn').addEventListener('click', createGame);
    document.getElementById('add-player-btn').addEventListener('click', addPlayer);
    document.getElementById('start-tracking-btn').addEventListener('click', startTracking);

    document.querySelectorAll('.stat-btn').forEach(btn => {
        btn.addEventListener('click', handleStatClick);
    });

    document.querySelectorAll('.court-position').forEach(position => {
        position.addEventListener('click', handleCourtClick);
    });
}

function connectWebSocket() {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        console.log('WebSocket connected');
        connectionStatus.classList.add('connected');
        connectionStatus.querySelector('.status-text').textContent = 'Connected';
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
    };

    ws.onclose = () => {
        console.log('WebSocket disconnected');
        connectionStatus.classList.remove('connected');
        connectionStatus.querySelector('.status-text').textContent = 'Disconnected';
        setTimeout(connectWebSocket, 3000);
    };
}

function handleWebSocketMessage(data) {
    console.log('Received:', data);
}

async function createGame() {
    const teamName = document.getElementById('team-name').value.trim();
    const opponentName = document.getElementById('opponent-name').value.trim();

    if (!teamName) {
        alert ('Please enter a team name');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/games`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ teamName, opponentName })
        });

        const data = await response.json();
        currentGameId = data.gameId;

        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'subscribe', gameId: currentGameId }));
        }

        setupSection.classList.add('hidden');
        playerSetupSection.classList.remove('hidden');

        console.log('Game created with ID:', currentGameId);
    } catch (error) {
        console.log('Error creating game:', error);
        alert('Failed to create game. Make sure the server is running!');
    }
}