/**
 * Nexus music service boundary.
 *
 * Lavalink/Riffy integration is isolated behind this interface so the Discord
 * command layer does not depend directly on a player implementation.
 * Music remains disabled until MUSIC_ENABLED is explicitly true and a
 * Lavalink host is configured.
 */

function isEnabled(env = process.env) {
  return env.MUSIC_ENABLED === "true" && Boolean(env.LAVALINK_HOST);
}

function status(env = process.env) {
  return {
    enabled: isEnabled(env),
    provider: "lavalink",
    adapter: "riffy",
    configured: Boolean(env.LAVALINK_HOST)
  };
}

function unavailable() {
  const error = new Error("Music service is not enabled or configured.");
  error.code = "MUSIC_UNAVAILABLE";
  return error;
}

module.exports = {
  isEnabled,
  status,
  unavailable
};
