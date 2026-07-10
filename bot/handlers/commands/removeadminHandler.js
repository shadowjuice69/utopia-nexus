const permissionService = require("../../services/permissionService");
const auditService = require("../../services/auditService");
const roles = require("../../config/roles");
const { MessageFlags } = require("discord.js");

module.exports = async function removeadminHandler(interaction) {
  if (!permissionService.isOwner(interaction.user.id)) {
    return interaction.reply({
      content: "❌ Only the owner can remove admins.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const user = interaction.options.getUser("user");

  if (!user) {
    return interaction.reply({
      content: "❌ Select a user to remove.",
      flags: MessageFlags.Ephemeral,
    });
  }

  if (user.id === roles.owner) {
    return interaction.reply({
      content: "❌ The owner cannot be removed.",
      flags: MessageFlags.Ephemeral,
    });
  }

  await permissionService.removeAdmin(user.id);

  await auditService.log({
    action: "REMOVE_ADMIN",
    actor: {
      id: interaction.user.id,
      username: interaction.user.username,
    },
    target: {
      id: user.id,
      username: user.username,
    },
  });

  return interaction.reply({
    content: `✅ ${user.username} is no longer an admin.`,
    flags: MessageFlags.Ephemeral,
  });
};
