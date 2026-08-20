const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const loader = require("../services/commandLoader");
const registry = require("../services/commandRegistry");

function makeTempDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "nexus-command-loader-"));
}

test("normalizes function exports with command metadata", () => {
  const handler = () => {};
  handler.command = {
    command: "utopia",
    subcommand: "status",
    access: "admin",
    description: "Kingdom status"
  };

  const result = loader.normalizeExport(handler, "status.js");

  assert.equal(result.command, "utopia");
  assert.equal(result.subcommand, "status");
  assert.equal(result.handler, handler);
  assert.equal(result.options.access, "admin");
  assert.equal(result.options.description, "Kingdom status");
});

test("ignores modules without a valid handler or command metadata", () => {
  assert.equal(loader.normalizeExport({}, "empty.js"), null);
  assert.equal(loader.normalizeExport({ handler: () => {} }, "missing.js"), null);
});

test("discovers command modules in deterministic filename order", () => {
  const directory = makeTempDirectory();

  try {
    fs.writeFileSync(path.join(directory, "zeta.js"), `module.exports = { command: "test", subcommand: "zeta", handler: () => {} };`);
    fs.writeFileSync(path.join(directory, "alpha.js"), `module.exports = { command: "test", subcommand: "alpha", handler: () => {} };`);
    fs.writeFileSync(path.join(directory, "ignored.txt"), "not javascript");

    const result = loader.discover(directory);

    assert.deepEqual(
      result.map(entry => entry.subcommand),
      ["alpha", "zeta"]
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("loads discovered commands into the registry and preserves access", () => {
  const directory = makeTempDirectory();
  registry.clear();

  try {
    fs.writeFileSync(
      path.join(directory, "status.js"),
      `module.exports = { command: "test", subcommand: "status", access: "admin", description: "Status", handler: () => {} };`
    );

    assert.equal(loader.load(directory), 1);

    const entry = registry.get("test", "status");
    assert.ok(entry);
    assert.equal(entry.access, "admin");
    assert.equal(entry.requiresRegistration, true);
    assert.equal(entry.requiresAdmin, true);
    assert.equal(entry.description, "Status");
  } finally {
    registry.clear();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

registry.clear();
