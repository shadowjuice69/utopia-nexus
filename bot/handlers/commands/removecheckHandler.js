const permissionService = require("../../services/permissionService");
const { MessageFlags } = require("discord.js");

module.exports = async function removecheckHandler(interaction) {
  if (!permissionService.isAdmin(interaction.user.id)) {
    return interaction.reply({
      content: "❌ Admin access required.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const user = interaction.options.getUser("user");
  const reason =
    interaction.options.getString("reason") ||
    "No reason provided";

  if (!user) {
    return interaction.reply({
      content: "❌ Select a user to check.",
      flags: MessageFlags.Ephemeral,
    });
  }

  return interaction.reply({
    content:
      `⚠️ Removal Preview\n\n` +
      `User: ${user.username}\n` +
      `New Status: former_member\n` +
      `Reason: ${reason}\n\n` +
      `No changes made.`,
    flags: MessageFlags.Ephemeral,
  });
};
