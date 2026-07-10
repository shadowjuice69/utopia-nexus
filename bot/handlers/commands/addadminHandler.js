const permissionService = require("../../services/permissionService");
const auditService = require("../../services/auditService");
const { MessageFlags } = require("discord.js");

module.exports = async function addadminHandler(interaction) {
  if (!permissionService.isOwner(interaction.user.id)) {
    return interaction.reply({
      content: "❌ Only the owner can add admins.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const user = interaction.options.getUser("user");

  if (!user) {
    return interaction.reply({
      content: "❌ Select a user to add as admin.",
      flags: MessageFlags.Ephemeral,
    });
  }

  await permissionService.addAdmin(user.id);

  await auditService.log({
    action: "ADD_ADMIN",
    actor: {
      id: interaction.user.id,
      username: interaction.user.username,
    },
    target: {
      id: user.id,
      username: user.username,
    },
  });

  await interaction.reply({
    content: `✅ ${user.username} is now an admin.`,
    flags: MessageFlags.Ephemeral,
  });
};
