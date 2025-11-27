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
    document.getElementById('create-game-btn').addEventListener('click', (event) => {
        event.preventDefault();
        createGame(event);
    });
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
    event.preventDefault();
    console.log('Create game button clicked');
    const teamName = document.getElementById('team-name').value.trim();
    const opponentName = document.getElementById('opponent-name').value.trim();

    console.log('TeamName:', teamName);
    console.log('Opponent:', opponentName);

    if (!teamName) {
        alert ('Please enter a team name');
        return;
    }

    try {
        console.log('sending request to create game...');
        const response = await fetch(`${API_URL}/games`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ teamName, opponentName })
        });

        const data = await response.json();
        console.log('game created:', data);
        currentGameId = data.gameId;

        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'subscribe', gameId: currentGameId }));
        }

        console.log('hiding setup, showing player setup');
        setupSection.classList.add('hidden');
        playerSetupSection.classList.remove('hidden');

        console.log('Game created with ID:', currentGameId);

    } catch (error) {
        console.log('Error creating game:', error);
        alert('Failed to create game. Make sure the server is running!');
    }
}

async function addPlayer() {
    const name = document.getElementById('player-name').value.trim();
    const jerseyNumber = document.getElementById('jersey-number').value;
    const position = document.getElementById('position-select').value;

    if (!name || !position) {
        alert('Please enter player name and select a position');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/games/${currentGameId}/players`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                jerseyNumber: jerseyNumber || null,
                position: parseInt(position)
            })
        });

        if (response.ok) {
            document.getElementById('player-name').value = '';
            document.getElementById('jersey-number').value = '';
            document.getElementById('position-select').value = '';

            await loadPlayers();
        }
    } catch (error) {
        console.error('Error adding player:', error);
        alert('Failed to add player');
    }
}

async function loadPlayers() {
    try {
        const response = await fetch(`${API_URL}/games/${currentGameId}/players`);
        currentPlayers = await response.json();
        displayPlayers();

        if(currentPlayers.length === 6) {
            console.log('Showing start tracking button');
            const button = document.getElementById('start-tracking-btn');
            console.log('Button element:', button);
            button.classList.remove('hidden');
            console.log('Button classes after remove:', button.classList);
        } else {
            console.log('Only have', currentPlayers.length, 'players, need 6');
        }
    } catch (error) {
        console.error('Error loading players:', error);
    }
}

function displayPlayers() {
    const playerList = document.getElementById('player-list');

    if (currentPlayers.length === 0) {
        playerList.innerHTML = '<p>No players added yet.</p>';
        return
    }

    playerList.innerHTML = '';
    currentPlayers.forEach(player => {
        const playerItem = document.createElement('div');
        playerItem.className = 'player-item';
        playerItem.innerHTML = `
            <strong>${player.name}</strong>
            ${player.jersey_number ? `(#${player.jersey_number})` : ''}
            - Position ${player.position}
        `;
        playerList.appendChild(playerItem);
    });
}

function startTracking() {
    playerSetupSection.classList.add('hidden');
    trackingSection.classList.remove('hidden');

    updateCourtPositions();
    initializeStatsDisplay();
}

async function handleCourtClick(event) {
    const position = parseInt(event.currentTarget.dataset.position);
    const player = currentPlayers.find(p => p.position === position);

    if (!player) {
        alert('No player at this position');
        return;
    }

    selectedPlayerId = player.id;

    console.log('Selected player:', player);

    document.querySelectorAll('.court-position').forEach(pos => {
        pos.classList.remove('active');
    });

    event.currentTarget.classList.add('active');

    document.getElementById('selected-player-info').classList.remove('hidden');
    document.getElementById('selected-player-name').textContent = `${player.name}${player.jersey_number ? ' (#' + player.jersey_number+ ')' : ''}`;
}

async function handleStatClick(event) {
    if (!selectedPlayerId) {
        alert('Please select a player first by clicking on a court position');
        return;
    }

    const statType = event.target.dataset.stat;
    console.log('Recording stat:', statType, 'for player:', selectedPlayerId);

    try {
        const response = await fetch(`${API_URL}/games/${currentGameId}/stats`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                playerId: selectedPlayerId,
                statType: statType
            })
        });

        const result = await response.json();
        console.log('stat recorded:', result);

        event.target.style.transform = 'scale(1.1)';
        setTimeout(() => {
            event.target.style.transform = '';
        }, 200);
    } catch (error) {
        console.error('Error recording stat:', error);
        alert('Failed to record stat');
    }
}

function updateCourtPositions() {
    currentPlayers.forEach(player => {
        const posElement = document.getElementById(`player-pos-${player.position}`);
        if (posElement) {
            posElement.innerHTML = `
            <span style="font-weight: bold; display: block;">${player.name}</span>
            ${player.jersey_number ? `<span style="font-size: 1.2em; font-weight: bold;">#${player.jersey_number}</span>` : ''}
            `;
        }
    });
}

function initializeStatsDisplay() {
    const tbody = document.getElementById('stats-tbody');
    tbody.innerHTML = '';

    currentPlayers.forEach(player => {
        const row = document.createElement('tr');
        row.id = `stats-row-${player.id}`;
        row.innerHTML = `
            <td><strong>${player.name}${player.jersey_number ? ' (#' + player.jersey_number + ')' : ''}<strong>></td>
            <td class="stat-value" data-stat="kill">0</td>
            <td class="stat-value" data-stat="ace">0</td>
            <td class="stat-value" data-stat="dig">0</td>
            <td class="stat-value" data-stat="block">0</td>
            <td class="stat-value" data-stat="assist">0</td>
            <td class="stat-value" data-stat="error">0</td>
        `;
        tbody.appendChild(row);
    });
}