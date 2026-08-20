/**
 * Automatic command discovery for Nexus.
 *
 * Existing command modules can opt in through module metadata while legacy
 * handlers remain compatible. The loader is intentionally deterministic and
 * fails on duplicate command keys.
 */

const fs = require("fs");
const path = require("path");
const commandRegistry = require("./commandRegistry");

function normalizeExport(commandModule, filename) {
  const handler = typeof commandModule === "function"
    ? commandModule
    : commandModule?.handler;

  if (typeof handler !== "function") {
    return null;
  }

  const metadata = typeof commandModule === "function"
    ? commandModule.command || commandModule.meta || {}
    : commandModule;

  const command = metadata.command || metadata.name;
  const subcommand = metadata.subcommand || metadata.subcommandName;

  if (!command || !subcommand) {
    return null;
  }

  return {
    command,
    subcommand,
    handler,
    options: {
      access: metadata.access,
      requiresRegistration: metadata.requiresRegistration,
      requiresAdmin: metadata.requiresAdmin,
      requiresOwner: metadata.requiresOwner,
      description: metadata.description || `Discovered from ${filename}`
    }
  };
}

function discover(directory) {
  const absolute = path.resolve(directory);
  if (!fs.existsSync(absolute)) return [];

  return fs.readdirSync(absolute, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith(".js"))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(entry => {
      const filename = path.join(absolute, entry.name);
      return normalizeExport(require(filename), entry.name);
    })
    .filter(Boolean);
}

function load(directory) {
  const discovered = discover(directory);
  for (const command of discovered) {
    commandRegistry.register(
      command.command,
      command.subcommand,
      command.handler,
      command.options
    );
  }
  return discovered.length;
}

module.exports = {
  discover,
  load,
  normalizeExport
};
