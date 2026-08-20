/**
 * Nexus music service boundary.
 *
 * Lavalink/Riffy integration is isolated behind this interface so the Discord
 * command layer does not depend directly on a player implementation.
 * Music remains disabled until MUSIC_ENABLED is explicitly true and a
 * complete Lavalink connection is configured.
 */

function isConfigured(env = process.env) {
  return Boolean(env.LAVALINK_HOST && env.LAVALINK_PASSWORD);
}

function isEnabled(env = process.env) {
  return env.MUSIC_ENABLED === "true" && isConfigured(env);
}

function status(env = process.env) {
  return {
    enabled: isEnabled(env),
    provider: "lavalink",
    adapter: "riffy",
    configured: isConfigured(env)
  };
}

function unavailable() {
  const error = new Error("Music service is not enabled or configured.");
  error.code = "MUSIC_UNAVAILABLE";
  return error;
}

module.exports = {
  isConfigured,
  isEnabled,
  status,
  unavailable
};
