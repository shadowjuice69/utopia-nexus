const musicService = require("./musicService");

let adapter = null;
const players = new Map();

function setAdapter(nextAdapter) {
  adapter = nextAdapter || null;
}

function clearAdapter() {
  adapter = null;
}

function getPlayer(guildId) {
  return players.get(guildId) || null;
}

function requireAdapter() {
  if (!adapter || typeof adapter.createPlayer !== "function") {
    throw new Error("Music backend is unavailable.");
  }
  return adapter;
}

async function createPlayer({ guildId, voiceChannelId, textChannelId }) {
  if (!guildId || !voiceChannelId) throw new Error("Guild and voice channel are required.");
  const existing = getPlayer(guildId);
  if (existing) return existing;
  const player = await requireAdapter().createPlayer({ guildId, voiceChannelId, textChannelId });
  players.set(guildId, player);
  return player;
}

async function getOrCreatePlayer(options) {
  return getPlayer(options.guildId) || createPlayer(options);
}

async function destroyPlayer(guildId) {
  const player = players.get(guildId);
  players.delete(guildId);
  if (player && typeof player.destroy === "function") await player.destroy();
}

function requirePlayer(guildId) {
  const player = players.get(guildId);
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

module.exports = {
  setAdapter,
  clearAdapter,
  getPlayer,
  createPlayer,
  getOrCreatePlayer,
  destroyPlayer,
  requirePlayer,
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
  snapshot,
  backendStatus,
  clearAll
};
