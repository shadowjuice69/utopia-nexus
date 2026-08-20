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
  assert.equal(entry.access, "admin");
  assert.equal(entry.requiresRegistration, true);
  assert.equal(entry.requiresAdmin, true);
  assert.equal(entry.description, "Test command");
  assert.equal(registry.get("test", "hello"), entry);
  assert.equal(registry.has("test", "hello"), true);
});

test("supports explicit access levels", () => {
  registry.clear();

  const publicEntry = registry.register("test", "public", () => {}, {
    access: "public"
  });
  const ownerEntry = registry.register("test", "owner", () => {}, {
    access: "owner"
  });

  assert.equal(publicEntry.access, "public");
  assert.equal(publicEntry.requiresRegistration, false);
  assert.equal(ownerEntry.access, "owner");
  assert.equal(ownerEntry.requiresOwner, true);
});

test("rejects invalid access levels", () => {
  registry.clear();
  assert.throws(
    () => registry.register("test", "invalid", () => {}, { access: "superuser" }),
    /Invalid command access level/
  );
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
