const { EventEmitter } = require("events");

/**
 * Lightweight in-process event bus for Nexus service boundaries.
 *
 * Inspired by the event-bus/relay pattern used by Gradient Bang, but kept
 * dependency-free so the existing Nexus bot remains unchanged operationally.
 * Events are best-effort notifications; authoritative state still lives in
 * Supabase and existing services remain responsible for persistence.
 */
const bus = new EventEmitter();
bus.setMaxListeners(50);

function emit(event, payload = {}) {
  bus.emit(event, {
    ...payload,
    event,
    timestamp: new Date().toISOString()
  });
}

function on(event, handler) {
  bus.on(event, handler);
  return () => bus.off(event, handler);
}

function once(event, handler) {
  bus.once(event, handler);
  return () => bus.off(event, handler);
}

module.exports = { bus, emit, on, once };
