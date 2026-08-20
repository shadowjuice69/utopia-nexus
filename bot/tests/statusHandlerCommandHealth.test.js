const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

describe("statusHandler service health integration", () => {
  it("renders command and music health", () => {
    const file = fs.readFileSync(
      path.join(__dirname, "../handlers/commands/statusHandler.js"),
      "utf8"
    );

    assert.match(file, /commandHealthService/);
    assert.match(file, /commandHealth\.snapshot\(\)/);
    assert.match(file, /\*\*Commands:\*\*/);
    assert.match(file, /healthy/);
    assert.match(file, /degraded/);
    assert.match(file, /musicService/);
    assert.match(file, /\*\*Music:\*\*/);
  });
});
