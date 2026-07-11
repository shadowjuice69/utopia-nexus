const permissionService = require("../../services/permissionService");
const userService = require("../../services/userService");
const auditService = require("../../services/auditService");
const { MessageFlags } = require("discord.js");

module.exports = async function restoreHandler(interaction) {
  if (!permissionService.isAdmin(interaction.user.id)) {
    return interaction.reply({
      content: "❌ Admin access required.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const user = interaction.options.getUser("user");

  if (!user) {
    return interaction.reply({
      content: "❌ Select a user to restore.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const restoredUser = await userService.restoreUser(user.id);

  if (!restoredUser) {
    return interaction.reply({
      content: "❌ User profile not found.",
      flags: MessageFlags.Ephemeral,
    });
  }

  await auditService.log({
    action: "RESTORE_MEMBER",
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
    content: `✅ ${user.username} is now an active member again.`,
    flags: MessageFlags.Ephemeral,
  });
};
