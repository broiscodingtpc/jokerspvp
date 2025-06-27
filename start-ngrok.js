const ngrok = require('ngrok');
const https = require('https');
require('dotenv').config();

async function startNgrok() {
  try {
    console.log('🚀 Starting ngrok...');
    
    // Start ngrok tunnel
    const url = await ngrok.connect(3000);
    console.log(`✅ Ngrok tunnel started: ${url}`);
    console.log(`📱 Webhook URL: ${url}/api/bot`);
    
    // Set webhook automatically
    const botToken = process.env.BOT_TOKEN;
    if (botToken) {
      console.log('🔗 Setting webhook...');
      
      const webhookUrl = `${url}/api/bot`;
      const telegramUrl = `https://api.telegram.org/bot${botToken}/setWebhook`;
      
      const postData = JSON.stringify({ url: webhookUrl });
      
      const options = {
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${botToken}/setWebhook`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };
      
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          console.log('✅ Webhook set successfully!');
          console.log('Response:', data);
          console.log('\n🎮 Bot is ready for testing!');
          console.log('📱 Add your bot to a Telegram group and test the commands:');
          console.log('   /start, /duel 10, /join, /balance, /deposit');
        });
      });
      
      req.on('error', (err) => {
        console.error('❌ Error setting webhook:', err.message);
      });
      
      req.write(postData);
      req.end();
    } else {
      console.log('⚠️  BOT_TOKEN not found in .env file');
      console.log('📝 Please set your bot token in .env file');
    }
    
    // Keep ngrok running
    console.log('\n🔄 Ngrok tunnel is running...');
    console.log('Press Ctrl+C to stop');
    
  } catch (error) {
    console.error('❌ Error starting ngrok:', error);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down ngrok...');
  await ngrok.kill();
  process.exit(0);
});

startNgrok(); 