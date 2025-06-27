import { LeaderboardEntry } from './types';
export declare class DuelManager {
    startDuel(telegramId: number, amount: number): Promise<{
        success: boolean;
        message: string;
        duelId?: number;
    }>;
    joinDuel(telegramId: number, targetDuelId?: number): Promise<{
        success: boolean;
        message: string;
        duelId?: number;
    }>;
    private processDuel;
    getUserStats(telegramId: number): Promise<{
        wins: number;
        losses: number;
        winRate: number;
    }>;
    getLeaderboard(): Promise<LeaderboardEntry[]>;
    cleanupOldDuels(): Promise<void>;
    getBalance(telegramId: number): Promise<number>;
    getDepositAddress(telegramId: number): Promise<string | null>;
    cancelDuel(telegramId: number): Promise<{
        success: boolean;
        message: string;
    }>;
}
export declare const duelManager: DuelManager;
//# sourceMappingURL=duel.d.ts.map