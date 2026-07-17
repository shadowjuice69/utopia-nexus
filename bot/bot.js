require("dotenv").config();

// Fix for Node 18 Supabase Realtime WebSocket crash
if (!globalThis.WebSocket) {
  globalThis.WebSocket = class {};
}

const { Client, GatewayIntentBits } = require("discord.js");
const loadEvents = require("./eventLoader");
const logger = require("./services/logger");
const validator = require("./services/validator");
const errorHandler = require("./services/errorHandler");
const database = require("./services/database");
const { startAlertLoop } = require("./services/alertService");
const { startAgeWatch } = require("./services/ageWatchService");
const intelReceiver = require("./services/intelReceiver");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

errorHandler.attach(client);
loadEvents(client);
logger.info("🚀 Utopia Nexus Bot Starting...");
validator.checkEnv();
database.connect();

client.once("clientReady", () => {
  logger.info(`✅ Bot online as ${client.user.tag}`);
  startAlertLoop(client);
  startAgeWatch(client);
});

intelReceiver.start();
client.login(process.env.DISCORD_TOKEN)
  .catch(err => {
    logger.error(`[LOGIN ERROR] ${err.message}`);
  });
