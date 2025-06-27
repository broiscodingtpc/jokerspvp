import { Keypair, Connection, PublicKey, Transaction, sendAndConfirmTransaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { db } from './db';
import { User } from './types';
import * as bs58 from 'bs58';

export class WalletManager {
  private connection: Connection;
  private tokenMint: PublicKey;
  private chartWallet: PublicKey;
  private encryptSecret: string;
  private readonly TOKEN_DECIMALS = 9; // JOKER token has 9 decimals

  constructor() {
    // Use Mainnet for real transactions
    this.connection = new Connection(process.env.RPC_URL || 'https://api.mainnet-beta.solana.com');
    this.tokenMint = new PublicKey(process.env.TOKEN_MINT || '');
    this.chartWallet = new PublicKey(process.env.CHART_WALLET || '');
    this.encryptSecret = process.env.ENCRYPT_SECRET || '';
  }

  // Generate a new wallet for a user
  async generateWallet(telegramId: number, username: string | null): Promise<{ wallet: string; encPrivkey: string }> {
    const keypair = Keypair.generate();
    const wallet = keypair.publicKey.toString();
    const encPrivkey = this.encryptPrivateKey(keypair.secretKey);
    
    // Store in database
    await db.createUser(telegramId, username, wallet, encPrivkey);
    
    return { wallet, encPrivkey };
  }

  // Encrypt private key
  private encryptPrivateKey(secretKey: Uint8Array): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', Buffer.from(this.encryptSecret, 'hex'), iv);
    
    let encrypted = cipher.update(secretKey);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }

  // Decrypt private key
  private decryptPrivateKey(encPrivkey: string): Uint8Array {
    const [ivHex, encryptedHex] = encPrivkey.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    
    const decipher = createDecipheriv('aes-256-cbc', Buffer.from(this.encryptSecret, 'hex'), iv);
    
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return new Uint8Array(decrypted);
  }

  // Get user's token balance
  async getTokenBalance(telegramId: number): Promise<number> {
    try {
      const user = await db.getUser(telegramId);
      if (!user) {
        console.log(`Token account not found for user ${telegramId} - returning 0 balance`);
        return 0;
      }

      const walletPubkey = new PublicKey(user.wallet);
      const tokenAccount = await getAssociatedTokenAddress(
        this.tokenMint,
        walletPubkey
      );

      const accountInfo = await this.connection.getTokenAccountBalance(tokenAccount);
      return accountInfo.value.uiAmount || 0;
    } catch (error) {
      // If token account doesn't exist, return 0
      console.log('Token account not found for user', telegramId, '- returning 0 balance');
      return 0;
    }
  }

  // Create token account if it doesn't exist
  private async ensureTokenAccount(walletPubkey: PublicKey, keypair: Keypair): Promise<PublicKey> {
    const tokenAccount = await getAssociatedTokenAddress(
      this.tokenMint,
      walletPubkey
    );

    try {
      // Check if account exists
      await this.connection.getTokenAccountBalance(tokenAccount);
      return tokenAccount;
    } catch (error) {
      // Account doesn't exist, create it
      console.log('Creating token account for wallet:', walletPubkey.toString());
      
      const transaction = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          keypair.publicKey,
          tokenAccount,
          walletPubkey,
          this.tokenMint
        )
      );

      await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [keypair]
      );

      return tokenAccount;
    }
  }

  // Transfer tokens between wallets
  async transferTokens(
    fromTelegramId: number,
    toWallet: string,
    amount: number
  ): Promise<string | null> {
    const user = await db.getUser(fromTelegramId);
    if (!user) return null;

    try {
      const fromKeypair = Keypair.fromSecretKey(this.decryptPrivateKey(user.enc_privkey));
      const toPubkey = new PublicKey(toWallet);

      // Ensure source token account exists
      const fromTokenAccount = await this.ensureTokenAccount(fromKeypair.publicKey, fromKeypair);
      
      // Get destination token account address
      const toTokenAccount = await getAssociatedTokenAddress(this.tokenMint, toPubkey);

      // Check if destination token account exists
      let toTokenAccountExists = false;
      try {
        await this.connection.getTokenAccountBalance(toTokenAccount);
        toTokenAccountExists = true;
      } catch (error) {
        console.log('Destination token account does not exist, cannot transfer');
        console.log('User needs to create token account first or use a wallet that already has this token');
        return null;
      }

      if (!toTokenAccountExists) {
        console.log('Destination wallet does not have token account for this SPL token');
        return null;
      }

      // Check if source has sufficient balance
      const sourceBalance = await this.getTokenBalance(fromTelegramId);
      if (sourceBalance < amount) {
        console.log(`Insufficient balance: ${sourceBalance} < ${amount}`);
        return null;
      }

      // Ensure source wallet has SOL for transaction fees
      const hasSol = await this.ensureSolBalance(fromKeypair.publicKey);
      if (!hasSol) {
        console.log('Source wallet does not have sufficient SOL for transaction fees');
        return null;
      }

      console.log(`Transferring ${amount} tokens from ${fromKeypair.publicKey.toString()} to ${toWallet}`);
      console.log(`From token account: ${fromTokenAccount.toString()}`);
      console.log(`To token account: ${toTokenAccount.toString()}`);

      // Create transfer transaction
      const transaction = new Transaction().add(
        createTransferInstruction(
          fromTokenAccount,
          toTokenAccount,
          fromKeypair.publicKey,
          amount * Math.pow(10, this.TOKEN_DECIMALS) // JOKER token has 9 decimals
        )
      );

      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [fromKeypair]
      );

      console.log(`Transfer successful: ${signature}`);
      return signature;
    } catch (error) {
      console.error('Error transferring tokens:', error);
      return null;
    }
  }

  // Airdrop SOL for transaction fees (only works on Devnet)
  private async airdropSol(walletPubkey: PublicKey): Promise<boolean> {
    try {
      console.log(`Attempting SOL airdrop to ${walletPubkey.toString()}`);
      
      // This only works on Devnet, not Mainnet
      const signature = await this.connection.requestAirdrop(walletPubkey, 0.01 * 1e9); // 0.01 SOL
      await this.connection.confirmTransaction(signature);
      
      console.log(`SOL airdrop successful: ${signature}`);
      return true;
    } catch (error) {
      console.error('SOL airdrop failed (expected on Mainnet):', error);
      console.log('SOLUTION: Users need to send SOL to their wallets for transaction fees');
      return false;
    }
  }

  // Ensure wallet has SOL for transaction fees
  private async ensureSolBalance(walletPubkey: PublicKey): Promise<boolean> {
    try {
      const balance = await this.connection.getBalance(walletPubkey);
      const minSol = 0.005 * 1e9; // 0.005 SOL minimum
      
      console.log(`Wallet ${walletPubkey.toString()} has ${balance / 1e9} SOL`);
      
      if (balance < minSol) {
        console.log(`Insufficient SOL (${balance / 1e9}), attempting airdrop...`);
        const airdropSuccess = await this.airdropSol(walletPubkey);
        
        if (!airdropSuccess) {
          console.log('SOLUTION: User needs to send SOL to their wallet for transaction fees');
          console.log(`Required: ~0.005 SOL to ${walletPubkey.toString()}`);
        }
        
        return airdropSuccess;
      }
      
      return true;
    } catch (error) {
      console.error('Error checking SOL balance:', error);
      return false;
    }
  }

  // Process duel result and transfer tokens
  async processDuelResult(winnerId: number, loserId: number, amount: number): Promise<boolean> {
    const totalPot = amount * 2;
    const chartFee = totalPot * 0.05; // 5% to chart wallet
    const winnerAmount = totalPot * 0.95; // 95% to winner

    try {
      const winner = await db.getUser(winnerId);
      const loser = await db.getUser(loserId);

      if (!winner || !loser) {
        console.error('Winner or loser not found');
        return false;
      }

      // Check if loser has sufficient balance for transfer
      const loserBalanceCheck = await this.getTokenBalance(loserId);
      if (loserBalanceCheck < amount) {
        console.error(`Loser ${loserId} has insufficient balance: ${loserBalanceCheck} < ${amount}`);
        return false;
      }

      // Do real blockchain transfers
      console.log('Processing real blockchain transfers...');
      console.log(`Transferring ${amount} tokens from ${loserId} to ${winnerId}`);
      
      // Get keypairs
      const loserKeypair = Keypair.fromSecretKey(this.decryptPrivateKey(loser.enc_privkey));
      const winnerKeypair = Keypair.fromSecretKey(this.decryptPrivateKey(winner.enc_privkey));
      
      // Ensure both wallets have SOL for transaction fees
      const loserHasSol = await this.ensureSolBalance(loserKeypair.publicKey);
      const winnerHasSol = await this.ensureSolBalance(winnerKeypair.publicKey);
      
      if (!loserHasSol || !winnerHasSol) {
        console.error('Failed to ensure SOL balance for transaction fees');
        return false;
      }
      
      // Transfer from loser to winner
      const transferSignature = await this.transferTokens(
        loserId,
        winner.wallet,
        amount
      );

      if (!transferSignature) {
        console.error('Failed to transfer from loser to winner');
        return false;
      }

      console.log(`Transfer successful: ${transferSignature}`);

      // Transfer chart fee from winner to chart wallet (optional)
      try {
        const chartFeeSignature = await this.transferTokens(
          winnerId,
          this.chartWallet.toString(),
          chartFee
        );

        if (chartFeeSignature) {
          console.log(`Chart fee transfer successful: ${chartFeeSignature}`);
        }
      } catch (error) {
        console.log('Chart fee transfer failed, continuing anyway:', error);
      }

      // Update database balances to reflect real blockchain state
      const winnerBalance = await this.getTokenBalance(winnerId);
      const loserBalance = await this.getTokenBalance(loserId);
      
      await db.updateBalance(winnerId, winnerBalance);
      await db.updateBalance(loserId, loserBalance);
      
      // Update stats
      await db.updateStats(winnerId, winner.wins + 1, winner.losses);
      await db.updateStats(loserId, loser.wins, loser.losses + 1);

      console.log(`Duel processed: Winner ${winnerId} gets ${winnerAmount}, Loser ${loserId} loses ${amount}`);
      console.log(`Transfer signature: ${transferSignature}`);
      return true;
    } catch (error) {
      console.error('Error processing duel result:', error);
      return false;
    }
  }

  // Check if user has sufficient balance
  async hasSufficientBalance(telegramId: number, amount: number): Promise<boolean> {
    try {
      const balance = await this.getTokenBalance(telegramId);
      console.log(`User ${telegramId} has ${balance} tokens, needs ${amount}`);
      return balance >= amount;
    } catch (error) {
      console.error('Error checking balance:', error);
      return false;
    }
  }

  // Get associated token account address
  async getTokenAccountAddress(walletAddress: string): Promise<string> {
    const walletPubkey = new PublicKey(walletAddress);
    const tokenAccount = await getAssociatedTokenAddress(
      this.tokenMint,
      walletPubkey
    );
    return tokenAccount.toString();
  }

  // Withdraw SOL from user's wallet
  async withdrawSol(telegramId: number, amount: number, destinationAddress: string): Promise<{ success: boolean; message: string; signature?: string }> {
    try {
      const user = await db.getUser(telegramId);
      if (!user) {
        return { success: false, message: 'User not found' };
      }

      const keypair = Keypair.fromSecretKey(this.decryptPrivateKey(user.enc_privkey));
      const destinationPubkey = new PublicKey(destinationAddress);

      // Get current SOL balance
      const balance = await this.connection.getBalance(keypair.publicKey);
      const balanceInSol = balance / LAMPORTS_PER_SOL;

      if (balanceInSol < amount) {
        return { success: false, message: `Insufficient SOL balance. You have ${balanceInSol.toFixed(6)} SOL` };
      }

      // Calculate transaction fee (approximately 0.000005 SOL)
      const transactionFee = 0.000005;
      const totalRequired = amount + transactionFee;

      if (balanceInSol < totalRequired) {
        return { success: false, message: `Insufficient SOL for withdrawal + fees. You have ${balanceInSol.toFixed(6)} SOL, need ${totalRequired.toFixed(6)} SOL` };
      }

      // Create transfer instruction
      const transferInstruction = SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: destinationPubkey,
        lamports: amount * LAMPORTS_PER_SOL
      });

      // Create and send transaction
      const transaction = new Transaction().add(transferInstruction);
      const signature = await this.connection.sendTransaction(transaction, [keypair]);

      // Wait for confirmation
      await this.connection.confirmTransaction(signature, 'confirmed');

      console.log(`SOL withdrawal successful: ${amount} SOL from ${telegramId} to ${destinationAddress}`);
      console.log(`Transaction signature: ${signature}`);

      return {
        success: true,
        message: `Successfully withdrew ${amount} SOL`,
        signature
      };

    } catch (error) {
      console.error('Error withdrawing SOL:', error);
      return { success: false, message: 'Failed to withdraw SOL. Please try again.' };
    }
  }

  // Export wallet private key
  async exportWallet(telegramId: number): Promise<{ success: boolean; message: string; walletAddress?: string; privateKey?: string; privateKeyArray?: number[] }> {
    try {
      const user = await db.getUser(telegramId);
      if (!user) {
        return { success: false, message: 'User not found' };
      }

      // Decrypt the private key
      const privateKeyBytes = this.decryptPrivateKey(user.enc_privkey);
      
      // Convert to Base58 format (for easy import)
      const keypair = Keypair.fromSecretKey(privateKeyBytes);
      const privateKeyBase58 = bs58.encode(privateKeyBytes);
      
      // Convert to array format (for some wallets that prefer this)
      const privateKeyArray = Array.from(privateKeyBytes);

      console.log(`Wallet exported for user ${telegramId}: ${keypair.publicKey.toString()}`);

      return {
        success: true,
        message: 'Wallet exported successfully',
        walletAddress: keypair.publicKey.toString(),
        privateKey: privateKeyBase58,
        privateKeyArray: privateKeyArray
      };

    } catch (error) {
      console.error('Error exporting wallet:', error);
      return { success: false, message: 'Failed to export wallet. Please try again.' };
    }
  }
}

export const walletManager = new WalletManager();