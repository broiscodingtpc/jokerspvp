import { User, Duel, LeaderboardEntry } from './types';
declare class DatabaseManager {
    private db;
    constructor();
    private initTables;
    createUser(telegramId: number, username: string | null, wallet: string, encPrivkey: string): Promise<void>;
    getUser(telegramId: number): Promise<User | undefined>;
    getAllUsers(): Promise<User[]>;
    updateBalance(telegramId: number, balance: number): Promise<void>;
    updateStats(telegramId: number, wins: number, losses: number): Promise<void>;
    createDuel(player1: number, amount: number): Promise<number>;
    getPendingDuel(): Promise<Duel | undefined>;
    getUserPendingDuel(telegramId: number): Promise<Duel | undefined>;
    getAnyPendingDuel(): Promise<Duel | undefined>;
    getAllPendingDuels(): Promise<Duel[]>;
    joinDuel(duelId: number, player2: number): Promise<void>;
    completeDuel(duelId: number, winner: number): Promise<void>;
    cancelDuel(duelId: number): Promise<void>;
    getDuel(duelId: number): Promise<Duel | undefined>;
    addTransaction(signature: string, telegramId: number, amount: number): Promise<void>;
    transactionExists(signature: string): Promise<boolean>;
    getLeaderboard(): Promise<LeaderboardEntry[]>;
    cleanupOldDuels(): Promise<void>;
    close(): void;
}
export declare const db: DatabaseManager;
export {};
//# sourceMappingURL=db.d.ts.map