export declare class WalletManager {
    private connection;
    private tokenMint;
    private chartWallet;
    private encryptSecret;
    private readonly TOKEN_DECIMALS;
    constructor();
    generateWallet(telegramId: number, username: string | null): Promise<{
        wallet: string;
        encPrivkey: string;
    }>;
    private encryptPrivateKey;
    private decryptPrivateKey;
    getTokenBalance(telegramId: number): Promise<number>;
    private ensureTokenAccount;
    transferTokens(fromTelegramId: number, toWallet: string, amount: number): Promise<string | null>;
    private airdropSol;
    private ensureSolBalance;
    processDuelResult(winnerId: number, loserId: number, amount: number): Promise<boolean>;
    hasSufficientBalance(telegramId: number, amount: number): Promise<boolean>;
    getTokenAccountAddress(walletAddress: string): Promise<string>;
    withdrawSol(telegramId: number, amount: number, destinationAddress: string): Promise<{
        success: boolean;
        message: string;
        signature?: string;
    }>;
    exportWallet(telegramId: number): Promise<{
        success: boolean;
        message: string;
        walletAddress?: string;
        privateKey?: string;
        privateKeyArray?: number[];
    }>;
}
export declare const walletManager: WalletManager;
//# sourceMappingURL=wallet.d.ts.map