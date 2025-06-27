import TelegramBot from 'node-telegram-bot-api';
import { Request, Response } from 'express';
import dotenv from 'dotenv';
import { db } from '../lib/db';
import { duelManager } from '../lib/duel';
import { walletManager } from '../lib/wallet';
import { tokenChecker } from '../lib/tokenChecker';
import { Connection, PublicKey } from '@solana/web3.js';
import { User } from '../lib/types';

// Load environment variables
dotenv.config();

// Initialize bot
const bot = new TelegramBot(process.env.BOT_TOKEN || '', { polling: false });

// Store active group chats for announcements
const activeGroupChats = new Set<number>();

// Animated duel function
async function playDuelAnimation(
  chatId: number, 
  player1Name: string, 
  player2Name: string, 
  amount: number,
  onComplete: (winnerName: string, loserName: string) => void
) {
  console.log(`Starting animation for ${player1Name} vs ${player2Name}`);
  
  const animationSteps = [
    {
      text: `⚔️ **${player1Name}** vs **${player2Name}** ⚔️\n💰 **${amount * 2}** tokens at stake\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      delay: 800
    },
    {
      text: `🔥 **THE DUEL BEGINS...** 🔥\n\n⚔️ *Preparing for battle...*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      delay: 1000
    },
    {
      text: `🎲 Rolling the dice...\n\n🎯 *Calculating odds...*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      delay: 800
    },
    {
      text: `💥 **BAM!** 💥\n\n⚡ *First strike!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      delay: 800
    },
    {
      text: `🎯 Critical hit from **${player1Name}**!\n\n💪 *${player1Name} gains advantage!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      delay: 1000
    },
    {
      text: `💣 **${player2Name}** strikes back!\n\n🛡️ *${player2Name} counters!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      delay: 1000
    },
    {
      text: `🃏 Joker's spinning the wheel...\n\n🎰 *Destiny decides...*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      delay: 1200
    },
    {
      text: `⏳ **FINAL MOMENT...**\n\n⚡ *Tension builds...*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      delay: 1000
    },
    {
      text: `🏆 **AND THE WINNER IS...**\n\n🎭 *Drum roll...*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      delay: 1200
    }
  ];

  let currentMessage: any = null;

  try {
    // Send initial message
    console.log('Sending initial animation message');
    currentMessage = await bot.sendMessage(chatId, animationSteps[0].text, { 
      parse_mode: 'Markdown' 
    });
    console.log('Initial message sent, message_id:', currentMessage.message_id);

    // Play animation
    for (let i = 1; i < animationSteps.length; i++) {
      console.log(`Animation step ${i}/${animationSteps.length}`);
      await new Promise(resolve => setTimeout(resolve, animationSteps[i].delay));
      
      try {
        await bot.editMessageText(animationSteps[i].text, {
          chat_id: chatId,
          message_id: currentMessage.message_id,
          parse_mode: 'Markdown'
        });
        console.log(`Step ${i} updated successfully`);
      } catch (error) {
        console.log('Error updating animation step', i, ':', error);
      }
    }

    // Final delay before showing result
    console.log('Animation complete, waiting for final delay');
    await new Promise(resolve => setTimeout(resolve, 800));

    // Call completion callback
    console.log('Calling completion callback');
    onComplete(player1Name, player2Name);
    
  } catch (error) {
    console.error('Error in animation:', error);
    // Still call completion even if animation fails
    onComplete(player1Name, player2Name);
  }
}

// Function to announce active duels
async function announceActiveDuels() {
  try {
    const activeDuels = await db.getAllPendingDuels();
    
    if (activeDuels.length === 0) {
      return; // No active duels to announce
    }

    let announcementText = `
🎮 *ACTIVE DUELS ANNOUNCEMENT*

⚔️ *Current Battles Waiting:*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

    // Create inline keyboard with buttons for each duel
    const inlineKeyboard: Array<Array<{ text: string; callback_data: string }>> = [];
    
    activeDuels.forEach((duel: any, index: number) => {
      // Get username with @ prefix
      const playerName = duel.player1_name ? `@${duel.player1_name}` : `User${duel.player1}`;
      announcementText += `${index + 1}. **${playerName}** - ${duel.amount} tokens\n`;
      
      // Add button for this duel
      inlineKeyboard.push([
        { 
          text: `⚔️ Join ${playerName} (${duel.amount} tokens)`, 
          callback_data: `join_duel_${duel.id}` 
        }
      ]);
    });

    announcementText += `
🎯 *Click buttons below to join duels*
⏰ *Updated every 3 minutes*
`;

    // Send to all active group chats
    for (const chatId of activeGroupChats) {
      try {
        await bot.sendPhoto(chatId, './assets/images/duels-banner.png', {
          caption: announcementText,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: inlineKeyboard
          },
          disable_notification: true // Silent announcement
        });
      } catch (error) {
        console.log(`Failed to send announcement to chat ${chatId}:`, error);
        // Try fallback to text message
        try {
          await bot.sendMessage(chatId, announcementText, { 
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: inlineKeyboard
            },
            disable_notification: true
          });
        } catch (fallbackError) {
          console.log(`Failed to send fallback announcement to chat ${chatId}:`, fallbackError);
          // Remove inactive chat from set
          activeGroupChats.delete(chatId);
        }
      }
    }
  } catch (error) {
    console.error('Error announcing active duels:', error);
  }
}

// Welcome message with menu buttons
bot.onText(/\/pvp/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from?.id;
  const username = msg.from?.username || msg.from?.first_name || `User${telegramId}`;

  if (!telegramId) {
    await bot.sendMessage(chatId, '❌ Error: Could not identify user');
    return;
  }

  // Add group chat to active chats for announcements
  if (msg.chat.type !== 'private') {
    activeGroupChats.add(chatId);
  }

  // Create user if doesn't exist
  let user = await db.getUser(telegramId);
  if (!user) {
    const { wallet } = await walletManager.generateWallet(telegramId, username);
    user = await db.getUser(telegramId);
  }

  // Ensure user exists
  if (!user) {
    await bot.sendMessage(chatId, '❌ Error: Could not create user account');
    return;
  }

  // Check if this is a private chat
  if (msg.chat.type === 'private') {
    // Private chat - show wallet information
    const connection = new Connection(process.env.RPC_URL || 'https://api.mainnet-beta.solana.com');
    const walletPubkey = new PublicKey(user.wallet);
    
    try {
      const solBalance = await connection.getBalance(walletPubkey);
      const tokenBalance = await walletManager.getTokenBalance(telegramId);
      const stats = await duelManager.getUserStats(telegramId);
      
      const privateWelcomeMessage = `
🎮 *JOKER DUEL GAMES - WALLET DASHBOARD*

🔐 *Wallet Address:* \`${user.wallet}\`

💰 *Current Balances:*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• 💎 SOL: \`${(solBalance / 1e9).toFixed(4)} SOL\`
• 🪙 Tokens: \`${tokenBalance} SPL\`

📊 *Your Battle Stats:*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• 🏆 Wins: \`${stats.wins}\` | 💀 Losses: \`${stats.losses}\`
• 📈 Win Rate: \`${stats.winRate}%\`
• 🎯 Total Games: \`${stats.wins + stats.losses}\`

🚀 *Quick Actions:*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1️⃣ Send SPL tokens to your wallet address
2️⃣ Send 0.01 SOL for transaction fees  
3️⃣ Wait 1-2 minutes for confirmations
4️⃣ Return to group and use /duel or /join

⚠️ *Keep your wallet address private!*
`;

      const privateKeyboard = {
        inline_keyboard: [
          [
            { text: '💰 Refresh Balance', callback_data: 'private_balance' },
            { text: '📥 Deposit', callback_data: 'private_deposit' }
          ],
          [
            { text: '📤 Withdraw Tokens', callback_data: 'private_withdraw' },
            { text: '📊 Stats', callback_data: 'private_stats' }
          ],
          [
            { text: '❌ Cancel Duel', callback_data: 'private_cancel_duel' },
            { text: '💎 Withdraw SOL', callback_data: 'private_withdraw_sol' }
          ],
          [
            { text: '🔐 Export Wallet', callback_data: 'private_export_wallet' }
          ],
          [
            { text: '🔙 Back to Menu', callback_data: 'back_to_menu' }
          ]
        ]
      };

      await bot.sendMessage(chatId, privateWelcomeMessage, { 
        parse_mode: 'Markdown',
        reply_markup: privateKeyboard
      });
      
    } catch (error) {
      console.error('Error getting wallet info:', error);
      
      const fallbackMessage = `
🎮 *JOKER DUEL GAMES - WALLET DASHBOARD*

🔐 *Wallet Address:* \`${user.wallet}\`

🚀 *Quick Actions:*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1️⃣ Send SPL tokens to your wallet address
2️⃣ Send 0.01 SOL for transaction fees
3️⃣ Wait 1-2 minutes for confirmations
4️⃣ Return to group and use /duel or /join

⚠️ *Keep your wallet address private!*
`;

      const privateMenuKeyboard = {
        inline_keyboard: [
          [
            { text: '💰 Refresh Balance', callback_data: 'private_balance' },
            { text: '💳 Deposit', callback_data: 'private_deposit' }
          ],
          [
            { text: '💸 Withdraw', callback_data: 'private_withdraw' },
            { text: '📊 Stats', callback_data: 'private_stats' }
          ]
        ]
      };

      await bot.sendMessage(chatId, fallbackMessage, { 
        parse_mode: 'Markdown',
        reply_markup: privateMenuKeyboard
      });
    }
    
  } else {
    // Group chat - show regular welcome message with image
    // Get top 3 leaderboard
    const leaderboard = await duelManager.getLeaderboard();
    let leaderboardText = '';
    if (leaderboard.length > 0) {
      leaderboardText = '\n🏆 *TOP 3 WARRIORS*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
      leaderboard.slice(0, 3).forEach((entry, index) => {
        const uname = entry.username || `User${entry.telegram_id}`;
        const emoji = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
        leaderboardText += `${emoji} *${uname}* — ${entry.wins}W/${entry.losses}L\n`;
      });
    } else {
      leaderboardText = '\n🎯 *No battles yet - Be the first champion!*';
    }

    const welcomeMessage = `
🎮 *JOKER DUEL GAMES*

⚔️ *1v1 SPL Token Battles on Solana*

${leaderboardText}

📋 *Quick Start:*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Click "🔐 Register" to get your wallet
• Send tokens + 0.01 SOL for fees
• Use /duel or /join to battle

🎯 *Commands:*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• \`/duel 100\` - Start a 100 token duel
• \`/join\` - Join pending duel
• \`/pvp\` - Open this menu
`;

    const menuKeyboard = {
      inline_keyboard: [
        [
          { text: '🔐 Register Wallet', callback_data: 'register_wallet' },
          { text: '⚔️ Start Duel', callback_data: 'start_duel' }
        ],
        [
          { text: '📊 Leaderboard', callback_data: 'leaderboard' },
          { text: 'ℹ️ How to Play', callback_data: 'how_to_play' }
        ]
      ]
    };

    try {
      // Send image with caption for group chats
      await bot.sendPhoto(chatId, './assets/images/menu-banner.png', {
        caption: welcomeMessage,
        parse_mode: 'Markdown',
        reply_markup: menuKeyboard
      });
    } catch (error) {
      console.error('Error sending menu image:', error);
      // Fallback to text message if image fails
      await bot.sendMessage(chatId, welcomeMessage, { 
        parse_mode: 'Markdown',
        reply_markup: menuKeyboard
      });
    }
  }
});

