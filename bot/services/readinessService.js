/**
 * Dependency readiness tracking.
 *
 * Health means the process is alive; readiness means required Nexus
 * dependencies have completed initialization.
 */

const state = new Map();

function set(name, ready, details = {}) {
  if (!name) throw new Error("Readiness dependency name is required");
  state.set(name, {
    ready: Boolean(ready),
    updatedAt: new Date().toISOString(),
    ...details
  });
}

function markReady(name, details) {
  set(name, true, details);
}

function markNotReady(name, details) {
  set(name, false, details);
}

function isReady() {
  return state.size > 0 && [...state.values()].every(item => item.ready);
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
