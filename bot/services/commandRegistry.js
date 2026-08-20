/**
 * Central command registry.
 *
 * Keeps command dispatch metadata in one place while preserving the existing
 * handler modules. This is the first step toward TitanBot-style command
 * discovery without changing Nexus command behavior.
 */

const registry = new Map();

function key(command, subcommand) {
  return `${command}:${subcommand || ""}`;
}

function register(command, subcommand, handler, options = {}) {
  if (!command || !subcommand) {
    throw new Error("Command registry entries require command and subcommand");
  }
  if (typeof handler !== "function") {
    throw new TypeError(`Handler for /${command} ${subcommand} must be a function`);
  }

  const entryKey = key(command, subcommand);
  if (registry.has(entryKey)) {
    throw new Error(`Duplicate command registration: /${command} ${subcommand}`);
  }

  registry.set(entryKey, Object.freeze({
    command,
    subcommand,
    handler,
    requiresRegistration: options.requiresRegistration !== false,
    requiresAdmin: options.requiresAdmin === true,
    requiresOwner: options.requiresOwner === true,
    description: options.description || ""
  }));

  return registry.get(entryKey);
}

function get(command, subcommand) {
  return registry.get(key(command, subcommand));
}

function has(command, subcommand) {
  return registry.has(key(command, subcommand));
}

function list() {
  return [...registry.values()];
}

function clear() {
  registry.clear();
}

module.exports = {
  register,
  get,
  has,
  list,
  clear
};
