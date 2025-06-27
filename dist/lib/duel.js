"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.duelManager = exports.DuelManager = void 0;
const db_1 = require("./db");
const wallet_1 = require("./wallet");
class DuelManager {
    // Start a new duel
    async startDuel(telegramId, amount) {
        // Check if user exists, create if not
        let user = await db_1.db.getUser(telegramId);
        if (!user) {
            const { wallet } = await wallet_1.walletManager.generateWallet(telegramId, null);
            user = await db_1.db.getUser(telegramId);
        }
        if (!user) {
            return { success: false, message: 'Failed to create user account' };
        }
        // Check if user has sufficient balance
        const hasBalance = await wallet_1.walletManager.hasSufficientBalance(telegramId, amount);
        if (!hasBalance) {
            return { success: false, message: 'Insufficient balance for this duel' };
        }
        // Check if user already has a pending duel
        const userPendingDuel = await db_1.db.getUserPendingDuel(telegramId);
        if (userPendingDuel) {
            return { success: false, message: 'You already have a pending duel' };
        }
        // Create new duel
        const duelId = await db_1.db.createDuel(telegramId, amount);
        return {
            success: true,
            message: `Duel started! Waiting for opponent to join with ${amount} tokens...`,
            duelId
        };
    }
    // Join an existing duel
    async joinDuel(telegramId, targetDuelId) {
        // Check if user exists, create if not
        let user = await db_1.db.getUser(telegramId);
        if (!user) {
            const { wallet } = await wallet_1.walletManager.generateWallet(telegramId, null);
            user = await db_1.db.getUser(telegramId);
        }
        if (!user) {
            return { success: false, message: 'Failed to create user account' };
        }
        // Get duel to join
        let duelToJoin;
        if (targetDuelId) {
            duelToJoin = await db_1.db.getDuel(targetDuelId);
        }
        else {
            // Get any available pending duel
            duelToJoin = await db_1.db.getAnyPendingDuel();
        }
        if (!duelToJoin || duelToJoin.status !== 'pending') {
            return { success: false, message: 'No pending duels available' };
        }
        // Can't join your own duel
        if (duelToJoin.player1 === telegramId) {
            return { success: false, message: 'You cannot join your own duel' };
        }
        // Check if user has sufficient balance
        const hasBalance = await wallet_1.walletManager.hasSufficientBalance(telegramId, duelToJoin.amount);
        if (!hasBalance) {
            return { success: false, message: `Insufficient balance. You need ${duelToJoin.amount} tokens` };
        }
        // Join the duel
        await db_1.db.joinDuel(duelToJoin.id, telegramId);
        // Process the duel immediately
        const result = await this.processDuel(duelToJoin.id);
        return {
            success: true,
            message: `Joined duel! ${result.message}`,
            duelId: duelToJoin.id
        };
    }
    // Process a duel and determine winner
    async processDuel(duelId) {
        const duel = await db_1.db.getDuel(duelId);
        if (!duel || !duel.player2) {
            return { success: false, message: 'Invalid duel or missing player' };
        }
        // Randomly determine winner
        const winner = Math.random() < 0.5 ? duel.player1 : duel.player2;
        const loser = winner === duel.player1 ? duel.player2 : duel.player1;
        // Get usernames
        const winnerUser = await db_1.db.getUser(winner);
        const loserUser = await db_1.db.getUser(loser);
        const winnerName = winnerUser?.username || `User${winner}`;
        const loserName = loserUser?.username || `User${loser}`;
        // Complete the duel in database
        await db_1.db.completeDuel(duelId, winner);
        // Process token transfers
        const transferSuccess = await wallet_1.walletManager.processDuelResult(winner, loser, duel.amount);
        if (!transferSuccess) {
            return { success: false, message: 'Failed to process token transfers' };
        }
        const result = {
            winner,
            loser,
            amount: duel.amount,
            chartFee: duel.amount * 0.1, // 5% of total pot (2 * amount)
            winnerAmount: duel.amount * 1.9 // 95% of total pot
        };
        return {
            success: true,
            message: `🎉 Duel completed! Winner: @${winnerName}, Prize: ${result.winnerAmount} tokens`,
            result
        };
    }
    // Get user's duel statistics
    async getUserStats(telegramId) {
        const user = await db_1.db.getUser(telegramId);
        if (!user) {
            return { wins: 0, losses: 0, winRate: 0 };
        }
        const totalGames = user.wins + user.losses;
        const winRate = totalGames > 0 ? (user.wins / totalGames) * 100 : 0;
        return {
            wins: user.wins,
            losses: user.losses,
            winRate: Math.round(winRate * 100) / 100
        };
    }
    // Get leaderboard
    async getLeaderboard() {
        return await db_1.db.getLeaderboard();
    }
    // Cleanup old duels
    async cleanupOldDuels() {
        await db_1.db.cleanupOldDuels();
    }
    // Get current balance
    async getBalance(telegramId) {
        return await wallet_1.walletManager.getTokenBalance(telegramId);
    }
    // Get deposit address
    async getDepositAddress(telegramId) {
        const user = await db_1.db.getUser(telegramId);
        return user ? user.wallet : null;
    }
    // Cancel a pending duel
    async cancelDuel(telegramId) {
        try {
            // Check if user has a pending duel
            const userPendingDuel = await db_1.db.getUserPendingDuel(telegramId);
            if (!userPendingDuel) {
                return { success: false, message: 'You don\'t have any pending duels to cancel' };
            }
            // Cancel the duel in database
            await db_1.db.cancelDuel(userPendingDuel.id);
            return {
                success: true,
                message: `Duel for ${userPendingDuel.amount} tokens has been cancelled successfully!`
            };
        }
        catch (error) {
            console.error('Error cancelling duel:', error);
            return { success: false, message: 'Failed to cancel duel' };
        }
    }
}
exports.DuelManager = DuelManager;
exports.duelManager = new DuelManager();
//# sourceMappingURL=duel.js.map