// Handle button callbacks
bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message?.chat.id;
  const telegramId = callbackQuery.from?.id;
  const data = callbackQuery.data;
  const messageId = callbackQuery.message?.message_id;
  const callbackQueryId = callbackQuery.id;

  if (!chatId || !telegramId || !data || !messageId) {
    console.log('Invalid callback query data:', { chatId, telegramId, data, messageId });
    return;
  }

  console.log(`Processing callback: ${data} from user ${telegramId}`);

  try {
    switch (data) {
      case 'register_wallet':
        await handleRegisterWallet(telegramId, chatId, callbackQueryId);
        break;
      
      case 'start_duel':
        await handleStartDuel(telegramId, chatId, messageId, callbackQueryId);
        break;
      
      case 'leaderboard':
        await handleLeaderboard(chatId);
        await bot.answerCallbackQuery(callbackQueryId, { text: 'Leaderboard loaded!' });
        break;
      
      case 'how_to_play':
        await handleHowToPlay(chatId);
        await bot.answerCallbackQuery(callbackQueryId, { text: 'How to play loaded!' });
        break;
      
      case 'duel_10':
      case 'duel_50':
      case 'duel_100':
      case 'duel_500':
        const amount = parseInt(data.replace('duel_', ''));
        await handleDuelAmount(telegramId, chatId, amount, messageId, callbackQueryId);
        break;
      
      case 'join_duel':
        await handleJoinDuel(telegramId, chatId, messageId, callbackQueryId);
        break;
      
      case 'back_to_menu':
        await handleBackToMenu(telegramId, chatId, messageId);
        await bot.answerCallbackQuery(callbackQueryId, { text: 'Menu loaded!' });
        break;
      
      case 'private_balance':
        await handlePrivateBalance(telegramId, callbackQueryId);
        break;
      
      case 'private_deposit':
        await handlePrivateDeposit(telegramId, callbackQueryId);
        break;
      
      case 'private_withdraw':
        await handlePrivateWithdraw(telegramId, callbackQueryId);
        break;
      
      case 'private_cancel_duel':
        await handlePrivateCancelDuel(telegramId, callbackQueryId);
        break;
      
      case 'private_withdraw_sol':
        await handlePrivateWithdrawSol(telegramId, callbackQueryId);
        break;
      
      case 'private_export_wallet':
        await handlePrivateExportWallet(telegramId, callbackQueryId);
        break;
      
      case 'private_stats':
        await handlePrivateStats(telegramId, callbackQueryId);
        break;
      
      default:
        // Handle join_duel_* callbacks
        if (data.startsWith('join_duel_')) {
          const duelId = parseInt(data.replace('join_duel_', ''));
          if (isNaN(duelId)) {
            console.log('Invalid duel ID in callback:', data);
            await bot.answerCallbackQuery(callbackQueryId, { text: 'Invalid duel ID' });
            return;
          }
          await handleJoinSpecificDuel(telegramId, chatId, messageId, callbackQueryId, duelId);
        } else {
          console.log('Unknown callback data:', data);
          await bot.answerCallbackQuery(callbackQueryId, { text: 'Unknown action' });
        }
        break;
    }
  } catch (error) {
    console.error('Callback error:', error);
    // Always try to answer callback query even on error
    try {
      await bot.answerCallbackQuery(callbackQueryId, { text: 'Error occurred' });
    } catch (callbackError) {
      console.log('Could not answer callback query on error:', callbackError);
    }
  }
});

// Handle register wallet (private)
async function handleRegisterWallet(telegramId: number, groupChatId: number, callbackQueryId: string) {
  try {
    const user = await db.getUser(telegramId);
    if (!user) {
      await bot.answerCallbackQuery(callbackQueryId, { text: 'User not found' });
      return;
    }

    // Answer callback immediately
    await bot.answerCallbackQuery(callbackQueryId, { text: 'Opening private chat...' });

    // Try to send a message to open private chat instantly
    try {
      // Send a simple message to trigger the private chat to open
      await bot.sendMessage(telegramId, '🔐 Opening wallet registration...');
      
      // Small delay to ensure the chat opens
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const registrationMessage = `
🔐 *WALLET REGISTRATION*

*Your wallet address:* \`${user.wallet}\`

*To get started:*
1️⃣ Send SPL tokens to your wallet address
2️⃣ Send 0.01 SOL for transaction fees
3️⃣ Wait 1-2 minutes for confirmations
4️⃣ Return to group and use /duel or /join

⚠️ *Keep your wallet address private!*
`;

      const privateMenuKeyboard = {
        inline_keyboard: [
          [
            { text: '💰 Refresh Balance', callback_data: 'private_balance' },
            { text: '💳 Deposit', callback_data: 'private_deposit' }
          ],
          [
            { text: '💸 Withdraw', callback_data: 'private_withdraw' },
            { text: '📊 Stats', callback_data: 'private_stats' }
          ]
        ]
      };

      await bot.sendMessage(telegramId, registrationMessage, { parse_mode: 'Markdown' });
      
      // Send menu with buttons
      await bot.sendMessage(telegramId, '🔧 *WALLET MENU*', { 
        parse_mode: 'Markdown',
        reply_markup: privateMenuKeyboard
      });
      
      // Send a message in the group to confirm
      await bot.sendMessage(groupChatId, `✅ @${user.username || `User${telegramId}`} check your private chat for wallet registration!`, { parse_mode: 'Markdown' });
      
    } catch (error) {
      console.log('Could not send private message, sending group instructions');
      
      // If we can't send private message, send instructions in group with direct bot link
      const errorMessage = `
❌ *Private Chat Required*

*To register your wallet:*

1️⃣ Click the button below to open private chat
2️⃣ Press "Start" in private chat
3️⃣ Get your wallet and instructions
4️⃣ Return here and use commands

*Commands:*
• \`/duel 100\` - Start duel
• \`/join\` - Join duel
`;

      const groupKeyboard = {
        inline_keyboard: [
          [
            { text: '🔐 Open Private Chat', url: `https://t.me/jokerspvpbot?start=register` }
          ]
        ]
      };
      
      await bot.sendMessage(groupChatId, errorMessage, { 
        parse_mode: 'Markdown',
        reply_markup: groupKeyboard
      });
    }
    
  } catch (error) {
    console.error('Error in handleRegisterWallet:', error);
    try {
      await bot.answerCallbackQuery(callbackQueryId, { text: 'Error opening private chat' });
    } catch (callbackError) {
      console.log('Could not answer callback query:', callbackError);
    }
  }
}

// Handle start duel menu
async function handleStartDuel(telegramId: number, chatId: number, messageId: number, callbackQueryId: string) {
  const user = await db.getUser(telegramId);
  if (!user) {
    await bot.answerCallbackQuery(callbackQueryId, { text: 'Please register first' });
    return;
  }

  const duelKeyboard = {
    inline_keyboard: [
      [
        { text: '⚔️ Duel 10 tokens', callback_data: 'duel_10' },
        { text: '⚔️ Duel 50 tokens', callback_data: 'duel_50' }
      ],
      [
        { text: '⚔️ Duel 100 tokens', callback_data: 'duel_100' },
        { text: '⚔️ Duel 500 tokens', callback_data: 'duel_500' }
      ],
      [
        { text: '🔙 Back to Menu', callback_data: 'back_to_menu' }
      ]
    ]
  };

  await bot.editMessageText('⚔️ **Choose Duel Amount:**', {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: 'Markdown',
    reply_markup: duelKeyboard
  });
}

