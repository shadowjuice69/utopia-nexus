const assert = require("node:assert/strict");
const { describe, it, afterEach } = require("node:test");
const service = require("../services/musicPlayerService");

describe("musicPlayerService", () => {
  afterEach(() => service.clearAdapter());

  it("rejects playback when no backend adapter exists", async () => {
    await assert.rejects(
      service.createPlayer({ guildId: "g", voiceChannelId: "v" }),
      /backend is unavailable/
    );
  });

  it("creates, snapshots, and destroys a player", async () => {
    let destroyed = false;
    service.setAdapter({
      createPlayer: async () => ({
        connected: true,
        playing: true,
        paused: false,
        queue: [{ title: "track" }],
        destroy: async () => { destroyed = true; }
      })
    });

    await service.createPlayer({ guildId: "g", voiceChannelId: "v", textChannelId: "t" });
    assert.deepEqual(service.snapshot(), [{
      guildId: "g",
      connected: true,
      playing: true,
      paused: false,
      queueSize: 1
    }]);

    await service.destroyPlayer("g");
    assert.equal(destroyed, true);
    assert.deepEqual(service.snapshot(), []);
  });
});
