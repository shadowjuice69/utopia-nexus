const { GatewayDispatchEvents } = require("discord.js");
const { createRiffy, getConfig } = require("./riffyAdapter");

let riffy = null;

function ensureClient(client) {
  if (riffy) return riffy;
  if (!client) throw new Error("Discord client is required for music.");
  if (!getConfig().configured) throw new Error("Lavalink is not configured.");

  riffy = createRiffy(client);
  return riffy;
}

function currentTrack(raw) {
  return raw.current || raw.currentTrack || null;
}

function queueSize(raw) {
  if (!raw?.queue) return 0;
  if (typeof raw.queue.size === "number") return raw.queue.size;
  if (typeof raw.queue.length === "number") return raw.queue.length;
  return 0;
}

function queueItems(raw) {
  if (!raw?.queue) return [];
  return Array.from(raw.queue);
}

function wrap(raw) {
  return {
    raw,
    get connected() { return raw.connected !== false; },
    get playing() { return raw.playing === true; },
    get paused() { return raw.paused === true; },
    get currentTrack() { return currentTrack(raw); },
    get queueSize() { return queueSize(raw); },
    get queue() { return queueItems(raw); },

    async addQuery(query, requester) {
      const result = await riffy.resolve({ query, requester });
      const tracks = result?.tracks || [];
      const loadType = String(result?.loadType || "").toLowerCase();

      if (!tracks.length || ["empty", "error", "load_failed", "no_matches"].includes(loadType)) {
        throw new Error("No playable tracks were found.");
      }

      for (const track of tracks) {
        if (track?.info) track.info.requester = requester;
        raw.queue.add(track);
      }

      if (!raw.playing && !raw.paused) await raw.play();
      return {
        loadType,
        tracks,
        playlistName: result?.playlistInfo?.name || null
      };
    },

    async pause() {
      if (typeof raw.pause === "function") return raw.pause(true);
      throw new Error("Pause is not supported by the music backend.");
    },

    async resume() {
      if (typeof raw.pause === "function") return raw.pause(false);
      if (typeof raw.resume === "function") return raw.resume();
      throw new Error("Resume is not supported by the music backend.");
    },

    async skip() {
      if (typeof raw.skip === "function") return raw.skip();
      if (typeof raw.stop === "function") return raw.stop();
      throw new Error("Skip is not supported by the music backend.");
    },

    async stop() {
      if (typeof raw.stop === "function") return raw.stop();
      throw new Error("Stop is not supported by the music backend.");
    },

    async setVolume(value) {
      if (typeof raw.setVolume === "function") return raw.setVolume(value);
      throw new Error("Volume control is not supported by the music backend.");
    },

    async seek(positionMs) {
      if (typeof raw.seek === "function") return raw.seek(positionMs);
      throw new Error("Seek is not supported by the music backend.");
    },

    shuffle() {
      if (raw.queue && typeof raw.queue.shuffle === "function") return raw.queue.shuffle();
      throw new Error("Queue shuffle is not supported by the music backend.");
    },

    clearQueue() {
      if (raw.queue && typeof raw.queue.clear === "function") return raw.queue.clear();
      throw new Error("Queue clearing is not supported by the music backend.");
    },

    async destroy() {
      if (typeof raw.destroy === "function") await raw.destroy();
    }
  };
}

function initialize(client) {
  const instance = ensureClient(client);
  instance.on("nodeConnect", node => console.log(`[MUSIC] Lavalink node connected: ${node.name || "default"}`));
  instance.on("nodeError", (node, error) => console.error(`[MUSIC] Lavalink node error: ${error.message}`));
  return instance;
}

function initClient(client) {
  const instance = ensureClient(client);
  if (client.user?.id) instance.init(client.user.id);
  return instance;
}

function forwardVoiceState(payload) {
  if (!riffy) return;
  if (![GatewayDispatchEvents.VoiceStateUpdate, GatewayDispatchEvents.VoiceServerUpdate].includes(payload?.t)) return;
  riffy.updateVoiceState(payload);
}

async function createPlayer(options) {
  if (!riffy) throw new Error("Music backend has not been initialized.");
  const raw = riffy.createConnection({
    guildId: options.guildId,
    voiceChannel: options.voiceChannelId,
    textChannel: options.textChannelId,
    deaf: true
  });
  return wrap(raw);
}

function destroy() {
  riffy = null;
}

module.exports = {
  initialize,
  initClient,
  forwardVoiceState,
  createPlayer,
  destroy
};