// Handle duel amount selection
async function handleDuelAmount(telegramId: number, chatId: number, amount: number, messageId: number, callbackQueryId: string) {
  try {
    const user = await db.getUser(telegramId);
    const username = user?.username || `User${telegramId}`;
    
    const result = await duelManager.startDuel(telegramId, amount);
    
    if (result.success) {
      // Answer callback immediately
      await bot.answerCallbackQuery(callbackQueryId, { text: `Duel started for ${amount} tokens!` });
      
      // Animation Step 1: Challenge Announcement
      const challengeMessage = `🎭 **THE JOKER'S CHALLENGE!** 🎭

👑 **${username}** throws down the gauntlet! 🗡️
💰 **Prize:** ${amount} JOKER tokens
🔥 **The arena awaits a worthy opponent...**

🎲 *The Joker's twisted game begins...*
⚡ *Who dares to accept this challenge?*

Use \`/join\` to enter the arena! 🎪`;
      
      const duelMessage = await bot.sendMessage(chatId, challengeMessage, { parse_mode: 'Markdown' });
      
      // Animation Step 2: Challenge intensifies
      setTimeout(async () => {
        try {
          const intensifyMessage = `⚔️ **THE CHALLENGE INTENSIFIES!** ⚔️

🎭 *The Joker's eyes gleam with madness...*

👑 **${username}** stands ready! ⚡
💰 **Prize:** ${amount} JOKER tokens
🔥 **The crowd roars with anticipation...**

🎲 *The arena trembles with excitement...*
⚡ *A worthy opponent approaches...*
🎯 *The battle is about to begin...*

Use \`/join\` to enter the arena! 🎪`;
          
          await bot.editMessageText(intensifyMessage, {
            chat_id: chatId,
            message_id: duelMessage.message_id,
            parse_mode: 'Markdown'
          });
          
          // Animation Step 3: Final call to arms
          setTimeout(async () => {
            try {
              const finalCallMessage = `🎪 **FINAL CALL TO ARMS!** 🎪

🎭 *The Joker's patience wears thin...*

👑 **${username}** awaits challengers! 🗡️
💰 **Prize:** ${amount} JOKER tokens
🔥 **The arena crackles with energy...**

🎲 *The Joker shuffles his deck...*
⚡ *Fate awaits the brave...*
🎯 *Will you answer the call?*

Use \`/join\` to enter the arena! 🎪`;
              
              await bot.editMessageText(finalCallMessage, {
                chat_id: chatId,
                message_id: duelMessage.message_id,
                parse_mode: 'Markdown'
              });
              
            } catch (error) {
              console.log('Error in final call animation:', error);
            }
            
          }, 2000); // 2 seconds for final call
          
        } catch (error) {
          console.log('Error in intensification animation:', error);
        }
        
      }, 2000); // 2 seconds for intensification
      
    } else {
      await bot.answerCallbackQuery(callbackQueryId, { text: result.message });
    }
  } catch (error) {
    console.error('Error in handleDuelAmount:', error);
    try {
      await bot.answerCallbackQuery(callbackQueryId, { text: 'Error starting duel' });
    } catch (callbackError) {
      console.log('Could not answer callback query:', callbackError);
    }
  }
}

// Handle join duel
async function handleJoinDuel(telegramId: number, chatId: number, messageId: number, callbackQueryId: string) {
  try {
    const user = await db.getUser(telegramId);
    const username = user?.username || `User${telegramId}`;
    const result = await duelManager.joinDuel(telegramId);
    
    if (result.success) {
      // Answer callback immediately
      await bot.answerCallbackQuery(callbackQueryId, { text: 'Joining duel...' });
      
      // Get duel info for display
      const pendingDuels = await db.getAllPendingDuels();
      if (pendingDuels.length > 0) {
        const duel = pendingDuels[0]; // Get the first available duel
        const player1User = await db.getUser(duel.player1);
        const player1Name = player1User?.username ? `@${player1User.username}` : `User${duel.player1}`;
        
        // Get the completed duel to see who actually won
        const completedDuel = await db.getDuel(duel.id);
        if (!completedDuel || !completedDuel.winner) {
          console.log('Could not determine winner from completed duel');
          await bot.sendMessage(chatId, '❌ Error determining winner');
          return;
        }
        
        // Determine winner based on actual winner from database
        const isPlayer2Winner = completedDuel.winner === telegramId;
        const winnerName = isPlayer2Winner ? username : player1Name;
        const loserName = isPlayer2Winner ? player1Name : username;
        
        // Start animated duel
        await playDuelAnimation(chatId, player1Name, username, duel.amount, async (player1Name, player2Name) => {
          // Show final result
          const resultMessage = `🎉 **[${winnerName}]** 🎉\n\n🏆 **WINNER!**\n💀 **${loserName}** loses\n💰 **${Math.floor(duel.amount * 1.9)}** tokens won\n\n🎯 *Duel completed successfully!*`;
          
          try {
            await bot.sendPhoto(chatId, './assets/images/winner-banner.png', {
              caption: resultMessage,
              parse_mode: 'Markdown'
            });
          } catch (error) {
            console.log('Error sending final result:', error);
          }
          
          // Send detailed result privately to both players
          try {
            await bot.sendMessage(telegramId, `🎯 **Duel Result:**\n\n${result.message}`, { parse_mode: 'Markdown' });
          } catch (error) {
            console.log('Could not send private result to player 2');
          }
          
          try {
            await bot.sendMessage(duel.player1, `🎯 **Duel Result:**\n\n${result.message}`, { parse_mode: 'Markdown' });
          } catch (error) {
            console.log('Could not send private result to player 1');
          }
        });
        
      }
    } else {
      await bot.answerCallbackQuery(callbackQueryId, { text: result.message });
    }
  } catch (error) {
    console.error('Error in handleJoinDuel:', error);
    try {
      await bot.answerCallbackQuery(callbackQueryId, { text: 'Error joining duel' });
    } catch (callbackError) {
      console.log('Could not answer callback query:', callbackError);
    }
  }
}

// Handle join specific duel
async function handleJoinSpecificDuel(telegramId: number, chatId: number, messageId: number, callbackQueryId: string, duelId: number) {
  console.log(`handleJoinSpecificDuel called: telegramId=${telegramId}, duelId=${duelId}`);
  
  try {
    // Answer callback immediately to prevent timeout
    await bot.answerCallbackQuery(callbackQueryId, { text: 'Joining duel...' });
    
    // Get user info
    const user = await db.getUser(telegramId);
    const username = user?.username ? `@${user.username}` : `User${telegramId}`;
    console.log(`User joining: ${username}`);

    // Get duel info
    const duel = await db.getDuel(duelId);
    if (!duel || duel.status !== 'pending') {
      console.log(`Duel ${duelId} not available:`, duel);
      await bot.sendMessage(chatId, '❌ Duel no longer available');
      return;
    }

    // Check if user is trying to join their own duel
    if (duel.player1 === telegramId) {
      console.log(`User trying to join own duel`);
      await bot.sendMessage(chatId, '❌ Cannot join your own duel');
      return;
    }

    console.log(`Joining duel ${duelId} with amount ${duel.amount}`);
    
    // Join the duel
    const result = await duelManager.joinDuel(telegramId, duelId);
    console.log(`Duel join result:`, result);
    
    if (result.success) {
      // Get player1 info
      const player1User = await db.getUser(duel.player1);
      const player1Name = player1User?.username ? `@${player1User.username}` : `User${duel.player1}`;
      
      console.log(`Processing duel: ${player1Name} vs ${username}`);
      
      // Get the completed duel to see who actually won
      const completedDuel = await db.getDuel(duelId);
      if (!completedDuel || !completedDuel.winner) {
        console.log('Could not determine winner from completed duel');
        await bot.sendMessage(chatId, '❌ Error determining winner');
        return;
      }
      
      // Determine winner based on actual winner from database
      const isPlayer2Winner = completedDuel.winner === telegramId;
      const winnerName = isPlayer2Winner ? username : player1Name;
      const loserName = isPlayer2Winner ? player1Name : username;
      
      console.log(`Winner: ${winnerName}, Loser: ${loserName}`);
      
      // Start loading animation with funny messages (shorter version)
      const loadingMessages = [
        `🎲 *Rolling the dice...*\n\n🎯 Calculating who's the lucky one...`,
        `🃏 *Joker is thinking...*\n\n🤔 Should I be fair today?`,
        `⚡ *Lightning strikes!*\n\n💥 Someone's about to get shocked!`,
        `🏆 *AND THE WINNER IS...*\n\n🎭 Drum roll please...`
      ];
      
      let currentMessage: any = null;
      
      try {
        // Send initial loading message
        currentMessage = await bot.sendMessage(chatId, loadingMessages[0], { 
          parse_mode: 'Markdown' 
        });
        console.log('Loading animation started');
        
        // Update with funny messages (faster)
        for (let i = 1; i < loadingMessages.length; i++) {
          await new Promise(resolve => setTimeout(resolve, 600)); // Reduced from 800ms
          
          try {
            await bot.editMessageText(loadingMessages[i], {
              chat_id: chatId,
              message_id: currentMessage.message_id,
              parse_mode: 'Markdown'
            });
            console.log(`Loading step ${i} updated`);
          } catch (error) {
            console.log('Error updating loading step:', error);
          }
        }
        
        // Final delay before showing result (shorter)
        await new Promise(resolve => setTimeout(resolve, 600)); // Reduced from 1000ms
        
        // Show final result
        const resultMessage = `🎉 **[${winnerName}]** 🎉\n\n🏆 **WINNER!**\n💀 **${loserName}** loses\n💰 **${Math.floor(duel.amount * 1.9)}** tokens won\n\n🎯 *Duel completed successfully!*`;
        
        try {
          // Send winner image with result as caption
          await bot.sendPhoto(chatId, './assets/images/winner-banner.png', {
            caption: resultMessage,
            parse_mode: 'Markdown'
          });
          console.log('Winner image sent with result');
        } catch (error) {
          console.log('Error sending winner image:', error);
          // Fallback: edit the loading message with result
          try {
            await bot.editMessageText(resultMessage, {
              chat_id: chatId,
              message_id: currentMessage.message_id,
              parse_mode: 'Markdown'
            });
            console.log('Final result displayed via edit');
          } catch (editError) {
            console.log('Error showing final result:', editError);
            // Fallback: send new message if edit fails
            await bot.sendMessage(chatId, resultMessage, { parse_mode: 'Markdown' });
          }
        }
        
      } catch (error) {
        console.error('Error in loading animation:', error);
        // Fallback: show result immediately
        const resultMessage = `🎉 **[${winnerName}]** 🎉\n\n🏆 **WINNER!**\n💀 **${loserName}** loses\n💰 **${Math.floor(duel.amount * 1.9)}** tokens won\n\n🎯 *Duel completed successfully!*`;
        await bot.sendMessage(chatId, resultMessage, { parse_mode: 'Markdown' });
      }
      
      // Send detailed result privately to both players
      try {
        await bot.sendMessage(telegramId, `🎯 **Duel Result:**\n\n${result.message}`, { parse_mode: 'Markdown' });
        console.log('Private result sent to player 2');
      } catch (error) {
        console.log('Could not send private result to player 2');
      }
      
      try {
        await bot.sendMessage(duel.player1, `🎯 **Duel Result:**\n\n${result.message}`, { parse_mode: 'Markdown' });
        console.log('Private result sent to player 1');
      } catch (error) {
        console.log('Could not send private result to player 1');
      }
      
    } else {
      console.log(`Duel join failed: ${result.message}`);
      await bot.sendMessage(chatId, `❌ ${result.message}`);
    }
    
  } catch (error) {
    console.error('Error joining specific duel:', error);
    // Always try to answer callback query even on error
    try {
      await bot.answerCallbackQuery(callbackQueryId, { text: 'Error joining duel' });
    } catch (callbackError) {
      console.log('Could not answer callback query:', callbackError);
    }
    await bot.sendMessage(chatId, '❌ Error joining duel');
  }
}

