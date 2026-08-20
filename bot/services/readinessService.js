/**
 * Dependency readiness tracking.
 *
 * Health means the process is alive; readiness means required Nexus
 * dependencies have completed initialization. Optional dependencies may be
 * tracked for observability without blocking readiness.
 */

const state = new Map();

function set(name, ready, details = {}) {
  if (!name) throw new Error("Readiness dependency name is required");
  const { required = true, ...metadata } = details;
  state.set(name, {
    ready: Boolean(ready),
    required: required !== false,
    updatedAt: new Date().toISOString(),
    ...metadata
  });
}

function markReady(name, details) {
  set(name, true, details);
}

function markNotReady(name, details) {
  set(name, false, details);
}

function isReady() {
  const entries = [...state.values()].filter(item => item.required);
  return entries.length > 0 && entries.every(item => item.ready);
}

function snapshot() {
  return Object.fromEntries(
    [...state.entries()].map(([name, details]) => [name, { ...details }])
  );
}

function reset() {
  state.clear();
}

module.exports = {
  set,
  markReady,
  markNotReady,
  isReady,
  snapshot,
  reset
};
