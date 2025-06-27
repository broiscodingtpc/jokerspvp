export interface User {
    telegram_id: number;
    username: string | null;
    wallet: string;
    enc_privkey: string;
    wins: number;
    losses: number;
    balance: number;
    created_at: string;
}
export interface Duel {
    id: number;
    player1: number;
    player2: number | null;
    amount: number;
    winner: number | null;
    timestamp: string;
    status: 'pending' | 'active' | 'completed' | 'cancelled';
}
export interface TokenTransaction {
    signature: string;
    amount: number;
    from: string;
    to: string;
    timestamp: number;
}
export interface DuelResult {
    winner: number;
    loser: number;
    amount: number;
    chartFee: number;
    winnerAmount: number;
}
export interface LeaderboardEntry {
    telegram_id: number;
    username: string | null;
    wins: number;
    losses: number;
    total_winnings: number;
}
//# sourceMappingURL=types.d.ts.map