"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const sqlite3_1 = __importDefault(require("sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
class DatabaseManager {
    constructor() {
        // Ensure data directory exists
        const dataDir = path_1.default.join(process.cwd(), 'data');
        if (!fs_1.default.existsSync(dataDir)) {
            fs_1.default.mkdirSync(dataDir, { recursive: true });
        }
        const dbPath = path_1.default.join(dataDir, 'data.sqlite');
        this.db = new sqlite3_1.default.Database(dbPath);
        this.initTables();
    }
    initTables() {
        // Users table
        this.db.run(`
      CREATE TABLE IF NOT EXISTS users (
        telegram_id INTEGER PRIMARY KEY,
        username TEXT,
        wallet TEXT NOT NULL,
        enc_privkey TEXT NOT NULL,
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        balance REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
        // Duels table
        this.db.run(`
      CREATE TABLE IF NOT EXISTS duels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player1 INTEGER NOT NULL,
        player2 INTEGER,
        amount REAL NOT NULL,
        winner INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'pending',
        FOREIGN KEY (player1) REFERENCES users (telegram_id),
        FOREIGN KEY (player2) REFERENCES users (telegram_id),
        FOREIGN KEY (winner) REFERENCES users (telegram_id)
      )
    `);
        // Transactions table for tracking deposits
        this.db.run(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        signature TEXT UNIQUE NOT NULL,
        telegram_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (telegram_id) REFERENCES users (telegram_id)
      )
    `);
    }
    // User operations
    createUser(telegramId, username, wallet, encPrivkey) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO users (telegram_id, username, wallet, enc_privkey)
        VALUES (?, ?, ?, ?)
      `);
            stmt.run([telegramId, username, wallet, encPrivkey], (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
            stmt.finalize();
        });
    }
    getUser(telegramId) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM users WHERE telegram_id = ?', [telegramId], (err, row) => {
                if (err)
                    reject(err);
                else
                    resolve(row);
            });
        });
    }
    getAllUsers() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM users ORDER BY created_at DESC', (err, rows) => {
                if (err)
                    reject(err);
                else
                    resolve(rows);
            });
        });
    }
    updateBalance(telegramId, balance) {
        return new Promise((resolve, reject) => {
            this.db.run('UPDATE users SET balance = ? WHERE telegram_id = ?', [balance, telegramId], (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    updateStats(telegramId, wins, losses) {
        return new Promise((resolve, reject) => {
            this.db.run('UPDATE users SET wins = ?, losses = ? WHERE telegram_id = ?', [wins, losses, telegramId], (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    // Duel operations
    createDuel(player1, amount) {
        return new Promise((resolve, reject) => {
            this.db.run(`
        INSERT INTO duels (player1, amount, status)
        VALUES (?, ?, 'pending')
      `, [player1, amount], function (err) {
                if (err)
                    reject(err);
                else
                    resolve(this.lastID);
            });
        });
    }
    getPendingDuel() {
        return new Promise((resolve, reject) => {
            this.db.get(`
        SELECT * FROM duels 
        WHERE status = 'pending' 
        ORDER BY timestamp DESC 
        LIMIT 1
      `, (err, row) => {
                if (err)
                    reject(err);
                else
                    resolve(row);
            });
        });
    }
    getUserPendingDuel(telegramId) {
        return new Promise((resolve, reject) => {
            this.db.get(`
        SELECT * FROM duels 
        WHERE status = 'pending' AND player1 = ?
        ORDER BY timestamp DESC 
        LIMIT 1
      `, [telegramId], (err, row) => {
                if (err)
                    reject(err);
                else
                    resolve(row);
            });
        });
    }
    getAnyPendingDuel() {
        return new Promise((resolve, reject) => {
            this.db.get(`
        SELECT * FROM duels 
        WHERE status = 'pending' 
        ORDER BY timestamp ASC 
        LIMIT 1
      `, (err, row) => {
                if (err)
                    reject(err);
                else
                    resolve(row);
            });
        });
    }
    getAllPendingDuels() {
        return new Promise((resolve, reject) => {
            this.db.all(`
        SELECT * FROM duels 
        WHERE status = 'pending' 
        ORDER BY timestamp ASC
      `, (err, rows) => {
                if (err)
                    reject(err);
                else
                    resolve(rows);
            });
        });
    }
    joinDuel(duelId, player2) {
        return new Promise((resolve, reject) => {
            this.db.run(`
        UPDATE duels 
        SET player2 = ?, status = 'active' 
        WHERE id = ? AND status = 'pending'
      `, [player2, duelId], (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    completeDuel(duelId, winner) {
        return new Promise((resolve, reject) => {
            this.db.run(`
        UPDATE duels 
        SET winner = ?, status = 'completed' 
        WHERE id = ?
      `, [winner, duelId], (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    cancelDuel(duelId) {
        return new Promise((resolve, reject) => {
            this.db.run(`
        UPDATE duels 
        SET status = 'cancelled' 
        WHERE id = ?
      `, [duelId], (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    getDuel(duelId) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM duels WHERE id = ?', [duelId], (err, row) => {
                if (err)
                    reject(err);
                else
                    resolve(row);
            });
        });
    }
    // Transaction operations
    addTransaction(signature, telegramId, amount) {
        return new Promise((resolve, reject) => {
            this.db.run(`
        INSERT OR IGNORE INTO transactions (signature, telegram_id, amount)
        VALUES (?, ?, ?)
      `, [signature, telegramId, amount], (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    transactionExists(signature) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT COUNT(*) as count FROM transactions WHERE signature = ?', [signature], (err, row) => {
                if (err)
                    reject(err);
                else
                    resolve(row?.count > 0);
            });
        });
    }
    // Leaderboard operations
    getLeaderboard() {
        return new Promise((resolve, reject) => {
            this.db.all(`
        SELECT telegram_id, username, wins, losses,
               (wins * 100) as total_winnings
        FROM users 
        WHERE wins > 0 OR losses > 0
        ORDER BY wins DESC, total_winnings DESC
        LIMIT 10
      `, (err, rows) => {
                if (err)
                    reject(err);
                else
                    resolve(rows);
            });
        });
    }
    // Cleanup old pending duels (older than 1 hour)
    cleanupOldDuels() {
        return new Promise((resolve, reject) => {
            this.db.run(`
        UPDATE duels 
        SET status = 'cancelled' 
        WHERE status = 'pending' 
        AND timestamp < datetime('now', '-1 hour')
      `, (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    close() {
        this.db.close();
    }
}
exports.db = new DatabaseManager();
//# sourceMappingURL=db.js.map