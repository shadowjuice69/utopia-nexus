const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const music = require("../services/musicService");

describe("musicService", () => {
  it("stays disabled without explicit enablement", () => {
    assert.equal(music.isEnabled({ LAVALINK_HOST: "localhost" }), false);
  });

  it("enables only when explicitly enabled and configured", () => {
    assert.equal(
      music.isEnabled({ MUSIC_ENABLED: "true", LAVALINK_HOST: "localhost" }),
      true
    );
  });

  it("reports backend configuration without exposing credentials", () => {
    const result = music.status({ MUSIC_ENABLED: "true", LAVALINK_HOST: "localhost" });
    assert.deepEqual(result, {
      enabled: true,
      provider: "lavalink",
      adapter: "riffy",
      configured: true
    });
  });

  it("returns a stable unavailable error", () => {
    const error = music.unavailable();
    assert.equal(error.code, "MUSIC_UNAVAILABLE");
  });
});
