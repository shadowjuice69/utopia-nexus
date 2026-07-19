const database = require("../../services/database");
const permissionService = require("../../services/permissionService");
const { MessageFlags } = require("discord.js");

module.exports = async function resetageHandler(interaction) {
  if (!permissionService.isOwner(interaction.user.id)) {
    return interaction.reply({ content: "❌ Owner access required.", flags: MessageFlags.Ephemeral });
  }

  const db = database.getDb();
  const users = db.get("users").value() || [];
  users.forEach(u => {
    u.province = null;
    u.coordinates = null;
  });
  db.set("users", users).write();

  return interaction.reply({
    content: "✅ New age reset complete. Provinces and coordinates cleared.",
    flags: MessageFlags.Ephemeral
  });
};
