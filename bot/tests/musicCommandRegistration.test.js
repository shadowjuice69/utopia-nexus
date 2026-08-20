const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const commandHandler = require("../handlers/commandHandler");

describe("music command registration", () => {
  it("registers the complete music command surface", () => {
    const registry = commandHandler.commandRegistry;
    const expected = [
      "join", "play", "pause", "resume", "skip", "stop", "queue",
      "nowplaying", "volume", "shuffle", "clear", "loop", "seek"
    ];

    for (const subcommand of expected) {
      const entry = registry.get("music", subcommand);
      assert.ok(entry, `missing /music ${subcommand}`);
      assert.equal(entry.access, "registered");
    }
  });
});
