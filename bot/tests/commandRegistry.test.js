const assert = require("node:assert/strict");
const test = require("node:test");

const registry = require("../services/commandRegistry");

test("registers and retrieves command metadata", () => {
  registry.clear();
  const handler = () => {};

  const entry = registry.register("test", "hello", handler, {
    requiresRegistration: false,
    requiresAdmin: true,
    description: "Test command"
  });

  assert.equal(entry.handler, handler);
  assert.equal(entry.requiresRegistration, false);
  assert.equal(entry.requiresAdmin, true);
  assert.equal(entry.description, "Test command");
  assert.equal(registry.get("test", "hello"), entry);
  assert.equal(registry.has("test", "hello"), true);
});

test("rejects duplicate command registrations", () => {
  registry.clear();
  registry.register("test", "hello", () => {});

  assert.throws(
    () => registry.register("test", "hello", () => {}),
    /Duplicate command registration/
  );
});

test("lists registered commands", () => {
  registry.clear();
  registry.register("test", "one", () => {});
  registry.register("test", "two", () => {});

  assert.equal(registry.list().length, 2);
});

registry.clear();
