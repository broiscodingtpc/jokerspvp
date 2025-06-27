"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenChecker = exports.TokenChecker = void 0;
const web3_js_1 = require("@solana/web3.js");
const db_1 = require("./db");
const wallet_1 = require("./wallet");
class TokenChecker {
    constructor() {
        this.isRunning = false;
        this.connection = new web3_js_1.Connection(process.env.RPC_URL || 'https://api.mainnet-beta.solana.com');
        this.tokenMint = new web3_js_1.PublicKey(process.env.TOKEN_MINT || '');
    }
    // Start monitoring deposits
    async startMonitoring() {
        if (this.isRunning)
            return;
        this.isRunning = true;
        console.log('Starting token deposit monitoring...');
        // Run initial check
        await this.checkAllDeposits();
        // Set up periodic checking (every 30 seconds)
        setInterval(async () => {
            if (this.isRunning) {
                await this.checkAllDeposits();
            }
        }, 30000);
    }
    // Stop monitoring
    stopMonitoring() {
        this.isRunning = false;
        console.log('Stopped token deposit monitoring');
    }
    // Check deposits for all users
    async checkAllDeposits() {
        try {
            // Get all users from database
            const users = await this.getAllUsers();
            for (const user of users) {
                await this.checkUserDeposits(user.telegram_id, user.wallet);
            }
        }
        catch (error) {
            console.error('Error checking deposits:', error);
        }
    }
    // Check deposits for a specific user
    async checkUserDeposits(telegramId, walletAddress) {
        try {
            const walletPubkey = new web3_js_1.PublicKey(walletAddress);
            // Get recent signatures for the wallet
            const signatures = await this.connection.getSignaturesForAddress(walletPubkey, { limit: 10 });
            for (const sig of signatures) {
                // Skip if we've already processed this transaction
                const exists = await db_1.db.transactionExists(sig.signature);
                if (exists) {
                    continue;
                }
                // Get transaction details
                const transaction = await this.connection.getParsedTransaction(sig.signature);
                if (!transaction)
                    continue;
                // Check if this is a token transfer to our user's wallet
                const depositAmount = this.parseTokenTransfer(transaction, walletAddress);
                if (depositAmount > 0) {
                    // Record the transaction
                    await db_1.db.addTransaction(sig.signature, telegramId, depositAmount);
                    // Update user's balance
                    const currentBalance = await wallet_1.walletManager.getTokenBalance(telegramId);
                    await db_1.db.updateBalance(telegramId, currentBalance + depositAmount);
                    console.log(`Deposit detected: ${depositAmount} tokens to user ${telegramId}`);
                }
            }
        }
        catch (error) {
            console.error(`Error checking deposits for user ${telegramId}:`, error);
        }
    }
    // Parse transaction to find token transfers
    parseTokenTransfer(transaction, targetWallet) {
        try {
            if (!transaction.meta || !transaction.transaction)
                return 0;
            const instructions = transaction.transaction.message.instructions;
            const postTokenBalances = transaction.meta.postTokenBalances || [];
            const preTokenBalances = transaction.meta.preTokenBalances || [];
            // Find token account for our target wallet
            const targetTokenAccount = postTokenBalances.find((balance) => balance.owner === targetWallet);
            if (!targetTokenAccount)
                return 0;
            // Check if this is the correct token mint
            if (targetTokenAccount.mint !== this.tokenMint.toString())
                return 0;
            // Calculate the difference in balance
            const preBalance = preTokenBalances.find((balance) => balance.accountIndex === targetTokenAccount.accountIndex);
            const preAmount = preBalance ? parseFloat(preBalance.uiTokenAmount.uiAmount || '0') : 0;
            const postAmount = parseFloat(targetTokenAccount.uiTokenAmount.uiAmount || '0');
            const difference = postAmount - preAmount;
            return difference > 0 ? difference : 0;
        }
        catch (error) {
            console.error('Error parsing token transfer:', error);
            return 0;
        }
    }
    // Get all users from database (simplified version)
    async getAllUsers() {
        // This would need to be implemented in the database class
        // For now, we'll return an empty array and handle this differently
        return [];
    }
    // Manual check for a specific user (called from bot commands)
    async checkUserBalance(telegramId) {
        const user = await db_1.db.getUser(telegramId);
        if (!user)
            return 0;
        try {
            const balance = await wallet_1.walletManager.getTokenBalance(telegramId);
            await db_1.db.updateBalance(telegramId, balance);
            return balance;
        }
        catch (error) {
            console.error(`Error checking balance for user ${telegramId}:`, error);
            return 0;
        }
    }
    // Get token account address for a wallet
    async getTokenAccountAddress(walletAddress) {
        return await wallet_1.walletManager.getTokenAccountAddress(walletAddress);
    }
}
exports.TokenChecker = TokenChecker;
exports.tokenChecker = new TokenChecker();
//# sourceMappingURL=tokenChecker.js.map