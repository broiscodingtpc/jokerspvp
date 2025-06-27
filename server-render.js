const express = require('express');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());

// Health check endpoint - keeps the server alive
app.get('/', (req, res) => {
  res.json({ 
    status: 'Bot server is running!', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Keep-alive endpoint for Render Free Tier
app.get('/keep-alive', (req, res) => {
  res.json({ 
    status: 'Server kept alive!', 
    timestamp: new Date().toISOString()
  });
});

// Import and use the bot handler
const botHandler = require('./dist/api/bot').default;
app.post('/api/bot', botHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Bot server running on port ${PORT}`);
  console.log('📱 Webhook URL: https://joker-duel-games-bot.onrender.com/api/bot');
  console.log('💡 Keep-alive URL: https://joker-duel-games-bot.onrender.com/keep-alive');
});

// Keep server alive for Render Free Tier
const keepAlive = () => {
  const https = require('https');
  const url = 'https://joker-duel-games-bot.onrender.com/keep-alive';
  
  https.get(url, (res) => {
    console.log(`Keep-alive ping: ${res.statusCode}`);
  }).on('error', (err) => {
    console.log('Keep-alive error:', err.message);
  });
};

// Ping every 14 minutes to keep server alive (Render shuts down after 15 min)
setInterval(keepAlive, 14 * 60 * 1000);

// Initial ping after 1 minute
setTimeout(keepAlive, 60 * 1000);

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Shutting down bot server...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Shutting down bot server...');
  process.exit(0);
}); 