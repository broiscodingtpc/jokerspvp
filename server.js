const express = require('express');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());

// Import the bot handler from compiled JavaScript
const botHandler = require('./dist/api/bot').default;

// Route for bot webhook
app.post('/api/bot', async (req, res) => {
  try {
    await botHandler(req, res);
  } catch (error) {
    console.error('Error in bot handler:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'Bot server is running!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Bot server running on http://localhost:${PORT}`);
  console.log(`📱 Webhook URL: http://localhost:${PORT}/api/bot`);
  console.log('🔗 Use ngrok to expose this to the internet');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down bot server...');
  process.exit(0);
}); 