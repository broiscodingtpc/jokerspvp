const express = require('express');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'Bot server is running!' });
});

// Import and use the bot handler
const botHandler = require('./dist/api/bot').default;
app.post('/api/bot', botHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Bot server running on port ${PORT}`);
  console.log('📱 Webhook URL: https://joker-duel-games-bot.onrender.com/api/bot');
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Shutting down bot server...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Shutting down bot server...');
  process.exit(0);
}); 