// Handle leaderboard
async function handleLeaderboard(chatId: number) {
  const leaderboard = await duelManager.getLeaderboard();

  if (leaderboard.length === 0) {
    await bot.sendMessage(chatId, '📊 **No games played yet.**\n\n🎯 *Be the first to start dueling!* 🏆\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return;
  }

  let message = '🏆 **WEEKLY LEADERBOARD**\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
  
  leaderboard.slice(0, 10).forEach((entry, index) => {
    const username = entry.username || `User${entry.telegram_id}`;
    const winRate = entry.wins + entry.losses > 0 
      ? Math.round((entry.wins / (entry.wins + entry.losses)) * 100) 
      : 0;
    
    const emoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🎯';
    message += `${emoji} **${index + 1}. ${username}**\n`;
    message += `   🏆 ${entry.wins}W/${entry.losses}L (${winRate}%)\n`;
    message += `   💰 ${entry.total_winnings} tokens won\n\n`;
  });

  message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

  await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
}

// Handle how to play
async function handleHowToPlay(chatId: number) {
  const message = `
🎮 **HOW TO PLAY JOKER DUEL GAMES**

📋 **Step 1: Register**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Click "Register Wallet" (private)
• Send SPL tokens + 0.01 SOL to your address
• Wait for confirmations

⚔️ **Step 2: Duel**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Choose duel amount (10-500 tokens)
• Wait for opponent to join
• Winner gets 95% of pot, 5% goes to chart

💰 **Step 3: Win**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Real blockchain transfers
• Tokens sent directly to winner
• All transactions are public on Solana

⚠️ **Important:**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Keep your wallet address private
• Only send correct SPL token
• SOL needed for transaction fees
• Minimum 0.01 SOL recommended

🎯 **Ready to start? Click "Register Wallet"!**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

  await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
}

// Handle back to menu
async function handleBackToMenu(telegramId: number, chatId: number, messageId: number) {
  // Get top 3 leaderboard
  const leaderboard = await duelManager.getLeaderboard();
  let leaderboardText = '';
  if (leaderboard.length > 0) {
    leaderboardText = '\n🏆 *TOP 3 PLAYERS*\n';
    leaderboard.slice(0, 3).forEach((entry, index) => {
      const uname = entry.username || `User${entry.telegram_id}`;
      const emoji = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
      leaderboardText += `${emoji} *${uname}* — ${entry.wins}W/${entry.losses}L\n`;
    });
  } else {
    leaderboardText = '\n🎯 *No games yet - Be the first!*';
  }

  const welcomeMessage = `
🎮 *JOKER DUEL GAMES*

⚔️ *1v1 SPL Token Battles on Solana*

${leaderboardText}

📋 *Quick Start:*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Click "🔐 Register" to get your wallet
• Send tokens + 0.01 SOL for fees
• Use /duel or /join to battle

🎯 *Commands:*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• \`/duel 100\` - Start a 100 token duel
• \`/join\` - Join pending duel
• \`/pvp\` - Open this menu
`;

  const menuKeyboard = {
    inline_keyboard: [
      [
        { text: '🔐 Register Wallet', callback_data: 'register_wallet' },
        { text: '⚔️ Start Duel', callback_data: 'start_duel' }
      ],
      [
        { text: '📊 Leaderboard', callback_data: 'leaderboard' },
        { text: 'ℹ️ How to Play', callback_data: 'how_to_play' }
      ]
    ]
  };

  try {
    // Send image with caption for group chats
    await bot.sendPhoto(chatId, './assets/images/menu-banner.png', {
      caption: welcomeMessage,
      parse_mode: 'Markdown',
      reply_markup: menuKeyboard
    });
  } catch (error) {
    console.error('Error sending menu image:', error);
    // Fallback to text message if image fails
    await bot.editMessageText(welcomeMessage, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: menuKeyboard
    });
  }
}

// Handler universal pentru orice mesaj privat (debug)
bot.on('message', async (msg) => {
  if (msg.chat.type === 'private') {
    console.log('PRIV MSG:', msg);
    
    // If it's a /start command in private chat, send wallet info
    if (msg.text === '/start' || msg.text?.startsWith('/start register')) {
      const telegramId = msg.from?.id;
      if (telegramId) {
        let user = await db.getUser(telegramId);
        
        // If user doesn't exist, create wallet automatically
        if (!user) {
          try {
            const username = msg.from?.username || msg.from?.first_name || null;
            const { wallet, encPrivkey } = await walletManager.generateWallet(telegramId, username);
            user = await db.getUser(telegramId);
            
            await bot.sendMessage(telegramId, `
🎉 *WALLET CREATED!*

Your wallet has been automatically created.
Address: \`${wallet}\`

*Next steps:*
1. Send SPL tokens to this address
2. Send 0.01 SOL for transaction fees
3. Wait 1-2 minutes for confirmations
4. Use buttons below to check balances

⚠️ *Keep your wallet address private!*
`, { parse_mode: 'Markdown' });
          } catch (error) {
            await bot.sendMessage(telegramId, '❌ Error creating wallet. Please try again.');
            return;
          }
        }
        
        if (user) {
          // Get current balances and stats
          const connection = new Connection(process.env.RPC_URL || 'https://api.mainnet-beta.solana.com');
          const walletPubkey = new PublicKey(user.wallet);
          
          let solBalance = 0;
          let tokenBalance = 0;
          let stats = { wins: 0, losses: 0, winRate: 0 };
          
          try {
            solBalance = await connection.getBalance(walletPubkey);
            tokenBalance = await walletManager.getTokenBalance(telegramId);
            stats = await duelManager.getUserStats(telegramId);
          } catch (error) {
            console.log('Could not fetch balances:', error);
          }

          const privateMessage = `
🔐 *YOUR WALLET*

*Address:* \`${user.wallet}\`

*Balances:*
• SOL: ${(solBalance / 1e9).toFixed(4)} SOL
• Tokens: ${tokenBalance} SPL

*Stats:*
• Wins: ${stats.wins} | Losses: ${stats.losses}
• Win Rate: ${stats.winRate}%
• Total Games: ${stats.wins + stats.losses}

${solBalance < 0.005 * 1e9 ? '⚠️ Need more SOL!' : '✅ SOL OK'}
${tokenBalance < 10 ? '⚠️ Need tokens!' : '✅ Tokens OK'}

*Setup Required:*
1. Send SPL tokens for dueling
2. Send 0.01 SOL for fees
3. Wait 1-2 minutes for confirmations

⚠️ *Keep your wallet address private!*

*Quick Actions:*
`;

          const privateMenuKeyboard = {
            inline_keyboard: [
              [
                { text: '💰 Refresh Balance', callback_data: 'private_balance' },
                { text: '💳 Deposit', callback_data: 'private_deposit' }
              ],
              [
                { text: '💸 Withdraw', callback_data: 'private_withdraw' },
                { text: '📊 Stats', callback_data: 'private_stats' }
              ]
            ]
          };

          try {
            await bot.sendMessage(telegramId, privateMessage, { 
              parse_mode: 'Markdown',
              reply_markup: privateMenuKeyboard
            });
          } catch (error) {
            await bot.sendMessage(telegramId, '❌ Error sending wallet info.');
          }
        }
      }
    } else {
      // For any other message in private chat
      await bot.sendMessage(msg.chat.id, '✅ Bot working! Use /start to get your wallet.');
    }
  }
});

