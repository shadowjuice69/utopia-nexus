const database = require("../../services/database");
const { MessageFlags } = require("discord.js");

module.exports = async function adminsHandler(interaction) {
  const db = database.getDb();
  const admins = db.get("admins").value() || [];

  if (!admins.length) {
    return interaction.reply({ content: "👑 No admins configured yet.", flags: MessageFlags.Ephemeral });
  }

  const lines = admins.map(id => `• <@${id}>`);
  return interaction.reply({
    content: `👑 **Kingdom Admins**\n\n${lines.join("\n")}`,
    flags: MessageFlags.Ephemeral
  });
};
