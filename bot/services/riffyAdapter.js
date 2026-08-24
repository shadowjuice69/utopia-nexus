const DEFAULT_SEARCH_PLATFORM = process.env.LAVALINK_SEARCH_PLATFORM || "ytsearch";

function getConfig(env = process.env) {
  const host = env.LAVALINK_HOST;
  const password = env.LAVALINK_PASSWORD;
  const port = Number(env.LAVALINK_PORT || 2333);
  const secure = String(env.LAVALINK_SECURE || "false").toLowerCase() === "true";
  return {
    configured: Boolean(host && password),
    host,
    password,
    port: Number.isInteger(port) ? port : 2333,
    secure,
    searchPlatform: env.LAVALINK_SEARCH_PLATFORM || DEFAULT_SEARCH_PLATFORM
  };
}

function createRiffy(client, env = process.env) {
  const config = getConfig(env);
  if (!config.configured) throw new Error("Lavalink is not configured.");
  const { Riffy } = require("riffy");
  return new Riffy(client, [{
    host: config.host,
    password: config.password,
    port: config.port,
    secure: config.secure
  }], {
    send: payload => {
      const guild = client.guilds.cache.get(payload.d.guild_id);
      if (guild) guild.shard.send(payload);
    },
    defaultSearchPlatform: config.searchPlatform,
    restVersion: "v4"
  });
}

module.exports = { getConfig, createRiffy };
