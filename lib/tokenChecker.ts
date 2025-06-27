import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { db } from './db';
import { walletManager } from './wallet';

export class TokenChecker {
  private connection: Connection;
  private tokenMint: PublicKey;
  private isRunning: boolean = false;

  constructor() {
    this.connection = new Connection(process.env.RPC_URL || 'https://api.mainnet-beta.solana.com');
    this.tokenMint = new PublicKey(process.env.TOKEN_MINT || '');
  }

  // Start monitoring deposits
  async startMonitoring(): Promise<void> {
    if (this.isRunning) return;
    
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
  stopMonitoring(): void {
    this.isRunning = false;
    console.log('Stopped token deposit monitoring');
  }

  // Check deposits for all users
  private async checkAllDeposits(): Promise<void> {
    try {
      // Get all users from database
      const users = await this.getAllUsers();
      
      for (const user of users) {
        await this.checkUserDeposits(user.telegram_id, user.wallet);
      }
    } catch (error) {
      console.error('Error checking deposits:', error);
    }
  }

  // Check deposits for a specific user
  private async checkUserDeposits(telegramId: number, walletAddress: string): Promise<void> {
    try {
      const walletPubkey = new PublicKey(walletAddress);
      
      // Get recent signatures for the wallet
      const signatures = await this.connection.getSignaturesForAddress(
        walletPubkey,
        { limit: 10 }
      );

      for (const sig of signatures) {
        // Skip if we've already processed this transaction
        const exists = await db.transactionExists(sig.signature);
        if (exists) {
          continue;
        }

        // Get transaction details
        const transaction = await this.connection.getParsedTransaction(sig.signature);
        if (!transaction) continue;

        // Check if this is a token transfer to our user's wallet
        const depositAmount = this.parseTokenTransfer(transaction, walletAddress);
        if (depositAmount > 0) {
          // Record the transaction
          await db.addTransaction(sig.signature, telegramId, depositAmount);
          
          // Update user's balance
          const currentBalance = await walletManager.getTokenBalance(telegramId);
          await db.updateBalance(telegramId, currentBalance + depositAmount);
          
          console.log(`Deposit detected: ${depositAmount} tokens to user ${telegramId}`);
        }
      }
    } catch (error) {
      console.error(`Error checking deposits for user ${telegramId}:`, error);
    }
  }

  // Parse transaction to find token transfers
  private parseTokenTransfer(transaction: any, targetWallet: string): number {
    try {
      if (!transaction.meta || !transaction.transaction) return 0;

      const instructions = transaction.transaction.message.instructions;
      const postTokenBalances = transaction.meta.postTokenBalances || [];
      const preTokenBalances = transaction.meta.preTokenBalances || [];

      // Find token account for our target wallet
      const targetTokenAccount = postTokenBalances.find(
        (balance: any) => balance.owner === targetWallet
      );

      if (!targetTokenAccount) return 0;

      // Check if this is the correct token mint
      if (targetTokenAccount.mint !== this.tokenMint.toString()) return 0;

      // Calculate the difference in balance
      const preBalance = preTokenBalances.find(
        (balance: any) => balance.accountIndex === targetTokenAccount.accountIndex
      );

      const preAmount = preBalance ? parseFloat(preBalance.uiTokenAmount.uiAmount || '0') : 0;
      const postAmount = parseFloat(targetTokenAccount.uiTokenAmount.uiAmount || '0');
      const difference = postAmount - preAmount;

      return difference > 0 ? difference : 0;
    } catch (error) {
      console.error('Error parsing token transfer:', error);
      return 0;
    }
  }

  // Get all users from database (simplified version)
  private async getAllUsers(): Promise<Array<{ telegram_id: number; wallet: string }>> {
    // This would need to be implemented in the database class
    // For now, we'll return an empty array and handle this differently
    return [];
  }

  // Manual check for a specific user (called from bot commands)
  async checkUserBalance(telegramId: number): Promise<number> {
    const user = await db.getUser(telegramId);
    if (!user) return 0;

    try {
      const balance = await walletManager.getTokenBalance(telegramId);
      await db.updateBalance(telegramId, balance);
      return balance;
    } catch (error) {
      console.error(`Error checking balance for user ${telegramId}:`, error);
      return 0;
    }
  }

  // Get token account address for a wallet
  async getTokenAccountAddress(walletAddress: string): Promise<string> {
    return await walletManager.getTokenAccountAddress(walletAddress);
  }
}

export const tokenChecker = new TokenChecker(); 