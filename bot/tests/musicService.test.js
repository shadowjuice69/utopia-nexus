const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const music = require("../services/musicService");

describe("musicService", () => {
  it("stays disabled without a Discord token", () => {
    assert.equal(music.isEnabled({}), false);
  });

  it("stays disabled when Discord token is missing", () => {
    assert.equal(
      music.isEnabled({ MUSIC_ENABLED: "true" }),
      false
    );
  });

  it("enables when Discord token is configured", () => {
    assert.equal(
      music.isEnabled({ DISCORD_TOKEN: "test-token" }),
      true
    );
  });

  it("reports the direct Discord Voice backend", () => {
    const result = music.status({
      DISCORD_TOKEN: "secret-token"
    });

    assert.deepEqual(result, {
      enabled: true,
      provider: "youtube-dlp",
      adapter: "direct-discord-voice",
      configured: true
    });

    assert.equal(JSON.stringify(result).includes("secret-token"), false);
  });

  it("returns a stable unavailable error", () => {
    const error = music.unavailable();
    assert.equal(error.code, "MUSIC_UNAVAILABLE");
  });
});
