# 🎮 Joker Duel Games Bot

A Telegram bot for 1v1 SPL token duels on Solana blockchain. Players can battle each other with real token transfers and automated winner determination.

## ✨ Features

- **⚔️ 1v1 Token Duels**: Battle other players with SPL tokens
- **🔐 Secure Wallets**: Automatic Solana wallet generation and management
- **💰 Real Transfers**: Actual blockchain transactions for prizes
- **📊 Leaderboards**: Track wins, losses, and earnings
- **🎯 Periodic Announcements**: Active duels announced every 3 minutes
- **🎨 Beautiful UI**: Enhanced visual formatting with emojis and separators
- **🃏 Animated Duels**: Exciting battle animations before results

## 🚀 Commands

- `/pvp` - Open the main menu (replaces /start)
- `/duel <amount>` - Start a duel for specified token amount
- `/join` - Join an available duel
- `/cancel_duel` - Cancel your pending duel
- `/balance` - Check your token balance
- `/stats` - View your battle statistics
- `/leaderboard` - See top players

## 🎯 How It Works

1. **Register**: Use `/pvp` to get your Solana wallet
2. **Deposit**: Send SPL tokens + 0.01 SOL for fees
3. **Duel**: Start or join battles with other players
4. **Win**: Winner gets 95% of pot, 5% goes to chart wallet

## 🔧 Setup

### Local Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and configure:
   - `BOT_TOKEN`: Your Telegram bot token
   - `RPC_URL`: Solana RPC endpoint
   - `CHART_WALLET`: Chart wallet for fees
4. Build: `npm run build`
5. Run locally: `npm run local`

### Render Deployment

1. **Fork/Clone** this repository to your GitHub account
2. **Create Render Account** at [render.com](https://render.com)
3. **New Background Worker**:
   - Connect your GitHub repository
   - Name: `joker-duel-games-bot`
   - Environment: `Node`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
4. **Environment Variables** (set in Render dashboard):
   - `BOT_TOKEN`: Your Telegram bot token
   - `TOKEN_MINT`: SPL token mint address
   - `RPC_URL`: `https://api.mainnet-beta.solana.com`
   - `CHART_WALLET`: Chart support wallet address
   - `ENCRYPT_SECRET`: 32-byte encryption key
   - `PUBLIC_URL`: `https://your-app-name.onrender.com`
5. **Deploy** and wait for build to complete
6. **Set Webhook**:
   ```
   https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://your-app-name.onrender.com/api/bot
   ```

## 🎨 Visual Improvements

- **Enhanced Formatting**: Clean separators and consistent styling
- **Emoji Integration**: Rich visual elements throughout
- **Periodic Announcements**: Active duels announced every 3 minutes
- **Improved Menus**: Better organized buttons and layouts
- **Interactive Buttons**: Direct join buttons for each duel

## 🔄 Recent Updates

- ✅ Replaced `/start` with `/pvp` command
- ✅ Added periodic duel announcements (every 3 minutes)
- ✅ Enhanced visual formatting with separators
- ✅ Improved leaderboard display with medals
- ✅ Better organized menu structure
- ✅ Interactive buttons for duel joining
- ✅ @username format instead of User123

## 📱 Usage

1. Start the bot with `/pvp`
2. Register your wallet in private chat
3. Deposit tokens and SOL
4. Return to group and start dueling!

## 🛡️ Security

- Private keys are encrypted and stored securely
- All transactions are on-chain and verifiable
- No access to user funds beyond duel transfers

## 📊 Statistics

- Real-time balance tracking
- Win/loss statistics
- Total earnings tracking
- Leaderboard rankings

## 🚀 Deployment

### Render (Recommended)
- **Type**: Background Worker
- **Build**: Automatic from GitHub
- **Scaling**: Automatic
- **Cost**: Free tier available

### Vercel
- **Type**: Serverless Function
- **Build**: Automatic from GitHub
- **Scaling**: Automatic
- **Cost**: Free tier available

---

**Ready to duel? Use `/pvp` to get started!** ⚔️