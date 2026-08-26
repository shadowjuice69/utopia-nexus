/**
 * Music service boundary for the known-working direct Discord Voice backend.
 * Lavalink/Riffy are no longer part of the active music path.
 */

function isConfigured(env = process.env) {
  return Boolean(env.DISCORD_TOKEN);
}

function isEnabled(env = process.env) {
  return isConfigured(env);
}

function status(env = process.env) {
  return {
    enabled: isEnabled(env),
    provider: 'youtube-dlp',
    adapter: 'direct-discord-voice',
    configured: isConfigured(env),
  };
}

function unavailable() {
  const error = new Error('Music service is not configured.');
  error.code = 'MUSIC_UNAVAILABLE';
  return error;
}

module.exports = { isConfigured, isEnabled, status, unavailable };
