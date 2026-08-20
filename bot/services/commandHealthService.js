/**
 * Read-only diagnostics for the Nexus command registry.
 *
 * Keeps operational reporting separate from registration/dispatch logic.
 */

const registry = require("./commandRegistry");

function snapshot() {
  const commands = registry.list();
  const byAccess = commands.reduce((counts, command) => {
    counts[command.access] = (counts[command.access] || 0) + 1;
    return counts;
  }, {});

  return {
    healthy: commands.every(command => typeof command.handler === "function"),
    count: commands.length,
    byAccess,
    commands: commands.map(command => ({
      command: command.command,
      subcommand: command.subcommand,
      access: command.access,
      description: command.description
    }))
  };
}

module.exports = { snapshot };
