const permissionService = require("../../services/permissionService");
const database = require("../../services/database");
const { MessageFlags } = require("discord.js");

module.exports = async function resetageHandler(interaction) {
  if (!permissionService.isOwner(interaction.user.id)) {
    return interaction.reply({
      content: "❌ Owner access required.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const db = database.getDb();

  db.data.users.forEach((member) => {
    member.province = null;
    member.coordinates = null;
  });

  await db.write();

  return interaction.reply({
    content:
      "✅ New age reset complete. Provinces and coordinates have been cleared.",
    flags: MessageFlags.Ephemeral,
  });
};
