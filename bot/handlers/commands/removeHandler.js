const userService = require("../../services/userService");
const permissionService = require("../../services/permissionService");
const auditService = require("../../services/auditService");
const {
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

module.exports = async function removeHandler(interaction) {
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
      content: "❌ Select a user to remove.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const confirmButton = new ButtonBuilder()
    .setCustomId("confirm_remove")
    .setLabel("Confirm")
    .setStyle(ButtonStyle.Danger);

  const cancelButton = new ButtonBuilder()
    .setCustomId("cancel_remove")
    .setLabel("Cancel")
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder()
    .addComponents(confirmButton, cancelButton);

  const confirm = await interaction.reply({
    content:
      `⚠️ Confirm removal?\n\n` +
      `User: ${user.username}\n` +
      `Reason: ${reason}`,
    components: [row],
    flags: MessageFlags.Ephemeral,
  });

  const collector = confirm.createMessageComponentCollector({
    time: 30000,
  });

  collector.on("collect", async (button) => {
    if (button.user.id !== interaction.user.id) {
      return button.reply({
        content: "❌ You cannot use this button.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (button.customId === "cancel_remove") {
      collector.stop();

      return button.update({
        content: "❌ Removal cancelled.",
        components: [],
      });
    }

    if (button.customId === "confirm_remove") {
      const removedUser = await userService.removeUser(
        user.id,
        reason
      );

      if (!removedUser) {
        return button.update({
          content: "❌ User profile not found.",
          components: [],
        });
      }

      await auditService.log({
        action: "REMOVE_MEMBER",
        actor: {
          id: interaction.user.id,
          username: interaction.user.username,
        },
        target: {
          id: user.id,
          username: user.username,
        },
        reason,
      });

      collector.stop();

      return button.update({
        content:
          `✅ ${user.username} is now a former member.\n` +
          `Reason: ${reason}`,
        components: [],
      });
    }
  });
};
