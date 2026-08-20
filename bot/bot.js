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
const readiness = require("./services/readinessService");
const { runAlertJob, msUntilNextTick, TICK_INTERVAL_MS } = require("./services/alertService");
const { detectAndResetAge, AGE_WATCH_INTERVAL_MS } = require("./services/ageWatchService");
const scheduler = require("./services/schedulerService");
const intelReceiver = require("./services/intelReceiver");
const nexusEvents = require("./services/nexusEventBus");

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

readiness.markNotReady("configuration", { required: true });
readiness.markNotReady("database", { required: true });
readiness.markNotReady("discord", { required: true });

try {
  validator.checkEnv();
  readiness.markReady("configuration", { required: true });
} catch (err) {
  readiness.markNotReady("configuration", { required: true, error: err.message });
  throw err;
}

database.connect()
  .then(() => readiness.markReady("database", { required: true }))
  .catch(err => {
    readiness.markNotReady("database", { required: true, error: err.message });
    logger.error(`[DATABASE INIT ERROR] ${err.message}`);
  });

client.once("clientReady", () => {
  readiness.markReady("discord", { required: true, user: client.user.tag });
  logger.info(`✅ Bot online as ${client.user.tag}`);
  nexusEvents.emit("nexus.ready", { botUser: client.user.tag });

  scheduler.register(
    "tick-alerts",
    () => runAlertJob(client),
    TICK_INTERVAL_MS,
    { initialDelayMs: msUntilNextTick() + 2000 }
  );

  scheduler.register(
    "age-watch",
    () => detectAndResetAge(client),
    AGE_WATCH_INTERVAL_MS,
    { initialDelayMs: AGE_WATCH_INTERVAL_MS }
  );

  scheduler.start();
});

nexusEvents.emit("nexus.starting", { service: "utopia-nexus" });
intelReceiver.start();
client.login(process.env.DISCORD_TOKEN)
  .then(() => nexusEvents.emit("nexus.login", { service: "discord" }))
  .catch(err => {
    readiness.markNotReady("discord", { required: true, error: err.message });
    logger.error(`[LOGIN ERROR] ${err.message}`);
    nexusEvents.emit("nexus.login_error", { service: "discord", error: err.message });
  });

// Keep Render free tier alive
const https = require("https");
setInterval(() => {
  https.get("https://utopia-nexus.onrender.com", (res) => {
    console.log("[KEEP-ALIVE] Pinged self, status:", res.statusCode);
  }).on("error", (e) => {
    console.error("[KEEP-ALIVE] Error:", e.message);
  });
}, 10 * 60 * 1000); // every 10 minutes
