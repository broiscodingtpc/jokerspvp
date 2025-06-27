const https = require('https');

const BOT_URL = 'https://joker-duel-games-bot.onrender.com';

function pingServer() {
  const url = `${BOT_URL}/keep-alive`;
  
  https.get(url, (res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Keep-alive ping: ${res.statusCode}`);
    
    if (res.statusCode === 200) {
      console.log('✅ Server is alive and responding!');
    } else {
      console.log('⚠️ Server responded with unexpected status');
    }
  }).on('error', (err) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Keep-alive error: ${err.message}`);
  });
}

// Ping every 14 minutes to keep server alive (Render shuts down after 15 min)
const PING_INTERVAL = 14 * 60 * 1000; // 14 minutes

console.log('🤖 Joker Duel Games Bot - Keep Alive Script');
console.log(`📡 Pinging: ${BOT_URL}`);
console.log(`⏰ Interval: ${PING_INTERVAL / 1000 / 60} minutes`);
console.log('🚀 Starting keep-alive service...\n');

// Initial ping
pingServer();

// Set up periodic pings
setInterval(pingServer, PING_INTERVAL);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Keep-alive service stopped');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Keep-alive service stopped');
  process.exit(0);
}); 