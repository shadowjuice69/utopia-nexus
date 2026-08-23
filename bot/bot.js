require("dotenv").config();

if (!globalThis.WebSocket) globalThis.WebSocket = class {};

const { Client, GatewayIntentBits, REST, Routes } = require("discord.js");
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
const musicService = require("./services/musicService");
const musicPlayer = require("./services/musicPlayerService");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
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

async function registerMusicCommand() {
  const musicCommand = {
    name: "music",
    description: "Nexus music player",
    options: [
      { name: "join", description: "Join your voice channel", type: 1 },
      { name: "play", description: "Play or queue a track or playlist", type: 1,
        options: [{ name: "query", description: "Song, YouTube URL, or Spotify URL", type: 3, required: true }] },
      { name: "pause", description: "Pause playback", type: 1 },
      { name: "resume", description: "Resume playback", type: 1 },
      { name: "skip", description: "Skip the current track", type: 1 },
      { name: "stop", description: "Stop playback and leave voice", type: 1 },
      { name: "queue", description: "Show the current queue", type: 1 },
      { name: "nowplaying", description: "Show the current track", type: 1 },
      { name: "volume", description: "Set playback volume", type: 1,
        options: [{ name: "level", description: "Volume from 0 to 100", type: 4, required: true, min_value: 0, max_value: 100 }] },
      { name: "shuffle", description: "Shuffle the queue", type: 1 },
      { name: "clear", description: "Clear queued tracks", type: 1 },
      { name: "loop", description: "Enable or disable current-track looping", type: 1,
        options: [{ name: "enabled", description: "Enable track loop", type: 5, required: true }] },
      { name: "seek", description: "Seek within the current track", type: 1,
        options: [{ name: "seconds", description: "Position in seconds", type: 4, required: true, min_value: 0 }] }
    ]
  };

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
  const guildIds = [process.env.GUILD_ID, "1534817549374455848"].filter(Boolean);

  for (const guildId of guildIds) {
    const route = Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId);
    const existing = await rest.get(route);
    const commands = existing.filter(command => command.name !== "music");
    commands.push(musicCommand);
    await rest.put(route, { body: commands });
    logger.info(`🎵 Music command registered for guild ${guildId}`);
  }
}

client.once("clientReady", async () => {
  readiness.markReady("discord", { required: true, user: client.user.tag });
  logger.info(`✅ Bot online as ${client.user.tag}`);
  nexusEvents.emit("nexus.ready", { botUser: client.user.tag });

  try {
    await musicPlayer.initialize(client);
    logger.info("🎵 Music backend ready: Discord Player");
  } catch (err) {
    logger.error(`[MUSIC INIT ERROR] ${err.stack || err.message}`);
  }

  registerMusicCommand().catch(err => {
    logger.error(`[MUSIC COMMAND REGISTRATION ERROR] ${err.message}`);
  });

  scheduler.register("tick-alerts", () => runAlertJob(client), TICK_INTERVAL_MS, {
    initialDelayMs: msUntilNextTick() + 2000
  });
  scheduler.register("age-watch", () => detectAndResetAge(client), AGE_WATCH_INTERVAL_MS, {
    initialDelayMs: AGE_WATCH_INTERVAL_MS
  });
  scheduler.start();
});

nexusEvents.emit("nexus.starting", { service: "utopia-nexus" });
logger.info("[DISCORD] Starting Discord login...");
client.login(process.env.DISCORD_TOKEN)
  .then(() => logger.info("[DISCORD] Login request accepted; waiting for clientReady..."))
  .catch(err => {
    readiness.markNotReady("discord", { required: true, error: err.message });
    logger.error(`[LOGIN ERROR] ${err.stack || err.message}`);
    nexusEvents.emit("nexus.login_error", { service: "discord", error: err.message });
  });

intelReceiver.start();

const https = require("https");
setInterval(() => {
  https.get("https://utopia-nexus.onrender.com", res => {
    console.log("[KEEP-ALIVE] Pinged self, status:", res.statusCode);
  }).on("error", e => console.error("[KEEP-ALIVE] Error:", e.message));
}, 10 * 60 * 1000);
