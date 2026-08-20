const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

describe("statusHandler command health integration", () => {
  it("loads the command health service and renders command health", () => {
    const file = fs.readFileSync(
      path.join(__dirname, "../handlers/commands/statusHandler.js"),
      "utf8"
    );

    assert.match(file, /commandHealthService/);
    assert.match(file, /commandHealth\.snapshot\(\)/);
    assert.match(file, /\*\*Commands:\*\*/);
    assert.match(file, /healthy/);
    assert.match(file, /degraded/);
  });
});
