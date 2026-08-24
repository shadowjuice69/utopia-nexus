const assert = require("node:assert/strict");
const { afterEach, beforeEach, describe, it } = require("node:test");
const service = require("../services/musicPlayerService");

describe("musicPlayerService", () => {
  beforeEach(() => {
    service.clearAll();
    service.clearAdapter();
  });

  afterEach(() => {
    service.clearAll();
    service.clearAdapter();
  });

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
        queueSize: 1,
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

  it("recreates a stale disconnected player instead of reusing it", async () => {
    const players = [];
    service.setAdapter({
      createPlayer: async () => {
        const player = {
          connected: true,
          playing: false,
          paused: false,
          queueSize: 0,
          queue: [],
          async destroy() { this.destroyed = true; }
        };
        players.push(player);
        return player;
      }
    });

    const first = await service.createPlayer({ guildId: "g", voiceChannelId: "v", textChannelId: "t" });
    first.connected = false;
    const second = await service.getOrCreatePlayer({ guildId: "g", voiceChannelId: "v", textChannelId: "t" });

    assert.notEqual(second, first);
    assert.equal(first.destroyed, true);
    assert.equal(players.length, 2);
    assert.equal(service.getPlayer("g"), second);
  });

  it("routes playback controls to the active player", async () => {
    const calls = [];
    const player = {
      connected: true,
      playing: true,
      paused: false,
      queueSize: 0,
      queue: [],
      async addQuery(query) { calls.push(["play", query]); },
      async pause() { calls.push(["pause"]); },
      async resume() { calls.push(["resume"]); },
      async skip() { calls.push(["skip"]); },
      async stop() { calls.push(["stop"]); },
      async setVolume(value) { calls.push(["volume", value]); },
      async seek(value) { calls.push(["seek", value]); },
      shuffle() { calls.push(["shuffle"]); },
      clearQueue() { calls.push(["clear"]); },
      async destroy() { calls.push(["destroy"]); }
    };

    service.setAdapter({ createPlayer: async () => player });
    await service.createPlayer({ guildId: "g", voiceChannelId: "v", textChannelId: "t" });

    await service.play("g", "test song", "user");
    await service.pause("g");
    await service.resume("g");
    await service.skip("g");
    await service.stop("g");
    await service.volume("g", 50);
    await service.seek("g", 10000);
    service.shuffle("g");
    service.clearQueue("g");

    assert.deepEqual(calls, [
      ["play", "test song"], ["pause"], ["resume"], ["skip"], ["stop"],
      ["volume", 50], ["seek", 10000], ["shuffle"], ["clear"]
    ]);
  });
});
