# 🚀 Deployment Guide - Render

## 📋 Prerequisites

1. **GitHub Account** - Your code will be hosted here
2. **Render Account** - Sign up at [render.com](https://render.com)
3. **Telegram Bot Token** - Get from [@BotFather](https://t.me/BotFather)
4. **Solana Wallet** - For chart support fees

## 🔧 Step-by-Step Deployment

### 1. Prepare GitHub Repository

```bash
# Clone your repository (if not already done)
git clone https://github.com/yourusername/joker-duel-games-bot.git
cd joker-duel-games-bot

# Add all files to git
git add .

# Commit changes
git commit -m "Initial commit for Render deployment"

# Push to GitHub
git push origin main
```

### 2. Create Render Account

1. Go to [render.com](https://render.com)
2. Sign up with GitHub account
3. Verify your email

### 3. Create Background Worker

1. **Dashboard** → **New** → **Background Worker**
2. **Connect Repository**:
   - Select your GitHub repository
   - Choose the main branch
3. **Configure Service**:
   - **Name**: `joker-duel-games-bot`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free (or paid if needed)

### 4. Set Environment Variables

In Render dashboard, go to **Environment** tab and add:

| Variable | Value | Description |
|----------|-------|-------------|
| `NODE_ENV` | `production` | Environment mode |
| `BOT_TOKEN` | `your_bot_token` | Telegram bot token |
| `TOKEN_MINT` | `your_spl_token_mint` | SPL token mint address |
| `RPC_URL` | `https://api.mainnet-beta.solana.com` | Solana RPC endpoint |
| `CHART_WALLET` | `your_chart_wallet` | Chart support wallet |
| `ENCRYPT_SECRET` | `32_byte_encryption_key` | Encryption key |
| `PUBLIC_URL` | `https://your-app.onrender.com` | Your Render URL |

### 5. Deploy

1. Click **Create Background Worker**
2. Wait for build to complete (2-5 minutes)
3. Check logs for any errors

### 6. Set Telegram Webhook

Once deployed, set the webhook:

```
https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://your-app-name.onrender.com/api/bot
```

Replace:
- `<BOT_TOKEN>` with your actual bot token
- `your-app-name` with your Render app name

### 7. Test the Bot

1. Add bot to Telegram group
2. Send `/pvp` command
3. Test duel functionality
4. Check periodic announcements

## 🔍 Troubleshooting

### Build Errors
- Check Node.js version (requires 18+)
- Verify all dependencies in package.json
- Check TypeScript compilation

### Runtime Errors
- Verify environment variables are set correctly
- Check bot token validity
- Ensure webhook URL is accessible

### Database Issues
- SQLite database is created automatically
- Check file permissions on Render

## 📊 Monitoring

### Render Dashboard
- **Logs**: Real-time application logs
- **Metrics**: CPU, memory usage
- **Events**: Deployments, restarts

### Bot Health Check
- Visit: `https://your-app.onrender.com`
- Should return: `{"status":"Bot server is running!"}`

## 🔄 Updates

To update the bot:

1. **Push changes** to GitHub
2. **Render auto-deploys** from main branch
3. **Monitor logs** for any issues
4. **Test functionality** after deployment

## 💰 Costs

- **Free Tier**: 750 hours/month
- **Paid Plans**: $7/month for unlimited hours
- **Database**: SQLite (included, no extra cost)

## 🛡️ Security Notes

- Environment variables are encrypted in Render
- Never commit `.env` file to GitHub
- Use strong encryption keys
- Regularly rotate bot tokens

---

**Your bot is now live on Render!** 🎉 