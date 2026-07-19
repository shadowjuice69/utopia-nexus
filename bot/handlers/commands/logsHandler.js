const database = require("../../services/database");
const { MessageFlags } = require("discord.js");

module.exports = async function logsHandler(interaction) {
  const db = database.getDb();
  const logs = db.get("logs").value() || [];

  if (!logs.length) {
    return interaction.reply({ content: "📋 No audit logs yet.", flags: MessageFlags.Ephemeral });
  }

  const recent = logs.slice(-10).reverse();
  const lines = recent.map(l => `• [${l.time?.slice(0,10)}] **${l.action}** by ${l.actor} → ${l.target || "—"}`);

  return interaction.reply({
    content: `📋 **Recent Audit Logs**\n\n${lines.join("\n")}`,
    flags: MessageFlags.Ephemeral
  });
};
