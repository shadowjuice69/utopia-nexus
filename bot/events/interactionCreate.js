const database = require("../services/database");
const permissionService = require("../services/permissionService");
const auditService = require("../services/auditService");
const modalHandler = require("../handlers/modalHandler");
const commandHandler = require("../handlers/commandHandler");

const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags,
} = require("discord.js");

module.exports = {
  name: "interactionCreate",

  async execute(interaction) {
    console.log("Interaction received:", interaction.type, interaction.commandName);

    const db = database.getDb();

    if (interaction.isModalSubmit()) {
return modalHandler(interaction);

      if (interaction.customId === "utopia_register") {
        const user = db.data.users.find(
          (u) => u.id === interaction.user.id
        );

        if (!user) {
          return interaction.reply({
            content: "❌ You need a profile first.",
            flags: MessageFlags.Ephemeral,
          });
        }

        user.province =
          interaction.fields.getTextInputValue("province");

        user.coordinates =
          interaction.fields.getTextInputValue("coordinates");

        await db.write();

        return interaction.reply({
          content:
            `✅ Registration complete!\n\n` +
            `🏰 Province: ${user.province}\n` +
            `📍 Coordinates: ${user.coordinates}`,
          flags: MessageFlags.Ephemeral,
        });
      }

      return;
    }

    if (!interaction.isChatInputCommand()) return;
    return commandHandler(interaction);

    if (interaction.commandName !== "utopia") return;

    await require("../services/userService").getOrCreateUser(interaction.user);

    const subcommand =
      interaction.options.getSubcommand();

    const user = db.data.users.find(
      (u) => u.id === interaction.user.id
    );

    if (subcommand === "register") {
      if (!user) {
        return interaction.reply({
          content: "❌ You need a profile first.",
          flags: MessageFlags.Ephemeral,
        });
      }

      if (user.province) {
        return interaction.reply({
          content:
            `⚠️ You are already registered.\n` +
            `🏰 Province: ${user.province}\n` +
            `📍 Coordinates: ${user.coordinates}`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const modal = new ModalBuilder()
        .setCustomId("utopia_register")
        .setTitle("Province Registration");

      const province = new TextInputBuilder()
        .setCustomId("province")
        .setLabel("Province Name")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const coordinates = new TextInputBuilder()
        .setCustomId("coordinates")
        .setLabel("Coordinates")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(province),
        new ActionRowBuilder().addComponents(coordinates)
      );

      return interaction.showModal(modal);
     }

    if (subcommand === "admin") {
  await interaction.deferReply({
    flags: MessageFlags.Ephemeral,
  });

  if (!permissionService.isAdmin(interaction.user.id)) {
    return interaction.editReply(
      "❌ Admin access required."
    );
  }

  console.log("Admin reply reached");

  return interaction.editReply(
    "✅ Admin access confirmed."
  );
}
      if (subcommand === "addadmin") {
      const roles = require("../config/roles");

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

      return interaction.reply({
        content: `✅ ${user.username} is now an admin.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (subcommand === "removeadmin") {
      const roles = require("../config/roles");

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
    }

if (subcommand === "removecheck") {
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
          `🗑️ Removal Preview\n\n` +
          `User: ${user.username}\n` +
          `New Status: former_member\n` +
          `Reason: ${reason}\n\n` +
          `No changes made.`,
        flags: MessageFlags.Ephemeral,

      });
    }

    if (subcommand === "member") {
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
    }

    if (subcommand === "role") {
      if (!permissionService.isAdmin(interaction.user.id)) {
        return interaction.reply({
          content: "❌ Admin access required.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const user = interaction.options.getUser("user");
      const role = interaction.options.getString("role");

      if (!user) {
        return interaction.reply({
          content: "❌ Select a user to assign a role.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const allowedRoles = [
        "Monarch",
        "Steward",
        "War Leader",
        "Member",
      ];

      if (!role) {
        return interaction.reply({
          content: "❌ Provide a kingdom role.",
          flags: MessageFlags.Ephemeral,
        });
      }

      if (!allowedRoles.includes(role)) {
        return interaction.reply({
          content:
            "❌ Invalid role.\nAvailable: Monarch, Steward, War Leader, Member",
          flags: MessageFlags.Ephemeral,
        });
      }

      const member = db.data.users.find(
        (u) => u.id === user.id
      );

      if (!member) {
        return interaction.reply({
          content: "❌ User profile not found.",
          flags: MessageFlags.Ephemeral,
        });
      }

      member.kingdomRole = role;

      await db.write();

      return interaction.reply({
        content:
          `✅ ${user.username} is now:\n` +
          `👑 Kingdom Role: ${role}`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (subcommand === "remove") {
      const userService = require("../services/userService");

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

      const removedUser = await userService.removeUser(
        user.id,
        reason
      );

      if (!removedUser) {
        return interaction.reply({
          content: "❌ User profile not found.",
          flags: MessageFlags.Ephemeral,
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

      return interaction.reply({
        content:
          `✅ ${user.username} is now a former member.\n` +
          `Reason: ${reason}`,
        flags: MessageFlags.Ephemeral,
      });

      }
    },
};
