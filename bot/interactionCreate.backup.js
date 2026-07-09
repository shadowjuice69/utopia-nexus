const database = require("../services/database");
const permissionService = require("../services/permissionService");

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
    const db = database.getDb();

    // Registration form submit
    if (interaction.isModalSubmit()) {
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

    if (interaction.commandName !== "utopia") return;

    const subcommand =
      interaction.options.getSubcommand();

    const user = db.data.users.find(
      (u) => u.id === interaction.user.id
    );

    // REGISTER
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
        .setPlaceholder("Example: 4:9")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(province),
        new ActionRowBuilder().addComponents(coordinates)
      );

      return interaction.showModal(modal);
    }

    // PROVINCE
    if (subcommand === "province") {
      if (!user) {
        return interaction.reply({
          content: "❌ No profile found.",
          flags: MessageFlags.Ephemeral,
        });
      }

      return interaction.reply({
        content:
          `🏰 Province Profile\n\n` +
          `👤 <@${user.id}>\n` +
          `🏰 Province: ${user.province}\n` +
          `📍 Location: ${user.coordinates}\n` +
          `👑 Kingdom Role: ${user.kingdomRole || "Member"}\n` +
          `🟢 Status: ${user.status || "active"}\n` +
          `⭐ Level: ${user.level || 1}`,
        flags: MessageFlags.Ephemeral,
      });
    }

    // PROFILE
    if (subcommand === "profile") {
      if (!user) {
        return interaction.reply({
          content: "❌ No profile found.",
          flags: MessageFlags.Ephemeral,
        });
      }

      return interaction.reply({
        content:
          `👤 Profile\n\n` +
          `🏰 Province: ${user.province || "None"}\n` +
          `📍 Location: ${user.coordinates || "None"}\n` +
          `👑 Role: ${user.kingdomRole || "Member"}\n` +
          `🟢 Status: ${user.status || "active"}\n` +
          `⭐ Level: ${user.level || 1}`,
        flags: MessageFlags.Ephemeral,
      });
    }

    // CITIZENS
    if (subcommand === "citizens") {
      let reply = "🏰 Kingdom Roster\n\n";

      db.data.users.forEach((member) => {
        reply += `👤 <@${member.id}>\n`;
        reply += `🏰 Province: ${member.province || "None"}\n`;
        reply += `📍 Location: ${member.coordinates || "None"}\n`;
        reply += `👑 Role: ${member.kingdomRole || "Member"}\n\n`;
      });

      return interaction.reply({
        content: reply,
        flags: MessageFlags.Ephemeral,
      });
    }

    // LEADERSHIP
    if (subcommand === "leadership") {
      const leaders = db.data.users.filter(
        (member) =>
          member.kingdomRole &&
          member.kingdomRole !== "Member"
      );

      let reply = "🏰 Kingdom Leadership\n\n";

      leaders.forEach((leader) => {
        reply += `👑 ${leader.kingdomRole}\n`;
        reply += `<@${leader.id}>\n\n`;
      });

      return interaction.reply({
        content: reply || "No leadership assigned.",
        flags: MessageFlags.Ephemeral,
      });
    }

    // ROLE
    if (subcommand === "role") {
      if (!permissionService.isAdmin(interaction.user.id)) {
        return interaction.reply({
          content: "❌ Admin access required.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const target =
        interaction.options.getUser("user");

      const role =
        interaction.options.getString("role");

      const member = db.data.users.find(
        (u) => u.id === target.id
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
          `✅ ${target.username} is now:\n` +
          `👑 Kingdom Role: ${role}`,
        flags: MessageFlags.Ephemeral,
      });
    }

    // ADMINS
    if (subcommand === "admins") {
      const roles = require("../config/roles");

      let reply = "👑 Owner:\n";
      reply += `• <@${roles.owner}>\n\n`;

      reply += "🛡️ Admins:\n";

      const admins = db.data.admins || [];

      if (!admins.length) {
        reply += "• No admins added";
      } else {
        admins.forEach((id) => {
          reply += `• <@${id}>\n`;
        });
      }

      return interaction.reply({
        content: reply,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
