const permissionService = require("../../services/permissionService");
const database = require("../../services/database");
const { MessageFlags } = require("discord.js");

module.exports = async function logsHandler(interaction) {
  if (!permissionService.isAdmin(interaction.user.id)) {
    return interaction.reply({
      content: "❌ Admin access required.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const db = database.getDb();
  const logs = db.data.logs || [];

  if (!logs.length) {
    return interaction.reply({
      content: "📋 No admin logs found.",
      flags: MessageFlags.Ephemeral,
    });
  }

  let content = "📋 Recent Admin Logs:\n\n";

  logs
    .slice(-10)
    .reverse()
    .forEach((log) => {
      content +=
        `Action: ${log.action || "Unknown"}\n` +
        `User: ${log.target?.username || "Unknown"}\n` +
        `By: ${log.actor?.username || "Unknown"}\n\n`;
    });

  return interaction.reply({
    content,
    flags: MessageFlags.Ephemeral,
  });
};
