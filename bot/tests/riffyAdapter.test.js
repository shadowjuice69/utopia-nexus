const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const { getConfig } = require("../services/riffyAdapter");

describe("riffyAdapter", () => {
  it("does not expose credentials in configuration metadata", () => {
    const config = getConfig({
      LAVALINK_HOST: "localhost",
      LAVALINK_PASSWORD: "secret",
      LAVALINK_PORT: "2333",
      LAVALINK_SECURE: "true"
    });

    assert.equal(config.configured, true);
    assert.equal(config.host, "localhost");
    assert.equal(config.port, 2333);
    assert.equal(config.secure, true);
    assert.equal(config.password, "secret");
  });

  it("requires both host and password", () => {
    assert.equal(getConfig({ LAVALINK_HOST: "localhost" }).configured, false);
    assert.equal(getConfig({ LAVALINK_PASSWORD: "secret" }).configured, false);
  });
});
