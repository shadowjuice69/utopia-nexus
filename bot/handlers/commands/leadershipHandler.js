const database = require("../../services/database");
const { MessageFlags } = require("discord.js");

module.exports = async function leadershipHandler(interaction) {
  const db = database.getDb();
  const users = db.get("users").value() || [];
  const leaders = users.filter(u => u.kingdomRole && u.kingdomRole !== "Member");

  if (!leaders.length) {
    return interaction.reply({ content: "👑 No leadership roles assigned yet.", flags: MessageFlags.Ephemeral });
  }

  const lines = leaders.map(u => `• <@${u.id}> — ${u.kingdomRole}`);
  return interaction.reply({
    content: `👑 **Kingdom Leadership**\n\n${lines.join("\n")}`,
    flags: MessageFlags.Ephemeral
  });
};
