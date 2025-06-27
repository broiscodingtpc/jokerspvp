export declare class TokenChecker {
    private connection;
    private tokenMint;
    private isRunning;
    constructor();
    startMonitoring(): Promise<void>;
    stopMonitoring(): void;
    private checkAllDeposits;
    private checkUserDeposits;
    private parseTokenTransfer;
    private getAllUsers;
    checkUserBalance(telegramId: number): Promise<number>;
    getTokenAccountAddress(walletAddress: string): Promise<string>;
}
export declare const tokenChecker: TokenChecker;
//# sourceMappingURL=tokenChecker.d.ts.map