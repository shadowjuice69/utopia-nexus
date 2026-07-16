require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");
const loadEvents = require("./eventLoader");
const logger = require("./services/logger");
const validator = require("./services/validator");
const errorHandler = require("./services/errorHandler");
const database = require("./services/database");

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

client.login(process.env.DISCORD_TOKEN);

// Start intel HTTP receiver
require("./services/intelReceiver").start();
