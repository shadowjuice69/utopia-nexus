const { Player } = require("discord-player");
const { SpotifyExtractor } = require("@discord-player/extractor");
const { YouTubeDlpExtractor, setFFmpegPath } = require("discord-player-youtubedlp");
const musicService = require("./musicService");

let player = null;
let initialized = false;
let initializationPromise = null;

async function initialize(client) {
  if (initialized) return player;
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    // Use the system FFmpeg binary. This works on Render/Linux and Termux/Android
    // without requiring the incompatible ffmpeg-static npm binary.
    const ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg";
    setFFmpegPath(ffmpegPath);
    console.log(`[MUSIC] Using FFmpeg: ${ffmpegPath}`);

    player = new Player(client);

    await player.extractors.register(YouTubeDlpExtractor, {
      searchLimit: 3,
      playlistSearchLimit: 200,
      relatedLimit: 5,
      searchTimeoutMs: 6000,
      videoTimeoutMs: 7000,
      playlistTimeoutMs: 25000,
      ytdlpTimeoutMs: 25000,
      infoCacheTtlMs: 120000,
      debug: true
    });

    await player.extractors.register(SpotifyExtractor, {});

    player.on("debug", message => console.log(`[MUSIC DEBUG] ${message}`));
    player.events.on("debug", (queue, message) => console.log(`[MUSIC DEBUG ${queue.guild.id}] ${message}`));
    player.events.on("playerStart", (queue, track) => console.log(`[MUSIC] Playing: ${track.title}`));
    player.events.on("playerError", (queue, error, track) => console.error(`[MUSIC ERROR] ${track?.title || "track"}: ${error.message}`));
    player.events.on("error", (queue, error) => console.error(`[MUSIC QUEUE ERROR] ${error.message}`));
    player.events.on("disconnect", queue => console.log(`[MUSIC] Disconnected from ${queue.guild.id}`));

    initialized = true;
    console.log("🎵 Music backend initialized (Discord Player / YouTube-DLP / Spotify)");
    return player;
  })();

  try {
    return await initializationPromise;
  } catch (error) {
    initializationPromise = null;
    player = null;
    throw error;
  }
}

async function requirePlayer() {
  if (!initialized || !player) throw new Error("Music backend is still initializing.");
  return player;
}

async function getOrCreatePlayer({ guildId, voiceChannelId, textChannelId }) {
  const instance = await requirePlayer();
  const guild = await instance.client.guilds.fetch(guildId);
  const voice = guild.channels.cache.get(voiceChannelId) || await guild.channels.fetch(voiceChannelId);
  if (!voice) throw new Error("Voice channel could not be found.");

  let queue = instance.nodes.get(guildId);
  if (!queue) {
    queue = instance.nodes.create(guildId, {
      metadata: {
        channelId: textChannelId,
        send: message => guild.channels.cache.get(textChannelId)?.send(message)
      },
      leaveOnEnd: false,
      leaveOnStop: true,
      leaveOnEmpty: true,
      leaveOnEmptyCooldown: 300000,
      bufferingTimeout: 15000
    });
  }

  await queue.connect(voice, { deaf: true });
  return queue;
}

function getPlayer(guildId) {
  return player?.nodes.get(guildId) || null;
}

function requireQueue(guildId) {
  const queue = getPlayer(guildId);
  if (!queue) throw new Error("No active music player in this server.");
  return queue;
}

async function play(guildId, query, requester, voiceChannelId, textChannelId) {
  const instance = await requirePlayer();
  const guild = await instance.client.guilds.fetch(guildId);
  const voice = guild.channels.cache.get(voiceChannelId) || await guild.channels.fetch(voiceChannelId);
  if (!voice) throw new Error("Voice channel could not be found.");

  const result = await instance.play(voice, query, {
    requestedBy: requester,
    nodeOptions: {
      metadata: {
        channelId: textChannelId,
        send: message => guild.channels.cache.get(textChannelId)?.send(message)
      },
      leaveOnEnd: false,
      leaveOnStop: true,
      leaveOnEmpty: true,
      leaveOnEmptyCooldown: 300000,
      bufferingTimeout: 15000,
      skipOnNoStream: true
    }
  });

  return result;
}

async function destroyPlayer(guildId) {
  const queue = getPlayer(guildId);
  if (queue) queue.delete();
}

async function pause(guildId) { requireQueue(guildId).node.pause(); }
async function resume(guildId) { requireQueue(guildId).node.resume(); }
async function skip(guildId) { requireQueue(guildId).node.skip(); }
async function stop(guildId) { requireQueue(guildId).node.stop(true); }
async function volume(guildId, value) { requireQueue(guildId).node.setVolume(value); }
async function seek(guildId, positionMs) { await requireQueue(guildId).node.seek(positionMs); }
async function loop(guildId, enabled) { requireQueue(guildId).setRepeatMode(enabled ? 1 : 0); }
function shuffle(guildId) { requireQueue(guildId).tracks.shuffle(); }
function clearQueue(guildId) { requireQueue(guildId).clear(); }

function snapshot() {
  if (!player) return [];
  return player.nodes.cache.map(queue => ({
    guildId: queue.guild.id,
    connected: Boolean(queue.connection),
    playing: queue.node.isPlaying(),
    paused: queue.node.isPaused(),
    queueSize: queue.tracks.size
  }));
}

function backendStatus() { return musicService.status(); }
function clearAll() { player?.nodes.cache.forEach(queue => queue.delete()); }

module.exports = {
  initialize,
  getPlayer,
  getOrCreatePlayer,
  play,
  pause,
  resume,
  skip,
  stop,
  volume,
  seek,
  loop,
  shuffle,
  clearQueue,
  destroyPlayer,
  requireQueue,
  snapshot,
  backendStatus,
  clearAll
};
