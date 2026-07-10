const database = require("../../services/database");
const permissionService = require("../../services/permissionService");
const { MessageFlags } = require("discord.js");

module.exports = async function memberHandler(interaction) {
  if (!permissionService.isAdmin(interaction.user.id)) {
    return interaction.reply({
      content: "❌ Admin access required.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const user = interaction.options.getUser("user");

  if (!user) {
    return interaction.reply({
      content: "❌ Select a user to view.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const db = database.getDb();

  const member = db.data.users.find(
    (u) => u.id === user.id
  );

  if (!member) {
    return interaction.reply({
      content: "❌ No member record found.",
      flags: MessageFlags.Ephemeral,
    });
  }

  return interaction.reply({
    content:
      `👤 Member Profile\n\n` +
      `Name: ${member.username}\n` +
      `Status: ${member.status || "active"}\n` +
      `Joined: ${member.createdAt}\n` +
      `Removed: ${member.removedAt || "N/A"}\n` +
      `Reason: ${member.removalReason || "N/A"}`,
    flags: MessageFlags.Ephemeral,
  });
};
