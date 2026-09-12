require('dotenv').config();
const http = require('http');
const { WebSocket: NodeWebSocket } = require('ws');
globalThis.WebSocket = NodeWebSocket;
const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');
const logger = require('./services/logger');
const directMusicAdapter = require('./services/directMusicAdapter');
const musicPlayer = require('./services/musicPlayerService');
const music7 = require('./core/intel7');
const interactions = require('./core/interactions');
const commands = require('./core/commands');
const spartanQueueProcessor = require('./services/spartanQueueProcessor');
const spartanBotBridge = require('./services/spartanBotBridge');
const spartanAI = require('./services/spartanAI');

if (!process.env.DISCORD_TOKEN) throw new Error('DISCORD_TOKEN is required');
const CLEANUP_CHANNEL_ID = '1546379989484830730';
const CLEANUP_AUTHOR_ID = '1518122625354956820';
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.MessageContent] });
global.__NEXUS_DISCORD_CLIENT = client;
const intel7 = music7.initialize(client);

client.on('raw', packet => { if (packet?.t === 'MESSAGE_CREATE') logger.info(`[DISCORD RAW MESSAGE_CREATE] channel=${packet.d?.channel_id || 'unknown'} guild=${packet.d?.guild_id || 'DM'} author=${packet.d?.author?.username || 'unknown'} id=${packet.d?.id || 'unknown'}`); });

client.on('interactionCreate', interaction => {
  spartanBotBridge.inboundInteraction(interaction).catch(() => {});
  interactions.handle(interaction).catch(error => {
    logger.error(`[INTERACTION ERROR] ${error.stack || error.message}`);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) interaction.reply({ content: `❌ ${error.message}`, ephemeral: true }).catch(() => {});
  });
});

client.on('messageCreate', async message => {
  spartanBotBridge.inboundMessage(message).catch(() => {});
  try {
    if (message.author?.bot && message.author.id === CLEANUP_AUTHOR_ID) return;
    if (!message.content?.trim().toLowerCase().startsWith('!clearbot')) return;
    if (!message.guild) return;
    if (!message.member?.permissions?.has(PermissionFlagsBits.Administrator)) return;
    const parts = message.content.trim().split(/\s+/);
    const channelId = parts[1] || CLEANUP_CHANNEL_ID;
    const authorId = parts[2] || CLEANUP_AUTHOR_ID;
    if (!/^\d{17,20}$/.test(channelId) || !/^\d{17,20}$/.test(authorId)) return message.reply('❌ Usage: `!clearbot [channel_id] [user_id]`');
    const channel = await client.channels.fetch(channelId);
    if (!channel?.isTextBased() || !channel.messages) return message.reply('❌ That channel is not a text channel I can read.');
    let before; let deleted = 0; let scanned = 0;
    while (true) {
      const batch = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
      if (!batch.size) break;
      scanned += batch.size;
      const targets = batch.filter(m => m.author?.id === authorId);
      if (targets.size) {
        const removable = targets.filter(m => Date.now() - m.createdTimestamp < 14 * 24 * 60 * 60 * 1000);
        const old = targets.filter(m => Date.now() - m.createdTimestamp >= 14 * 24 * 60 * 60 * 1000);
        if (removable.size) deleted += (await channel.bulkDelete(removable, true)).size;
        for (const msg of old.values()) { try { await msg.delete(); deleted++; } catch (error) { logger.warn(`[CLEARBOT] Could not delete old message ${msg.id}: ${error.message}`); } }
      }
      before = batch.last().id;
      if (batch.size < 100) break;
    }
    await message.reply(`✅ Cleared ${deleted} message(s) from <#${channelId}> posted by <@${authorId}>. Scanned ${scanned} message(s).`);
    logger.info(`[CLEARBOT] deleted=${deleted} scanned=${scanned} channel=${channelId} author=${authorId} requestedBy=${message.author.id}`);
  } catch (error) {
    logger.error(`[CLEARBOT ERROR] ${error.stack || error.message}`);
    if (!message.replied) message.reply(`❌ Cleanup failed: ${error.message}`).catch(() => {});
  }
  const type = intel7.channels.get(message.channelId); if (!type) return;
});

client.on('debug', message => { if (!/heartbeat acknowledged|sending heartbeat/i.test(message)) logger.info(`[DISCORD DEBUG] ${message}`); });
client.on('warn', message => logger.warn(`[DISCORD WARN] ${message}`));
client.on('error', error => logger.error(`[DISCORD CLIENT ERROR] ${error.stack || error.message}`));
client.on('shardError', (error, shardId) => logger.error(`[DISCORD SHARD ${shardId} ERROR] ${error.stack || error.message}`));
client.on('shardDisconnect', (event, shardId) => logger.warn(`[DISCORD SHARD ${shardId} DISCONNECT] code=${event?.code || 'unknown'} reason=${event?.reason || 'none'}`));
client.on('shardReconnecting', shardId => logger.warn(`[DISCORD SHARD ${shardId} RECONNECTING]`));
client.on('shardReady', shardId => logger.info(`[DISCORD SHARD ${shardId} READY]`));

client.once('clientReady', async () => {
  logger.info(`✅ Bot online as ${client.user.tag}`);
  logger.info('[SPARTAN] Bot is an ecosystem node: Discord <-> Spartan capture/queue/stewards/projection');
  spartanAI.start();
  spartanQueueProcessor.start();
  try { directMusicAdapter.initialize(client); musicPlayer.setAdapter(directMusicAdapter); logger.info('🎵 Music backend ready: Direct Discord Voice / yt-dlp / FFmpeg'); }
  catch (error) { musicPlayer.clearAdapter(); logger.error(`[MUSIC INIT ERROR] ${error.stack || error.message}`); }
  try { await commands.register(client); } catch (error) { logger.error(`[COMMAND REGISTRATION ERROR] ${error.stack || error.message}`); }
});

const port = Number(process.env.PORT || 10000);
const universalReceiver = require('./services/universalReceiver');
universalReceiver.start();
logger.info('🚀 Nexus clean core starting');
logger.info(`[INTEL7] channel count=${intel7.channels.size} kd=${intel7.kd}`);
client.login(process.env.DISCORD_TOKEN).then(() => logger.info('[DISCORD] Login accepted')).catch(error => logger.error(`[LOGIN ERROR] ${error.stack || error.message}`));
const SELF_URL = process.env.RENDER_EXTERNAL_URL || 'https://utopia-nexus.onrender.com';
setInterval(() => { require('https').get(SELF_URL, res => logger.info(`[SELF-PING] ${res.statusCode}`)).on('error', err => logger.warn(`[SELF-PING ERROR] ${err.message}`)); }, 10 * 60 * 1000);
