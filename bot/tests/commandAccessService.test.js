const assert = require("node:assert/strict");
const test = require("node:test");

const access = require("../services/commandAccessService");

const permissions = {
  isOwner: userId => userId === "owner",
  isAdmin: userId => userId === "owner" || userId === "admin"
};

test("normalizes command access from existing metadata", () => {
  assert.equal(access.normalizeAccess({}), "public");
  assert.equal(access.normalizeAccess({ requiresRegistration: true }), "registered");
  assert.equal(access.normalizeAccess({ requiresAdmin: true }), "admin");
  assert.equal(access.normalizeAccess({ requiresOwner: true }), "owner");
});

test("public commands are accessible without a user", () => {
  assert.equal(access.canAccess({}, null, permissions), true);
});

test("admin commands require an admin", () => {
  const entry = { requiresAdmin: true };
  assert.equal(access.canAccess(entry, { id: "admin" }, permissions), true);
  assert.equal(access.canAccess(entry, { id: "member" }, permissions), false);
});

test("owner commands require the owner", () => {
  const entry = { requiresOwner: true };
  assert.equal(access.canAccess(entry, { id: "owner" }, permissions), true);
  assert.equal(access.canAccess(entry, { id: "admin" }, permissions), false);
});

test("registered access requires an authenticated user", () => {
  const entry = { requiresRegistration: true };
  assert.equal(access.canAccess(entry, null, permissions), false);
  assert.equal(access.canAccess(entry, { id: "member" }, permissions), true);
});

test("denial messages match the required access level", () => {
  assert.equal(access.denialMessage({ requiresAdmin: true }), "❌ You don't have permission to use admin commands.");
  assert.equal(access.denialMessage({ requiresOwner: true }), "❌ You don't have permission to use this command.");
  assert.equal(access.denialMessage({}), null);
});
