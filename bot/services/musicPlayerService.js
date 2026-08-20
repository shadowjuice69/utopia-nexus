const musicService = require("./musicService");

/**
 * Playback orchestration boundary.
 *
 * This module deliberately contains no Discord interaction handling. Commands
 * call this service, which keeps queue/player lifecycle concerns isolated.
 * The Lavalink adapter is injected so unit tests never require a live node.
 */

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
  const player = await requireAdapter().createPlayer({ guildId, voiceChannelId, textChannelId });
  players.set(guildId, player);
  return player;
}

async function destroyPlayer(guildId) {
  const player = players.get(guildId);
  players.delete(guildId);
  if (player && typeof player.destroy === "function") await player.destroy();
}

function snapshot() {
  return [...players.entries()].map(([guildId, player]) => ({
    guildId,
    connected: player?.connected === true,
    playing: player?.playing === true,
    paused: player?.paused === true,
    queueSize: Array.isArray(player?.queue) ? player.queue.length : 0
  }));
}

function backendStatus() {
  return musicService.status();
}

module.exports = {
  setAdapter,
  clearAdapter,
  getPlayer,
  createPlayer,
  destroyPlayer,
  snapshot,
  backendStatus
};
