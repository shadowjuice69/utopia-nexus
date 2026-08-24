const musicService = require("./musicService");

let adapter = null;
const players = new Map();

function setAdapter(nextAdapter) { adapter = nextAdapter || null; }
function clearAdapter() { adapter = null; }
function getPlayer(guildId) { return players.get(guildId) || null; }

function requireAdapter() {
  if (!adapter || typeof adapter.createPlayer !== "function") throw new Error("Music backend is unavailable.");
  return adapter;
}

async function createPlayer({ guildId, voiceChannelId, textChannelId }) {
  if (!guildId || !voiceChannelId) throw new Error("Guild and voice channel are required.");
  const existing = getPlayer(guildId);
  if (existing) {
    if (existing.connected === true) return existing;
    players.delete(guildId);
    try { if (typeof existing.destroy === "function") await existing.destroy(); } catch (error) {
      console.warn(`[MUSIC] Discarding stale player for guild ${guildId}: ${error.message}`);
    }
  }
  const player = await requireAdapter().createPlayer({ guildId, voiceChannelId, textChannelId });
  if (!player) throw new Error("Music player could not be created.");
  players.set(guildId, player);
  return player;
}

async function getOrCreatePlayer(options) {
  const existing = getPlayer(options.guildId);
  if (existing?.connected === true) return existing;
  return createPlayer(options);
}

async function destroyPlayer(guildId) {
  const player = players.get(guildId);
  players.delete(guildId);
  if (player?.destroy) await player.destroy();
}

function requirePlayer(guildId) {
  const player = getPlayer(guildId);
  if (!player) throw new Error("No active music player in this server.");
  return player;
}

async function play(guildId, query, requester) { return requirePlayer(guildId).addQuery(query, requester); }
async function pause(guildId) { return requirePlayer(guildId).pause(); }
async function resume(guildId) { return requirePlayer(guildId).resume(); }
async function skip(guildId) { return requirePlayer(guildId).skip(); }
async function stop(guildId) { return requirePlayer(guildId).stop(); }
async function volume(guildId, value) { return requirePlayer(guildId).setVolume(value); }
async function seek(guildId, positionMs) { return requirePlayer(guildId).seek(positionMs); }
async function loop(guildId, enabled) { return requirePlayer(guildId).setLoop(enabled); }
function shuffle(guildId) { return requirePlayer(guildId).shuffle(); }
function clearQueue(guildId) { return requirePlayer(guildId).clearQueue(); }

function snapshot() {
  return [...players.entries()].map(([guildId, player]) => ({
    guildId,
    connected: player?.connected === true,
    playing: player?.playing === true,
    paused: player?.paused === true,
    queueSize: Number(player?.queueSize || 0)
  }));
}

function backendStatus() { return musicService.status(); }
function clearAll() { players.clear(); }

module.exports = { setAdapter, clearAdapter, getPlayer, createPlayer, getOrCreatePlayer, destroyPlayer, requirePlayer, play, pause, resume, skip, stop, volume, seek, loop, shuffle, clearQueue, snapshot, backendStatus, clearAll };
