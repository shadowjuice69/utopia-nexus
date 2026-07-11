const permissionService = require("../../services/permissionService");
const { MessageFlags } = require("discord.js");

module.exports = async function adminHandler(interaction) {

  await interaction.deferReply({
    flags: MessageFlags.Ephemeral
  });

  if (!permissionService.isAdmin(interaction.user.id)) {
    return interaction.editReply(
      "❌ Admin access required."
    );
  }

  return interaction.editReply(
    "✅ Admin access confirmed."
  );
};
