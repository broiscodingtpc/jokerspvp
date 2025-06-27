import sqlite3 from 'sqlite3';
import { User, Duel, LeaderboardEntry } from './types';
import path from 'path';
import fs from 'fs';

class DatabaseManager {
  private db: sqlite3.Database;

  constructor() {
    // Ensure data directory exists
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const dbPath = path.join(dataDir, 'data.sqlite');
    this.db = new sqlite3.Database(dbPath);
    this.initTables();
  }

  private initTables(): void {
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
  createUser(telegramId: number, username: string | null, wallet: string, encPrivkey: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO users (telegram_id, username, wallet, enc_privkey)
        VALUES (?, ?, ?, ?)
      `);
      stmt.run([telegramId, username, wallet, encPrivkey], (err) => {
        if (err) reject(err);
        else resolve();
      });
      stmt.finalize();
    });
  }

  getUser(telegramId: number): Promise<User | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM users WHERE telegram_id = ?', [telegramId], (err, row) => {
        if (err) reject(err);
        else resolve(row as User | undefined);
      });
    });
  }

  getAllUsers(): Promise<User[]> {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM users ORDER BY created_at DESC', (err, rows) => {
        if (err) reject(err);
        else resolve(rows as User[]);
      });
    });
  }

  updateBalance(telegramId: number, balance: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run('UPDATE users SET balance = ? WHERE telegram_id = ?', [balance, telegramId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  updateStats(telegramId: number, wins: number, losses: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run('UPDATE users SET wins = ?, losses = ? WHERE telegram_id = ?', [wins, losses, telegramId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  // Duel operations
  createDuel(player1: number, amount: number): Promise<number> {
    return new Promise((resolve, reject) => {
      this.db.run(`
        INSERT INTO duels (player1, amount, status)
        VALUES (?, ?, 'pending')
      `, [player1, amount], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  getPendingDuel(): Promise<Duel | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get(`
        SELECT * FROM duels 
        WHERE status = 'pending' 
        ORDER BY timestamp DESC 
        LIMIT 1
      `, (err, row) => {
        if (err) reject(err);
        else resolve(row as Duel | undefined);
      });
    });
  }

  getUserPendingDuel(telegramId: number): Promise<Duel | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get(`
        SELECT * FROM duels 
        WHERE status = 'pending' AND player1 = ?
        ORDER BY timestamp DESC 
        LIMIT 1
      `, [telegramId], (err, row) => {
        if (err) reject(err);
        else resolve(row as Duel | undefined);
      });
    });
  }

  getAnyPendingDuel(): Promise<Duel | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get(`
        SELECT * FROM duels 
        WHERE status = 'pending' 
        ORDER BY timestamp ASC 
        LIMIT 1
      `, (err, row) => {
        if (err) reject(err);
        else resolve(row as Duel | undefined);
      });
    });
  }

  getAllPendingDuels(): Promise<Duel[]> {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT * FROM duels 
        WHERE status = 'pending' 
        ORDER BY timestamp ASC
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as Duel[]);
      });
    });
  }

  joinDuel(duelId: number, player2: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(`
        UPDATE duels 
        SET player2 = ?, status = 'active' 
        WHERE id = ? AND status = 'pending'
      `, [player2, duelId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  completeDuel(duelId: number, winner: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(`
        UPDATE duels 
        SET winner = ?, status = 'completed' 
        WHERE id = ?
      `, [winner, duelId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  cancelDuel(duelId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(`
        UPDATE duels 
        SET status = 'cancelled' 
        WHERE id = ?
      `, [duelId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  getDuel(duelId: number): Promise<Duel | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM duels WHERE id = ?', [duelId], (err, row) => {
        if (err) reject(err);
        else resolve(row as Duel | undefined);
      });
    });
  }

  // Transaction operations
  addTransaction(signature: string, telegramId: number, amount: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(`
        INSERT OR IGNORE INTO transactions (signature, telegram_id, amount)
        VALUES (?, ?, ?)
      `, [signature, telegramId, amount], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  transactionExists(signature: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT COUNT(*) as count FROM transactions WHERE signature = ?', [signature], (err, row) => {
        if (err) reject(err);
        else resolve((row as any)?.count > 0);
      });
    });
  }

  // Leaderboard operations
  getLeaderboard(): Promise<LeaderboardEntry[]> {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT telegram_id, username, wins, losses,
               (wins * 100) as total_winnings
        FROM users 
        WHERE wins > 0 OR losses > 0
        ORDER BY wins DESC, total_winnings DESC
        LIMIT 10
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as LeaderboardEntry[]);
      });
    });
  }

  // Cleanup old pending duels (older than 1 hour)
  cleanupOldDuels(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(`
        UPDATE duels 
        SET status = 'cancelled' 
        WHERE status = 'pending' 
        AND timestamp < datetime('now', '-1 hour')
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  close(): void {
    this.db.close();
  }
}

export const db = new DatabaseManager(); 