// Error handler
bot.on('error', (error) => {
  console.error('Bot error:', error);
});

// Webhook handler for Vercel
export default async function handler(req: Request, res: Response) {
  if (req.method === 'POST') {
    try {
      const update = req.body;
      console.log('Processing update:', update);
      
      // Process message manually for webhook mode
      if (update.message) {
        const msg = update.message;
        console.log('Processing message:', msg.text);
        
        // Handle /start command
        if (msg.text === '/start' || msg.text?.startsWith('/start register')) {
          const telegramId = msg.from?.id;
          if (telegramId) {
            let user = await db.getUser(telegramId);
            
            // If user doesn't exist, create wallet automatically
            if (!user) {
              try {
                const username = msg.from?.username || msg.from?.first_name || null;
                const { wallet, encPrivkey } = await walletManager.generateWallet(telegramId, username);
                user = await db.getUser(telegramId);
                
                await bot.sendMessage(telegramId, `
🎉 *WALLET CREATED!*

Your wallet has been automatically created.
Address: \`${wallet}\`

*Next steps:*
1. Send SPL tokens to this address
2. Send 0.01 SOL for transaction fees
3. Wait 1-2 minutes for confirmations
4. Use buttons below to check balances

⚠️ *Keep your wallet address private!*
`, { parse_mode: 'Markdown' });
              } catch (error) {
                await bot.sendMessage(telegramId, '❌ Error creating wallet. Please try again.');
                res.status(200).json({ ok: true });
                return;
              }
            }
            
            if (user) {
              // Get current balances and stats
              const connection = new Connection(process.env.RPC_URL || 'https://api.mainnet-beta.solana.com');
              const walletPubkey = new PublicKey(user.wallet);
              
              let solBalance = 0;
              let tokenBalance = 0;
              let stats = { wins: 0, losses: 0, winRate: 0 };
              
              try {
                solBalance = await connection.getBalance(walletPubkey);
                tokenBalance = await walletManager.getTokenBalance(telegramId);
                stats = await duelManager.getUserStats(telegramId);
              } catch (error) {
                console.log('Could not fetch balances:', error);
              }

              const privateMessage = `
🔐 *YOUR WALLET*

*Address:* \`${user.wallet}\`

*Balances:*
• SOL: ${(solBalance / 1e9).toFixed(4)} SOL
• Tokens: ${tokenBalance} SPL

*Stats:*
• Wins: ${stats.wins} | Losses: ${stats.losses}
• Win Rate: ${stats.winRate}%
• Total Games: ${stats.wins + stats.losses}

${solBalance < 0.005 * 1e9 ? '⚠️ Need more SOL!' : '✅ SOL OK'}
${tokenBalance < 10 ? '⚠️ Need tokens!' : '✅ Tokens OK'}

*Setup Required:*
1. Send SPL tokens for dueling
2. Send 0.01 SOL for fees
3. Wait 1-2 minutes for confirmations

⚠️ *Keep your wallet address private!*

*Quick Actions:*
`;

              const privateMenuKeyboard = {
                inline_keyboard: [
                  [
                    { text: '💰 Refresh Balance', callback_data: 'private_balance' },
                    { text: '💳 Deposit', callback_data: 'private_deposit' }
                  ],
                  [
                    { text: '💸 Withdraw', callback_data: 'private_withdraw' },
                    { text: '📊 Stats', callback_data: 'private_stats' }
                  ]
                ]
              };

              try {
                await bot.sendMessage(telegramId, privateMessage, { 
                  parse_mode: 'Markdown',
                  reply_markup: privateMenuKeyboard
                });
              } catch (error) {
                await bot.sendMessage(telegramId, '❌ Error sending wallet info.');
              }
            }
          }
        }
        // Handle /pvp command
        else if (msg.text === '/pvp') {
          const chatId = msg.chat.id;
          const telegramId = msg.from?.id;
          const username = msg.from?.username || msg.from?.first_name || `User${telegramId}`;

          if (!telegramId) {
            await bot.sendMessage(chatId, '❌ Error: Could not identify user');
            res.status(200).json({ ok: true });
            return;
          }

          // Add group chat to active chats for announcements
          if (msg.chat.type !== 'private') {
            activeGroupChats.add(chatId);
          }

          // Create user if doesn't exist
          let user = await db.getUser(telegramId);
          if (!user) {
            try {
              const { wallet, encPrivkey } = await walletManager.generateWallet(telegramId, username);
              user = await db.getUser(telegramId);
            } catch (error) {
              console.error('Error creating user:', error);
              await bot.sendMessage(chatId, '❌ Error creating user. Please try again.');
              res.status(200).json({ ok: true });
              return;
            }
          }

          if (user) {
            try {
              // Send menu image with buttons
              await bot.sendPhoto(chatId, './assets/images/menu-banner.png', {
                caption: `
🎮 *JOKER DUEL GAMES* 🎮

Welcome, **${username}**! 

⚔️ *Ready to duel?*
💰 *Ready to win?*
🎯 *Ready to dominate?*

Choose your action below:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`,
                parse_mode: 'Markdown',
                reply_markup: {
                  inline_keyboard: [
                    [
                      { text: '⚔️ Start Duel', callback_data: 'start_duel' },
                      { text: '🎯 Join Duel', callback_data: 'join_duel' }
                    ],
                    [
                      { text: '💰 Balance', callback_data: 'register_wallet' },
                      { text: '📊 Leaderboard', callback_data: 'leaderboard' }
                    ],
                    [
                      { text: '❓ How to Play', callback_data: 'how_to_play' }
                    ]
                  ]
                }
              });
            } catch (error) {
              console.error('Error sending menu image:', error);
              // Fallback to text message
              await bot.sendMessage(chatId, `
🎮 *JOKER DUEL GAMES* 🎮

Welcome, **${username}**! 

⚔️ *Ready to duel?*
💰 *Ready to win?*
🎯 *Ready to dominate?*

Choose your action below:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`, {
                parse_mode: 'Markdown',
                reply_markup: {
                  inline_keyboard: [
                    [
                      { text: '⚔️ Start Duel', callback_data: 'start_duel' },
                      { text: '🎯 Join Duel', callback_data: 'join_duel' }
                    ],
                    [
                      { text: '💰 Balance', callback_data: 'register_wallet' },
                      { text: '📊 Leaderboard', callback_data: 'leaderboard' }
                    ],
                    [
                      { text: '❓ How to Play', callback_data: 'how_to_play' }
                    ]
                  ]
                }
              });
            }
          }
        }
        // Handle other messages in private chat
        else if (msg.chat.type === 'private') {
          await bot.sendMessage(msg.chat.id, '✅ Bot working! Use /start to get your wallet or /pvp for duels.');
        }
      }
      
      // Process callback queries
      if (update.callback_query) {
        await bot.processUpdate(update);
      }
      
      res.status(200).json({ ok: true });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

// Start token monitoring when the module loads
if (process.env.NODE_ENV === 'production') {
  tokenChecker.startMonitoring();
}

// Cleanup old duels periodically
setInterval(async () => {
  await duelManager.cleanupOldDuels();
}, 60000); // Every minute

// Start periodic announcements every 3 minutes
setInterval(announceActiveDuels, 3 * 60 * 1000); // 3 minutes

console.log('Joker Duel Games Bot is running!');

// Add command handlers for /duel and /join
bot.onText(/\/duel (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from?.id;
  const amount = parseFloat(match?.[1] || '0');

  if (!telegramId) {
    await bot.sendMessage(chatId, '❌ Error: Could not identify user');
    return;
  }

  if (isNaN(amount) || amount <= 0) {
    await bot.sendMessage(chatId, '❌ Please provide a valid amount: /duel <amount>\nExample: /duel 100');
    return;
  }

  const result = await duelManager.startDuel(telegramId, amount);
  
  if (result.success) {
    // Get real username
    const user = await db.getUser(telegramId);
    const username = user?.username ? `@${user.username}` : (msg.from?.username ? `@${msg.from.username}` : msg.from?.first_name || `User${telegramId}`);
    
    await bot.sendMessage(chatId, `⚔️ **${username}** started a duel for **${amount}** tokens!\n\n🎯 *Use \`/join\` to join!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, { parse_mode: 'Markdown' });
  } else {
    await bot.sendMessage(chatId, `❌ ${result.message}`);
  }
});

// Add cancel duel command
bot.onText(/\/cancel_duel/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from?.id;

  if (!telegramId) {
    await bot.sendMessage(chatId, '❌ Error: Could not identify user');
    return;
  }

  try {
    const result = await duelManager.cancelDuel(telegramId);
    
    if (result.success) {
      await bot.sendMessage(chatId, `✅ **Duel cancelled successfully!**\n\n${result.message}`, { parse_mode: 'Markdown' });
    } else {
      await bot.sendMessage(chatId, `❌ ${result.message}`);
    }
  } catch (error) {
    console.error('Error cancelling duel:', error);
    await bot.sendMessage(chatId, '❌ Error cancelling duel');
  }
});

// Add withdraw SOL command
bot.onText(/\/withdraw_sol (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from?.id;

  if (!telegramId) {
    await bot.sendMessage(chatId, '❌ Error: Could not identify user');
    return;
  }

  // Only allow in private chat
  if (msg.chat.type !== 'private') {
    await bot.sendMessage(chatId, '❌ Withdraw SOL command only works in private chat');
    return;
  }

  const args = match?.[1]?.split(' ');
  if (!args || args.length !== 2) {
    await bot.sendMessage(chatId, '❌ Format: /withdraw_sol <amount> <sol_address>\nExample: /withdraw_sol 0.01 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU');
    return;
  }

  const amount = parseFloat(args[0]);
  const solAddress = args[1];

  if (isNaN(amount) || amount <= 0) {
    await bot.sendMessage(chatId, '❌ Please provide a valid SOL amount');
    return;
  }

  // Validate SOL address format
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(solAddress)) {
    await bot.sendMessage(chatId, '❌ Invalid SOL address format');
    return;
  }

  try {
    const result = await walletManager.withdrawSol(telegramId, amount, solAddress);
    
    if (result.success) {
      const successMessage = `
✅ *SOL WITHDRAWAL COMPLETED!*

Amount: ${amount} SOL
To: \`${solAddress}\`
Transaction: \`${result.signature}\`

🔗 View on Solscan: https://solscan.io/tx/${result.signature}
`;
      
      await bot.sendMessage(chatId, successMessage, { parse_mode: 'Markdown' });
    } else {
      await bot.sendMessage(chatId, `❌ ${result.message}`);
    }
  } catch (error) {
    console.error('Error withdrawing SOL:', error);
    await bot.sendMessage(chatId, '❌ Error processing SOL withdrawal');
  }
});

// Add export wallet command
bot.onText(/\/export_wallet/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from?.id;

  if (!telegramId) {
    await bot.sendMessage(chatId, '❌ Error: Could not identify user');
    return;
  }

  // Only allow in private chat
  if (msg.chat.type !== 'private') {
    await bot.sendMessage(chatId, '❌ Export wallet command only works in private chat');
    return;
  }

  try {
    const result = await walletManager.exportWallet(telegramId);
    
    if (result.success) {
      const exportMessage = `
🔐 **WALLET EXPORT**

**Wallet Address:**
\`${result.walletAddress}\`

**Private Key (Base58):**
\`${result.privateKey}\`

**Private Key (Array):**
\`[${result.privateKeyArray?.join(', ') || ''}]\`

⚠️ **SECURITY WARNING:**
• Keep your private key safe and secret
• Never share it with anyone
• Anyone with this key can access your wallet
• Store it securely offline
• You can import this wallet in Phantom, Solflare, etc.

🔗 **Import Instructions:**
1. Open your wallet app (Phantom, Solflare, etc.)
2. Choose "Import Private Key"
3. Paste the private key above
4. Your wallet will be imported with all tokens

💡 **Note:** Your wallet will remain active in the bot even after export
`;
      
      await bot.sendMessage(chatId, exportMessage, { parse_mode: 'Markdown' });
    } else {
      await bot.sendMessage(chatId, `❌ ${result.message}`);
    }
  } catch (error) {
    console.error('Error exporting wallet:', error);
    await bot.sendMessage(chatId, '❌ Error exporting wallet');
  }
});

bot.onText(/\/join/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from?.id;

  if (!telegramId) {
    await bot.sendMessage(chatId, '❌ Error: Could not identify user');
    return;
  }

  // Get real username
  const user = await db.getUser(telegramId);
  const username = user?.username || msg.from?.username || msg.from?.first_name || `User${telegramId}`;

  try {
    // Get all pending duels
    const pendingDuels = await db.getAllPendingDuels();
    
    if (pendingDuels.length === 0) {
      await bot.sendMessage(chatId, '❌ No pending duels available.\n\nUse `/duel <amount>` to start a new duel!', { parse_mode: 'Markdown' });
      return;
    }

    // Filter out user's own duels
    const availableDuels = pendingDuels.filter(duel => duel.player1 !== telegramId);
    
    if (availableDuels.length === 0) {
      await bot.sendMessage(chatId, '❌ No duels available to join.\n\nAll pending duels are yours!');
      return;
    }

    // Create selection message
    let message = `⚔️ **AVAILABLE DUELS** ⚔️\n\nChoose a duel to join:\n\n`;
    
    const keyboard = {
      inline_keyboard: [] as any[]
    };

    // Add up to 5 available duels
    for (let i = 0; i < Math.min(availableDuels.length, 5); i++) {
      const duel = availableDuels[i];
      const player1User = await db.getUser(duel.player1);
      const player1Name = player1User?.username || `User${duel.player1}`;
      
      message += `${i + 1}. **${duel.amount}** tokens vs **${player1Name}**\n`;
      
      keyboard.inline_keyboard.push([
        {
          text: `Join ${duel.amount} tokens duel`,
          callback_data: `join_duel_${duel.id}`
        }
      ]);
    }

    message += `\n *Click a button to join the duel!*`;

    await bot.sendMessage(chatId, message, { 
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

  } catch (error) {
    console.error('Error in /join:', error);
    await bot.sendMessage(chatId, '❌ Error loading available duels. Please try again.');
  }
});

// Add support for /join @username
bot.onText(/\/join @(.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from?.id;
  const targetUsername = match?.[1];

  if (!telegramId || !targetUsername) {
    await bot.sendMessage(chatId, '❌ Format: /join @username');
    return;
  }

  // Get real username
  const user = await db.getUser(telegramId);
  const username = user?.username || msg.from?.username || msg.from?.first_name || `User${telegramId}`;

  // Check if user is trying to duel themselves
  if (username.toLowerCase() === targetUsername.toLowerCase()) {
    await bot.sendMessage(chatId, `❌ You cannot duel yourself!`);
    return;
  }

  // Check if target user exists and has a pending duel
  try {
    // First, try to find the target user by username
    const allUsers = await db.getAllUsers();
    const targetUser = allUsers.find((user: User) => 
      user.username && user.username.toLowerCase() === targetUsername.toLowerCase()
    );

    if (!targetUser) {
      await bot.sendMessage(chatId, `❌ User @${targetUsername} not found.`);
      return;
    }

    // Check if target user has a pending duel
    const userPendingDuel = await db.getUserPendingDuel(targetUser.telegram_id);
    if (!userPendingDuel) {
      await bot.sendMessage(chatId, `❌ @${targetUsername} doesn't have a pending duel.`);
      return;
    }

    // Join the specific duel
    const result = await duelManager.joinDuel(telegramId, userPendingDuel.id);
    
    if (result.success) {
      const player1Name = targetUser.username || `User${userPendingDuel.player1}`;
      
      // Get the completed duel to see who actually won
      const completedDuel = await db.getDuel(userPendingDuel.id);
      if (!completedDuel || !completedDuel.winner) {
        console.log('Could not determine winner from completed duel');
        await bot.sendMessage(chatId, '❌ Error determining winner');
        return;
      }
      
      // Determine winner based on actual winner from database
      const isPlayer2Winner = completedDuel.winner === telegramId;
      const winnerName = isPlayer2Winner ? username : player1Name;
      const loserName = isPlayer2Winner ? player1Name : username;
      
      // Start animated duel
      await playDuelAnimation(chatId, player1Name, username, userPendingDuel.amount, async (player1Name, player2Name) => {
        // Show final result
        const resultMessage = `🎉 **[${winnerName}]** 🎉\n\n🏆 **WINNER!**\n💀 **${loserName}** loses\n💰 **${Math.floor(userPendingDuel.amount * 1.9)}** tokens won\n\n🎯 *Duel completed successfully!*`;
        
        try {
          await bot.sendPhoto(chatId, './assets/images/winner-banner.png', {
            caption: resultMessage,
            parse_mode: 'Markdown'
          });
        } catch (error) {
          console.log('Error sending final result:', error);
        }
        
        // Send detailed result privately to both players
        try {
          await bot.sendMessage(telegramId, `🎯 **Duel Result:**\n\n${result.message}`, { parse_mode: 'Markdown' });
        } catch (error) {
          console.log('Could not send private result to player 2');
        }
        
        try {
          await bot.sendMessage(userPendingDuel.player1, `🎯 **Duel Result:**\n\n${result.message}`, { parse_mode: 'Markdown' });
        } catch (error) {
          console.log('Could not send private result to player 1');
        }
      });
      
    } else {
      await bot.sendMessage(chatId, `❌ ${result.message}`);
    }
    
  } catch (error) {
    console.error('Error in /join @username:', error);
    await bot.sendMessage(chatId, `❌ Error processing challenge.`);
  }
});

// Add withdraw command handler for private chat
bot.onText(/\/withdraw (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from?.id;

  if (!telegramId) {
    await bot.sendMessage(chatId, 'Error: Could not identify user');
    return;
  }

  // Only allow in private chat
  if (msg.chat.type !== 'private') {
    await bot.sendMessage(chatId, '❌ Withdraw command only works in private chat');
    return;
  }

  const args = match?.[1]?.split(' ');
  if (!args || args.length !== 2) {
    await bot.sendMessage(chatId, '❌ Format: /withdraw <amount> <sol_address>\nExample: /withdraw 100 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU');
    return;
  }

  const amount = parseFloat(args[0]);
  const solAddress = args[1];

  if (isNaN(amount) || amount <= 0) {
    await bot.sendMessage(chatId, '❌ Please provide a valid amount');
    return;
  }

  // Validate SOL address format
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(solAddress)) {
    await bot.sendMessage(chatId, '❌ Invalid SOL address format');
    return;
  }

  try {
    const user = await db.getUser(telegramId);
    if (!user) {
      await bot.sendMessage(chatId, '❌ User not found');
      return;
    }

    // Get real balance from blockchain
    const realBalance = await walletManager.getTokenBalance(telegramId);
    if (realBalance < amount) {
      await bot.sendMessage(chatId, `❌ Insufficient balance. You have ${realBalance} tokens`);
      return;
    }

    // Send initial confirmation
    await bot.sendMessage(chatId, `
💸 *WITHDRAWAL REQUEST*

Amount: ${amount} tokens
To: \`${solAddress}\`

🔄 Processing withdrawal...
⏳ This may take a few minutes.

You will receive a confirmation when completed.
`, { parse_mode: 'Markdown' });

    // Process the actual withdrawal
    try {
      console.log(`Processing withdrawal: ${amount} tokens from ${telegramId} to ${solAddress}`);
      
      const signature = await walletManager.transferTokens(telegramId, solAddress, amount);
      
      if (signature) {
        // Calculate new balance: old balance - withdrawn amount
        const newBalance = realBalance - amount;
        
        // Update local balance to reflect the withdrawal
        await db.updateBalance(telegramId, newBalance);
        
        const successMessage = `
✅ *WITHDRAWAL COMPLETED!*

Amount: ${amount} tokens
To: \`${solAddress}\`
Transaction: \`${signature}\`

💰 Your new balance: ${newBalance} tokens

🔗 View on Solscan: https://solscan.io/tx/${signature}
`;
        
        await bot.sendMessage(chatId, successMessage, { parse_mode: 'Markdown' });
      } else {
        await bot.sendMessage(chatId, `
❌ *WITHDRAWAL FAILED*

Amount: ${amount} tokens
To: \`${solAddress}\`

Possible reasons:
• Destination wallet doesn't have token account
• Insufficient SOL for transaction fees (need ~0.005 SOL)
• Network error

Please try again or contact support.
`, { parse_mode: 'Markdown' });
      }
    } catch (transferError) {
      console.error('Transfer error:', transferError);
      
      let errorMessage = 'Unknown error occurred';
      if (transferError instanceof Error) {
        if (transferError.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient SOL for transaction fees. Please send 0.005 SOL to your wallet.';
        } else if (transferError.message.includes('Account does not exist')) {
          errorMessage = 'Destination wallet does not have a token account. Please ask them to create one first.';
        } else {
          errorMessage = transferError.message;
        }
      }
      
      await bot.sendMessage(chatId, `
❌ *WITHDRAWAL ERROR*

Amount: ${amount} tokens
To: \`${solAddress}\`

Error: ${errorMessage}

Please try again or contact support.
`, { parse_mode: 'Markdown' });
    }

  } catch (error) {
    console.error('Withdraw error:', error);
    await bot.sendMessage(chatId, '❌ Error processing withdrawal request');
  }
});

// Handle private balance
async function handlePrivateBalance(telegramId: number, callbackQueryId: string) {
  const user = await db.getUser(telegramId);
  if (!user) {
    await bot.answerCallbackQuery(callbackQueryId, { text: 'User not found' });
    return;
  }

  try {
    const connection = new Connection(process.env.RPC_URL || 'https://api.mainnet-beta.solana.com');
    const walletPubkey = new PublicKey(user.wallet);
    
    const solBalance = await connection.getBalance(walletPubkey);
    const tokenBalance = await walletManager.getTokenBalance(telegramId);
    const stats = await duelManager.getUserStats(telegramId);
    
    const balanceMessage = `
💰 *WALLET OVERVIEW*

*Address:* \`${user.wallet}\`

*Balances:*
• SOL: ${(solBalance / 1e9).toFixed(4)} SOL
• Tokens: ${tokenBalance} SPL

*Stats:*
• Wins: ${stats.wins} | Losses: ${stats.losses}
• Win Rate: ${stats.winRate}%
• Total Games: ${stats.wins + stats.losses}

${solBalance < 0.005 * 1e9 ? '⚠️ Need more SOL!' : '✅ SOL OK'}
${tokenBalance < 10 ? '⚠️ Need tokens!' : '✅ Tokens OK'}
`;

    const privateMenuKeyboard = {
      inline_keyboard: [
        [
          { text: '💰 Refresh Balance', callback_data: 'private_balance' },
          { text: '💳 Deposit', callback_data: 'private_deposit' }
        ],
        [
          { text: '💸 Withdraw', callback_data: 'private_withdraw' },
          { text: '📊 Stats', callback_data: 'private_stats' }
        ]
      ]
    };
    
    await bot.sendMessage(telegramId, balanceMessage, { 
      parse_mode: 'Markdown',
      reply_markup: privateMenuKeyboard
    });
    await bot.answerCallbackQuery(callbackQueryId, { text: 'Balance updated!' });
  } catch (error) {
    await bot.sendMessage(telegramId, '⚠️ Could not check balances.');
    await bot.answerCallbackQuery(callbackQueryId, { text: 'Error checking balance' });
  }
}

// Handle private deposit
async function handlePrivateDeposit(telegramId: number, callbackQueryId: string) {
  const user = await db.getUser(telegramId);
  if (!user) {
    await bot.answerCallbackQuery(callbackQueryId, { text: 'User not found' });
    return;
  }

  const depositMessage = `
💳 *DEPOSIT ADDRESS*

*Your Wallet:* \`${user.wallet}\`

*Instructions:*
1. Send SPL tokens to this address
2. Send 0.01 SOL for transaction fees
3. Wait 1-2 minutes for confirmations
4. Use /balance to check

⚠️ *Only send the correct SPL token!*

*Quick Actions:*
`;

  const privateMenuKeyboard = {
    inline_keyboard: [
      [
        { text: '💰 Refresh Balance', callback_data: 'private_balance' },
        { text: '💳 Deposit', callback_data: 'private_deposit' }
      ],
      [
        { text: '💸 Withdraw', callback_data: 'private_withdraw' },
        { text: '📊 Stats', callback_data: 'private_stats' }
      ]
    ]
  };

  await bot.sendMessage(telegramId, depositMessage, { 
    parse_mode: 'Markdown',
    reply_markup: privateMenuKeyboard
  });
  await bot.answerCallbackQuery(callbackQueryId, { text: 'Deposit address sent!' });
}

// Handle private withdraw
async function handlePrivateWithdraw(telegramId: number, callbackQueryId: string) {
  try {
    await bot.answerCallbackQuery(callbackQueryId, { text: 'Withdraw tokens' });
    
    const message = `
💸 **WITHDRAW TOKENS**

To withdraw your tokens, use this command:

\`/withdraw <amount> <sol_address>\`

**Example:**
\`/withdraw 100 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU\`

⚠️ **Important:**
• Only works in private chat
• Make sure the destination wallet supports SPL tokens
• You need SOL for transaction fees
• Minimum withdrawal: 1 token
`;

    await bot.sendMessage(telegramId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error in handlePrivateWithdraw:', error);
  }
}

// Handle private stats
async function handlePrivateStats(telegramId: number, callbackQueryId: string) {
  const user = await db.getUser(telegramId);
  if (!user) {
    await bot.answerCallbackQuery(callbackQueryId, { text: 'User not found' });
    return;
  }

  try {
    const stats = await duelManager.getUserStats(telegramId);
    const balance = await duelManager.getBalance(telegramId);

    const statsMessage = `
📊 *YOUR STATS*

🏆 Wins: ${stats.wins}
💔 Losses: ${stats.losses}
📈 Win Rate: ${stats.winRate}%
💰 Balance: ${balance} tokens

Total Games: ${stats.wins + stats.losses}

*Quick Actions:*
`;

    const privateMenuKeyboard = {
      inline_keyboard: [
        [
          { text: '💰 Refresh Balance', callback_data: 'private_balance' },
          { text: '💳 Deposit', callback_data: 'private_deposit' }
        ],
        [
          { text: '💸 Withdraw', callback_data: 'private_withdraw' },
          { text: '📊 Stats', callback_data: 'private_stats' }
        ]
      ]
    };

    await bot.sendMessage(telegramId, statsMessage, { 
      parse_mode: 'Markdown',
      reply_markup: privateMenuKeyboard
    });
    await bot.answerCallbackQuery(callbackQueryId, { text: 'Stats sent!' });
  } catch (error) {
    await bot.sendMessage(telegramId, '⚠️ Could not load stats.');
    await bot.answerCallbackQuery(callbackQueryId, { text: 'Error loading stats' });
  }
}

// Add balance command handler
bot.onText(/\/balance/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from?.id;

  if (!telegramId) {
    await bot.sendMessage(chatId, '❌ Error: Could not identify user');
    return;
  }

  // Only allow in private chat
  if (msg.chat.type !== 'private') {
    await bot.sendMessage(chatId, '❌ Balance command only works in private chat');
    return;
  }

  try {
    const user = await db.getUser(telegramId);
    if (!user) {
      await bot.sendMessage(chatId, '❌ User not found. Please register first with /start');
      return;
    }

    const connection = new Connection(process.env.RPC_URL || 'https://api.mainnet-beta.solana.com');
    const walletPubkey = new PublicKey(user.wallet);
    
    const solBalance = await connection.getBalance(walletPubkey);
    const tokenBalance = await walletManager.getTokenBalance(telegramId);
    const stats = await duelManager.getUserStats(telegramId);
    
    const balanceMessage = `
💰 *WALLET OVERVIEW*

*Address:* \`${user.wallet}\`

*Balances:*
• SOL: ${(solBalance / 1e9).toFixed(4)} SOL
• Tokens: ${tokenBalance} SPL

*Stats:*
• Wins: ${stats.wins} | Losses: ${stats.losses}
• Win Rate: ${stats.winRate}%
• Total Games: ${stats.wins + stats.losses}

${solBalance < 0.005 * 1e9 ? '⚠️ Need more SOL!' : '✅ SOL OK'}
${tokenBalance < 10 ? '⚠️ Need tokens!' : '✅ Tokens OK'}
`;

    await bot.sendMessage(chatId, balanceMessage, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Balance error:', error);
    await bot.sendMessage(chatId, '❌ Error checking balance. Please try again.');
  }
});

// Add commands handler
bot.onText(/\/commands/, async (msg) => {
  const chatId = msg.chat.id;
  
  const commandsMessage = `
🎮 *JOKER DUEL GAMES - COMMANDS*

*Main Commands:*
• \`/start\` - Start the bot and get menu
• \`/duel <amount>\` - Start a duel (10-500 tokens)
• \`/join\` - Join available duels
• \`/join @username\` - Join specific user's duel

*Private Chat Commands:*
• \`/balance\` - Check wallet balance
• \`/deposit\` - Get deposit address
• \`/stats\` - View your statistics
• \`/withdraw\` - Withdraw tokens

*Info Commands:*
• \`/help\` - Get help and instructions
• \`/info\` - Bot information
• \`/commands\` - Show this list

*Examples:*
• \`/duel 100\` - Start 100 token duel
• \`/join @TinKode69\` - Join TinKode69's duel
`;

  await bot.sendMessage(chatId, commandsMessage, { parse_mode: 'Markdown' });
});

// Add help handler
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  
  const helpMessage = `
🎮 *JOKER DUEL GAMES - HELP*

*How to Play:*

1️⃣ **Register Wallet**
   • Click "Register Wallet" button
   • Get your private wallet address
   • Send SPL tokens + 0.01 SOL

2️⃣ **Start Dueling**
   • Use \`/duel 100\` to start a duel
   • Wait for opponent to join
   • Winner gets 95% of pot

3️⃣ **Join Duels**
   • Use \`/join\` to see available duels
   • Click on duel to join
   • Or use \`/join @username\` for specific user

*Important Notes:*
• Keep your wallet address private
• Only send correct SPL token
• Minimum 0.01 SOL for fees
• All transactions are on Solana blockchain

*Need Help?*
• Use \`/commands\` for all commands
• Use \`/info\` for bot information
• Contact support if needed

🎯 *Ready to start dueling? Use /duel 100!*
`;

  await bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
});

// Add info handler
bot.onText(/\/info/, async (msg) => {
  const chatId = msg.chat.id;
  
  const infoMessage = `
🎮 *JOKER DUEL GAMES - BOT INFO*

*About the Bot:*
• 1v1 SPL Token Battles on Solana
• Real blockchain transfers
• 5% fee goes to chart support
• 95% goes to winner

*Technical Details:*
• Built on Solana blockchain
• Uses SPL tokens for battles
• Custodial wallet system
• Real-time balance checking

*Features:*
• ⚔️ 1v1 duels with any amount
• 🎲 Random winner selection
• 💰 Real token transfers
• 📊 Statistics tracking
• 🏆 Leaderboard system

*Security:*
• Encrypted wallet storage
• Private wallet addresses
• Public blockchain transactions
• No central authority

*Commands:*
• \`/commands\` - Show all commands
• \`/help\` - Get help and instructions

🎯 *Join the Joker's twisted game of chance!*
`;

  await bot.sendMessage(chatId, infoMessage, { parse_mode: 'Markdown' });
});

// Add deposit command handler
bot.onText(/\/deposit/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from?.id;

  if (!telegramId) {
    await bot.sendMessage(chatId, '❌ Error: Could not identify user');
    return;
  }

  // Only allow in private chat
  if (msg.chat.type !== 'private') {
    await bot.sendMessage(chatId, '❌ Deposit command only works in private chat');
    return;
  }

  try {
    const user = await db.getUser(telegramId);
    if (!user) {
      await bot.sendMessage(chatId, '❌ User not found. Please register first with /start');
      return;
    }

    const depositMessage = `
💳 *DEPOSIT ADDRESS*

*Your wallet address:* \`${user.wallet}\`

*To deposit:*
1. Send SPL tokens to this address
2. Send 0.01 SOL for transaction fees
3. Wait 1-2 minutes for confirmations
4. Use /balance to check your balance

⚠️ *Keep your wallet address private!*
`;

    await bot.sendMessage(chatId, depositMessage, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Deposit error:', error);
    await bot.sendMessage(chatId, '❌ Error getting deposit address. Please try again.');
  }
});

// Add stats command handler
bot.onText(/\/stats/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from?.id;

  if (!telegramId) {
    await bot.sendMessage(chatId, '❌ Error: Could not identify user');
    return;
  }

  try {
    const user = await db.getUser(telegramId);
    if (!user) {
      await bot.sendMessage(chatId, '❌ User not found. Please register first with /start');
      return;
    }

    const stats = await duelManager.getUserStats(telegramId);
    const tokenBalance = await walletManager.getTokenBalance(telegramId);
    
    const statsMessage = `
📊 *PLAYER STATISTICS*

*Username:* ${user.username || `User${telegramId}`}
*Wallet:* \`${user.wallet}\`

*Battle Record:*
• Wins: ${stats.wins} 🏆
• Losses: ${stats.losses} 💀
• Win Rate: ${stats.winRate}%
• Total Games: ${stats.wins + stats.losses}

*Current Balance:*
• Tokens: ${tokenBalance} SPL

${stats.wins > stats.losses ? '🎉 *You are a winner!*' : stats.losses > stats.wins ? '💪 *Keep fighting!*' : '⚖️ *Perfect balance!*'}
`;

    await bot.sendMessage(chatId, statsMessage, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Stats error:', error);
    await bot.sendMessage(chatId, '❌ Error loading stats. Please try again.');
  }
});

// Add leaderboard command handler
bot.onText(/\/leaderboard/, async (msg) => {
  const chatId = msg.chat.id;
  
  try {
    const leaderboard = await duelManager.getLeaderboard();

    if (leaderboard.length === 0) {
      await bot.sendMessage(chatId, '📊 **No games played yet.**\n\n🎯 *Be the first to start dueling!* 🏆\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return;
    }

    let message = '🏆 **WEEKLY LEADERBOARD**\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
    
    leaderboard.slice(0, 10).forEach((entry, index) => {
      const username = entry.username || `User${entry.telegram_id}`;
      const winRate = entry.wins + entry.losses > 0 
        ? Math.round((entry.wins / (entry.wins + entry.losses)) * 100) 
        : 0;
      
      const emoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🎯';
      message += `${emoji} **${index + 1}. ${username}**\n`;
      message += `   🏆 ${entry.wins}W/${entry.losses}L (${winRate}%)\n`;
      message += `   💰 ${entry.total_winnings} tokens won\n\n`;
    });

    message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Leaderboard error:', error);
    await bot.sendMessage(chatId, '❌ Error loading leaderboard. Please try again.');
  }
});

// Add duels command handler to show active duels
bot.onText(/\/duels/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const pendingDuels = await db.getAllPendingDuels();

    if (pendingDuels.length === 0) {
      await bot.sendMessage(chatId, '📊 **No active duels.**\n\nStart one with `/duel 100`!', { parse_mode: 'Markdown' });
      return;
    }

    let message = '⚔️ **Active Duels:**\n\n';
    
    pendingDuels.forEach((duel, index) => {
      message += `${index + 1}. **${duel.amount}** tokens\n`;
      message += `   Waiting for opponent...\n\n`;
    });

    message += 'Use `/join` to join any duel!';

    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Duels error:', error);
    await bot.sendMessage(chatId, '❌ Error loading duels.');
  }
});

