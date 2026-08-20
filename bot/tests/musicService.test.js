const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const music = require("../services/musicService");

describe("musicService", () => {
  it("stays disabled without explicit enablement", () => {
    assert.equal(music.isEnabled({ LAVALINK_HOST: "localhost", LAVALINK_PASSWORD: "secret" }), false);
  });

  it("stays disabled when Lavalink credentials are incomplete", () => {
    assert.equal(music.isEnabled({ MUSIC_ENABLED: "true", LAVALINK_HOST: "localhost" }), false);
    assert.equal(music.status({ MUSIC_ENABLED: "true", LAVALINK_PASSWORD: "secret" }).configured, false);
  });

  it("enables only when explicitly enabled and fully configured", () => {
    assert.equal(
      music.isEnabled({ MUSIC_ENABLED: "true", LAVALINK_HOST: "localhost", LAVALINK_PASSWORD: "secret" }),
      true
    );
  });

  it("reports backend configuration without exposing credentials", () => {
    const result = music.status({
      MUSIC_ENABLED: "true",
      LAVALINK_HOST: "localhost",
      LAVALINK_PASSWORD: "secret"
    });
    assert.deepEqual(result, {
      enabled: true,
      provider: "lavalink",
      adapter: "riffy",
      configured: true
    });
    assert.equal(JSON.stringify(result).includes("secret"), false);
  });

  it("returns a stable unavailable error", () => {
    const error = music.unavailable();
    assert.equal(error.code, "MUSIC_UNAVAILABLE");
  });
});
