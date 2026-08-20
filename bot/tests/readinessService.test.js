const test = require("node:test");
const assert = require("node:assert/strict");
const readiness = require("../services/readinessService");

test.beforeEach(() => readiness.reset());

test("is not ready before required dependencies are registered", () => {
  assert.equal(readiness.isReady(), false);
});

test("becomes ready only when every required dependency is ready", () => {
  readiness.markNotReady("database");
  readiness.markNotReady("discord");
  assert.equal(readiness.isReady(), false);

  readiness.markReady("database");
  assert.equal(readiness.isReady(), false);

  readiness.markReady("discord");
  assert.equal(readiness.isReady(), true);
});

test("optional dependencies are visible but do not block readiness", () => {
  readiness.markReady("database");
  readiness.markReady("discord");
  readiness.markNotReady("supabase", { required: false, reason: "disabled" });

  assert.equal(readiness.isReady(), true);
  assert.equal(readiness.snapshot().supabase.required, false);
  assert.equal(readiness.snapshot().supabase.ready, false);
});

test("snapshot exposes dependency state without exposing internal map", () => {
  readiness.markReady("database", { source: "lowdb" });
  const snapshot = readiness.snapshot();

  assert.equal(snapshot.database.ready, true);
  assert.equal(snapshot.database.source, "lowdb");
  assert.equal(typeof snapshot.database.updatedAt, "string");

  snapshot.database.ready = false;
  assert.equal(readiness.isReady(), true);
});

test("rejects unnamed dependencies", () => {
  assert.throws(() => readiness.markReady(), /name is required/);
});
