const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'volleyball.db');
let db;

async function initializeDatabase() {
    const SQL = await initSqlJs();

    if (fs.existsSync(dbPath)) {
        const buffer = fs.readFileSync(dbPath);
        db = new SQL.Database(buffer);
    } else {
        db = new SQL.Database();
    }

    db.run(`
        CREATE TABLE IF NOT EXISTS games (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            team_name TEXT NOT NULL,
            opponent_name TEXT,
            date TEXT NOT NULL,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS players (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            game_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            jersey_number INTEGER,
            position INTEGER CHECK(position >= 1 AND position <= 6),
            FOREIGN KEY (game_id) REFERENCES games(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            game_id INTEGER NOT NULL,
            player_id INTEGER NOT NULL,
            stat_type TEXT NOT NULL,
            value INTEGER DEFAULT 0,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (game_id) REFERENCES games(id),
            FOREIGN KEY (player_id) REFERENCES players(id)
        )
    `);

    console.log('Database initialized successfully');
    saveDatabase();
}

function saveDatabase() {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
}

const dbOperations = {
    createGame: (teamName, opponentName, date) => {
        db.run('INSERT INTO games (team_name, opponent_name, date) VALUES (?, ?, ?)',
            [teamName, opponentName, date]);
        const result = db.exec('SELECT last_insert_rowid() as id');
        saveDatabase();
        return result[0].values[0][0];
    },

    getAllGames: () => {
        const result = db.exec('SELECT * FROM games ORDER BY created_at DESC');
        if (result.length === 0) return [];
        return result[0].values.map(row => ({
            id: row[0],
            team_name: row[1],
            opponent_name: row[2],
            date: row[3],
            status: row[4],
            created_at: row[5]
        }));
    },

    addPlayer: (gameId, name, jerseyNumber, position) => {
        db.run('INSERT INTO players (game_id, name, jersey_number, position) VALUES (?, ?, ?, ?)',
            [gameId, name, jerseyNumber, position]
);
        const result = db.exec('SELECT last_insert_rowid() as id');
        saveDatabase();
        return result[0].values[0][0];
    },

    getPlayers: (gameId) => {
        const result = db.exec('SELECT * FROM players WHERE game_id = ? ORDER BY position', [gameId]);
        if (result.length === 0) return [];
        return result[0].values.map(row => ({
            id: row[0],
            game_id: row[1],
            name: row[2],
            jersey_number: row[3],
            position: row[4]
        }));
    },

    recordStat: (gameId, playerId, statType) => {
        const existing = db.exec('SELECT value FROM stats WHERE game_id = ? AND player_id = ? AND stat_type = ?',
                            [gameId, playerId, statType]);
        if (existing.length > 0 && existing[0].values.length > 0) {
            const currentValue = existing[0].values[0][0];
            const newValue = currentValue + 1;
            db.run('UPDATE stats SET value = ? WHERE game_id = ? AND player_id = ? and stat_type = ?',
                [newValue, gameId, playerId, statType]);
            saveDatabase();
            return { playerId, statType, value: newValue };
        } else {
            db.run('INSERT INTO stats (game_id, player_id, stat_type, value) VALUES (?, ?, ?, ?)',
                [gameId, playerId, statType, 1]);
            saveDatabase();
            return { playerId, statType, value: 1 };
        }
    },

    getGameStats: (gameId) => {
        const result = db.exec(`
            SELECT p.id, p.name, p.jersey_number, p.position,
                s.stat_type, COALESCE(s.value, 0) as value
            FROM players p
            LEFT JOIN stats s ON p.id = s.player_id AND s.game_id = ?
            WHERE p.game_id = ?
            ORDER BY p.position, s.stat_type
        `, [gameId, gameId]);

        if (result.length === 0) return [];
        return result[0].values.map(row => ({
            id: row[0],
            name: row[1],
            jersey_number: row[2],
            position: row[3],
            stat_type: row[4],
            value: row[5]
        }));
    }

};

module.exports = { initializeDatabase, dbOperations, saveDatabase }