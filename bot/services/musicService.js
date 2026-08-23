/**
 * Discord Player music service.
 * No Lavalink, Riffy, or external music node is required.
 */

function isConfigured() {
  return true;
}

function isEnabled() {
  return true;
}

function status() {
  return {
    enabled: true,
    provider: "discord-player",
    adapter: "youtube-dlp + spotify bridge",
    configured: true
  };
}

function unavailable() {
  const error = new Error("Music service is unavailable.");
  error.code = "MUSIC_UNAVAILABLE";
  return error;
}

module.exports = { isConfigured, isEnabled, status, unavailable };