// Handle private cancel duel
async function handlePrivateCancelDuel(telegramId: number, callbackQueryId: string) {
  try {
    await bot.answerCallbackQuery(callbackQueryId, { text: 'Cancelling duel...' });
    
    const result = await duelManager.cancelDuel(telegramId);
    
    if (result.success) {
      await bot.sendMessage(telegramId, `✅ **Duel Cancelled!**\n\n${result.message}`, { parse_mode: 'Markdown' });
    } else {
      await bot.sendMessage(telegramId, `❌ ${result.message}`, { parse_mode: 'Markdown' });
    }
  } catch (error) {
    console.error('Error in handlePrivateCancelDuel:', error);
    await bot.sendMessage(telegramId, '❌ Error cancelling duel');
  }
}

// Handle private withdraw SOL
async function handlePrivateWithdrawSol(telegramId: number, callbackQueryId: string) {
  try {
    await bot.answerCallbackQuery(callbackQueryId, { text: 'Withdraw SOL' });
    
    const message = `
💎 **WITHDRAW SOL**

To withdraw SOL from your wallet, use this command:

\`/withdraw_sol <amount> <sol_address>\`

**Example:**
\`/withdraw_sol 0.01 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU\`

⚠️ **Important:**
• Only works in private chat
• Keep some SOL for transaction fees
• Minimum withdrawal: 0.001 SOL
• Transaction fee: ~0.000005 SOL
`;

    await bot.sendMessage(telegramId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error in handlePrivateWithdrawSol:', error);
  }
}

// Handle private export wallet
async function handlePrivateExportWallet(telegramId: number, callbackQueryId: string) {
  try {
    await bot.answerCallbackQuery(callbackQueryId, { text: 'Export wallet' });
    
    const message = `
🔐 **EXPORT WALLET**

To export your wallet, use this command:

\`/export_wallet\`

⚠️ **Important:**
• Only works in private chat
• Your wallet will be exported with all tokens
`;

    await bot.sendMessage(telegramId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error in handlePrivateExportWallet:', error);
  }
}