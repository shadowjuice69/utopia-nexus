require('dotenv').config();
const { WebSocket: NodeWebSocket } = require('ws');
globalThis.WebSocket = NodeWebSocket;

const { Client, GatewayIntentBits } = require('discord.js');
const logger = require('./services/logger');
const directMusicAdapter = require('./services/directMusicAdapter');
const musicPlayer = require('./services/musicPlayerService');
const music7 = require('./core/intel7');
const interactions = require('./core/interactions');
const commands = require('./core/commands');

if (!process.env.DISCORD_TOKEN) throw new Error('DISCORD_TOKEN is required');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
});

global.__NEXUS_DISCORD_CLIENT = client;

const intel7 = music7.initialize(client);

client.on('interactionCreate', interaction => {
  interactions.handle(interaction).catch(error => {
    logger.error(`[INTERACTION ERROR] ${error.stack || error.message}`);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      interaction.reply({ content: `❌ ${error.message}`, ephemeral: true }).catch(() => {});
    }
  });
});

client.on('messageCreate', message => {
  const type = intel7.channels.get(message.channelId);
  if (!type) return;
});

client.on('debug', message => {
  if (!/heartbeat acknowledged|sending heartbeat/i.test(message)) logger.info(`[DISCORD DEBUG] ${message}`);
});
client.on('warn', message => logger.warn(`[DISCORD WARN] ${message}`));
client.on('error', error => logger.error(`[DISCORD CLIENT ERROR] ${error.stack || error.message}`));
client.on('shardError', (error, shardId) => logger.error(`[DISCORD SHARD ${shardId} ERROR] ${error.stack || error.message}`));
client.on('shardDisconnect', (event, shardId) => logger.warn(`[DISCORD SHARD ${shardId} DISCONNECT] code=${event?.code || 'unknown'} reason=${event?.reason || 'none'}`));
client.on('shardReconnecting', shardId => logger.warn(`[DISCORD SHARD ${shardId} RECONNECTING]`));
client.on('shardReady', shardId => logger.info(`[DISCORD SHARD ${shardId} READY]`));

client.once('clientReady', async () => {
  logger.info(`✅ Bot online as ${client.user.tag}`);

  try {
    directMusicAdapter.initialize(client);
    musicPlayer.setAdapter(directMusicAdapter);
    logger.info('🎵 Music backend ready: Direct Discord Voice / yt-dlp / FFmpeg');
  } catch (error) {
    musicPlayer.clearAdapter();
    logger.error(`[MUSIC INIT ERROR] ${error.stack || error.message}`);
  }

  try {
    await commands.register(client);
  } catch (error) {
    logger.error(`[COMMAND REGISTRATION ERROR] ${error.stack || error.message}`);
  }
});

logger.info('🚀 Nexus clean core starting');
logger.info(`[INTEL7] channel count=${intel7.channels.size} kd=${intel7.kd}`);
client.login(process.env.DISCORD_TOKEN)
  .then(() => logger.info('[DISCORD] Login accepted'))
  .catch(error => logger.error(`[LOGIN ERROR] ${error.stack || error.message}`));
