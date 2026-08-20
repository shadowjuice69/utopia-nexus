const assert = require("node:assert/strict");
const registry = require("../services/commandRegistry");
const health = require("../services/commandHealthService");

describe("commandHealthService", () => {
  beforeEach(() => registry.clear());
  afterEach(() => registry.clear());

  it("reports command count and access distribution", () => {
    registry.register("status", "show", () => {}, { access: "public", description: "Show status" });
    registry.register("ops", "assign", () => {}, { access: "registered", description: "Assign an operation" });
    registry.register("admin", "reload", () => {}, { access: "admin" });

    const result = health.snapshot();

    assert.equal(result.healthy, true);
    assert.equal(result.count, 3);
    assert.deepEqual(result.byAccess, { public: 1, registered: 1, admin: 1 });
    assert.deepEqual(result.commands[0], {
      command: "status",
      subcommand: "show",
      access: "public",
      description: "Show status"
    });
  });

  it("does not expose command handlers in diagnostics", () => {
    registry.register("status", "show", () => "secret");

    const result = health.snapshot();

    assert.equal(result.commands[0].handler, undefined);
  });
});
