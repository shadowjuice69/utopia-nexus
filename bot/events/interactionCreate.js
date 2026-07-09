const database = require("../services/database");

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

    // Handle registration modal submission
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

        user.province = interaction.fields.getTextInputValue(
          "province"
        );

        user.coordinates = interaction.fields.getTextInputValue(
          "coordinates"
        );

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

    // /utopia register
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

      const provinceInput =
        new TextInputBuilder()
          .setCustomId("province")
          .setLabel("Province Name")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

      const coordinateInput =
        new TextInputBuilder()
          .setCustomId("coordinates")
          .setLabel("Coordinates")
          .setPlaceholder("Example: 4:9")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

      const provinceRow =
        new ActionRowBuilder().addComponents(
          provinceInput
        );

      const coordinateRow =
        new ActionRowBuilder().addComponents(
          coordinateInput
        );

      modal.addComponents(
        provinceRow,
        coordinateRow
      );

      return interaction.showModal(modal);
    }

    // /utopia province
    if (subcommand === "province") {
      if (!user) {
        return interaction.reply({
          content:
            "❌ No profile found. Use /utopia register first.",
          flags: MessageFlags.Ephemeral,
        });
      }

      return interaction.reply({
        content:
          `🏰 Province Profile\n\n` +
          `👤 <@${user.id}>\n` +
          `🏰 Province: ${user.province || "None"}\n` +
          `📍 Location: ${user.coordinates || "None"}\n` +
          `👑 Kingdom Role: ${user.kingdomRole || "Member"}\n` +
          `🟢 Status: ${user.status || "active"}\n` +
          `⭐ Level: ${user.level || 1}`,
        flags: MessageFlags.Ephemeral,
      });
    }

    // /utopia profile
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

    // /utopia citizens
    if (subcommand === "citizens") {
      if (!db.data.users.length) {
        return interaction.reply({
          content: "🏰 No registered citizens found.",
          flags: MessageFlags.Ephemeral,
        });
      }

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

    // /utopia leadership
    if (subcommand === "leadership") {
      const leaders = db.data.users.filter(
        (member) =>
          member.kingdomRole &&
          member.kingdomRole !== "Member"
      );

      if (!leaders.length) {
        return interaction.reply({
          content: "🏰 No leadership assigned.",
          flags: MessageFlags.Ephemeral,
        });
      }

      let reply = "🏰 Kingdom Leadership\n\n";

      leaders.forEach((leader) => {
        reply += `👑 ${leader.kingdomRole}\n`;
        reply += `<@${leader.id}>\n\n`;
      });

      return interaction.reply({
        content: reply,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
