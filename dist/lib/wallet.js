"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.walletManager = exports.WalletManager = void 0;
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const crypto_1 = require("crypto");
const db_1 = require("./db");
const bs58 = __importStar(require("bs58"));
class WalletManager {
    constructor() {
        this.TOKEN_DECIMALS = 9; // JOKER token has 9 decimals
        // Use Mainnet for real transactions
        this.connection = new web3_js_1.Connection(process.env.RPC_URL || 'https://api.mainnet-beta.solana.com');
        this.tokenMint = new web3_js_1.PublicKey(process.env.TOKEN_MINT || '');
        this.chartWallet = new web3_js_1.PublicKey(process.env.CHART_WALLET || '');
        this.encryptSecret = process.env.ENCRYPT_SECRET || '';
    }
    // Generate a new wallet for a user
    async generateWallet(telegramId, username) {
        const keypair = web3_js_1.Keypair.generate();
        const wallet = keypair.publicKey.toString();
        const encPrivkey = this.encryptPrivateKey(keypair.secretKey);
        // Store in database
        await db_1.db.createUser(telegramId, username, wallet, encPrivkey);
        return { wallet, encPrivkey };
    }
    // Encrypt private key
    encryptPrivateKey(secretKey) {
        const iv = (0, crypto_1.randomBytes)(16);
        const cipher = (0, crypto_1.createCipheriv)('aes-256-cbc', Buffer.from(this.encryptSecret, 'hex'), iv);
        let encrypted = cipher.update(secretKey);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return iv.toString('hex') + ':' + encrypted.toString('hex');
    }
    // Decrypt private key
    decryptPrivateKey(encPrivkey) {
        const [ivHex, encryptedHex] = encPrivkey.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const encrypted = Buffer.from(encryptedHex, 'hex');
        const decipher = (0, crypto_1.createDecipheriv)('aes-256-cbc', Buffer.from(this.encryptSecret, 'hex'), iv);
        let decrypted = decipher.update(encrypted);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return new Uint8Array(decrypted);
    }
    // Get user's token balance
    async getTokenBalance(telegramId) {
        try {
            const user = await db_1.db.getUser(telegramId);
            if (!user) {
                console.log(`Token account not found for user ${telegramId} - returning 0 balance`);
                return 0;
            }
            const walletPubkey = new web3_js_1.PublicKey(user.wallet);
            const tokenAccount = await (0, spl_token_1.getAssociatedTokenAddress)(this.tokenMint, walletPubkey);
            const accountInfo = await this.connection.getTokenAccountBalance(tokenAccount);
            return accountInfo.value.uiAmount || 0;
        }
        catch (error) {
            // If token account doesn't exist, return 0
            console.log('Token account not found for user', telegramId, '- returning 0 balance');
            return 0;
        }
    }
    // Create token account if it doesn't exist
    async ensureTokenAccount(walletPubkey, keypair) {
        const tokenAccount = await (0, spl_token_1.getAssociatedTokenAddress)(this.tokenMint, walletPubkey);
        try {
            // Check if account exists
            await this.connection.getTokenAccountBalance(tokenAccount);
            return tokenAccount;
        }
        catch (error) {
            // Account doesn't exist, create it
            console.log('Creating token account for wallet:', walletPubkey.toString());
            const transaction = new web3_js_1.Transaction().add((0, spl_token_1.createAssociatedTokenAccountInstruction)(keypair.publicKey, tokenAccount, walletPubkey, this.tokenMint));
            await (0, web3_js_1.sendAndConfirmTransaction)(this.connection, transaction, [keypair]);
            return tokenAccount;
        }
    }
    // Transfer tokens between wallets
    async transferTokens(fromTelegramId, toWallet, amount) {
        const user = await db_1.db.getUser(fromTelegramId);
        if (!user)
            return null;
        try {
            const fromKeypair = web3_js_1.Keypair.fromSecretKey(this.decryptPrivateKey(user.enc_privkey));
            const toPubkey = new web3_js_1.PublicKey(toWallet);
            // Ensure source token account exists
            const fromTokenAccount = await this.ensureTokenAccount(fromKeypair.publicKey, fromKeypair);
            // Get destination token account address
            const toTokenAccount = await (0, spl_token_1.getAssociatedTokenAddress)(this.tokenMint, toPubkey);
            // Check if destination token account exists
            let toTokenAccountExists = false;
            try {
                await this.connection.getTokenAccountBalance(toTokenAccount);
                toTokenAccountExists = true;
            }
            catch (error) {
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
            const transaction = new web3_js_1.Transaction().add((0, spl_token_1.createTransferInstruction)(fromTokenAccount, toTokenAccount, fromKeypair.publicKey, amount * Math.pow(10, this.TOKEN_DECIMALS) // JOKER token has 9 decimals
            ));
            const signature = await (0, web3_js_1.sendAndConfirmTransaction)(this.connection, transaction, [fromKeypair]);
            console.log(`Transfer successful: ${signature}`);
            return signature;
        }
        catch (error) {
            console.error('Error transferring tokens:', error);
            return null;
        }
    }
    // Airdrop SOL for transaction fees (only works on Devnet)
    async airdropSol(walletPubkey) {
        try {
            console.log(`Attempting SOL airdrop to ${walletPubkey.toString()}`);
            // This only works on Devnet, not Mainnet
            const signature = await this.connection.requestAirdrop(walletPubkey, 0.01 * 1e9); // 0.01 SOL
            await this.connection.confirmTransaction(signature);
            console.log(`SOL airdrop successful: ${signature}`);
            return true;
        }
        catch (error) {
            console.error('SOL airdrop failed (expected on Mainnet):', error);
            console.log('SOLUTION: Users need to send SOL to their wallets for transaction fees');
            return false;
        }
    }
    // Ensure wallet has SOL for transaction fees
    async ensureSolBalance(walletPubkey) {
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
        }
        catch (error) {
            console.error('Error checking SOL balance:', error);
            return false;
        }
    }
    // Process duel result and transfer tokens
    async processDuelResult(winnerId, loserId, amount) {
        const totalPot = amount * 2;
        const chartFee = totalPot * 0.05; // 5% to chart wallet
        const winnerAmount = totalPot * 0.95; // 95% to winner
        try {
            const winner = await db_1.db.getUser(winnerId);
            const loser = await db_1.db.getUser(loserId);
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
            const loserKeypair = web3_js_1.Keypair.fromSecretKey(this.decryptPrivateKey(loser.enc_privkey));
            const winnerKeypair = web3_js_1.Keypair.fromSecretKey(this.decryptPrivateKey(winner.enc_privkey));
            // Ensure both wallets have SOL for transaction fees
            const loserHasSol = await this.ensureSolBalance(loserKeypair.publicKey);
            const winnerHasSol = await this.ensureSolBalance(winnerKeypair.publicKey);
            if (!loserHasSol || !winnerHasSol) {
                console.error('Failed to ensure SOL balance for transaction fees');
                return false;
            }
            // Transfer from loser to winner
            const transferSignature = await this.transferTokens(loserId, winner.wallet, amount);
            if (!transferSignature) {
                console.error('Failed to transfer from loser to winner');
                return false;
            }
            console.log(`Transfer successful: ${transferSignature}`);
            // Transfer chart fee from winner to chart wallet (optional)
            try {
                const chartFeeSignature = await this.transferTokens(winnerId, this.chartWallet.toString(), chartFee);
                if (chartFeeSignature) {
                    console.log(`Chart fee transfer successful: ${chartFeeSignature}`);
                }
            }
            catch (error) {
                console.log('Chart fee transfer failed, continuing anyway:', error);
            }
            // Update database balances to reflect real blockchain state
            const winnerBalance = await this.getTokenBalance(winnerId);
            const loserBalance = await this.getTokenBalance(loserId);
            await db_1.db.updateBalance(winnerId, winnerBalance);
            await db_1.db.updateBalance(loserId, loserBalance);
            // Update stats
            await db_1.db.updateStats(winnerId, winner.wins + 1, winner.losses);
            await db_1.db.updateStats(loserId, loser.wins, loser.losses + 1);
            console.log(`Duel processed: Winner ${winnerId} gets ${winnerAmount}, Loser ${loserId} loses ${amount}`);
            console.log(`Transfer signature: ${transferSignature}`);
            return true;
        }
        catch (error) {
            console.error('Error processing duel result:', error);
            return false;
        }
    }
    // Check if user has sufficient balance
    async hasSufficientBalance(telegramId, amount) {
        try {
            const balance = await this.getTokenBalance(telegramId);
            console.log(`User ${telegramId} has ${balance} tokens, needs ${amount}`);
            return balance >= amount;
        }
        catch (error) {
            console.error('Error checking balance:', error);
            return false;
        }
    }
    // Get associated token account address
    async getTokenAccountAddress(walletAddress) {
        const walletPubkey = new web3_js_1.PublicKey(walletAddress);
        const tokenAccount = await (0, spl_token_1.getAssociatedTokenAddress)(this.tokenMint, walletPubkey);
        return tokenAccount.toString();
    }
    // Withdraw SOL from user's wallet
    async withdrawSol(telegramId, amount, destinationAddress) {
        try {
            const user = await db_1.db.getUser(telegramId);
            if (!user) {
                return { success: false, message: 'User not found' };
            }
            const keypair = web3_js_1.Keypair.fromSecretKey(this.decryptPrivateKey(user.enc_privkey));
            const destinationPubkey = new web3_js_1.PublicKey(destinationAddress);
            // Get current SOL balance
            const balance = await this.connection.getBalance(keypair.publicKey);
            const balanceInSol = balance / web3_js_1.LAMPORTS_PER_SOL;
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
            const transferInstruction = web3_js_1.SystemProgram.transfer({
                fromPubkey: keypair.publicKey,
                toPubkey: destinationPubkey,
                lamports: amount * web3_js_1.LAMPORTS_PER_SOL
            });
            // Create and send transaction
            const transaction = new web3_js_1.Transaction().add(transferInstruction);
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
        }
        catch (error) {
            console.error('Error withdrawing SOL:', error);
            return { success: false, message: 'Failed to withdraw SOL. Please try again.' };
        }
    }
    // Export wallet private key
    async exportWallet(telegramId) {
        try {
            const user = await db_1.db.getUser(telegramId);
            if (!user) {
                return { success: false, message: 'User not found' };
            }
            // Decrypt the private key
            const privateKeyBytes = this.decryptPrivateKey(user.enc_privkey);
            // Convert to Base58 format (for easy import)
            const keypair = web3_js_1.Keypair.fromSecretKey(privateKeyBytes);
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
        }
        catch (error) {
            console.error('Error exporting wallet:', error);
            return { success: false, message: 'Failed to export wallet. Please try again.' };
        }
    }
}
exports.WalletManager = WalletManager;
exports.walletManager = new WalletManager();
//# sourceMappingURL=wallet.js.map