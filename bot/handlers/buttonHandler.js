const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const {
  approveAgeUpdate,
  denyAgeUpdate
} = require("../services/ageUpdateService");

module.exports = async function buttonHandler(interaction) {

  console.log(`Button pressed: ${interaction.customId}`);

  if (interaction.customId === "continue_registration") {

    const modal = new ModalBuilder()
      .setCustomId("utopia_register_2")
      .setTitle("Register — Step 2 of 2");

    const timezone = new TextInputBuilder()
      .setCustomId("timezone")
      .setLabel("Timezone (e.g. UTC-5, EST, GMT+2)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const waveTimes = new TextInputBuilder()
      .setCustomId("wave_times")
      .setLabel("Best Wave Times (e.g. 8pm-12am)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(timezone),
      new ActionRowBuilder().addComponents(waveTimes)
    );

    return interaction.showModal(modal);
  }


  if (interaction.customId.startsWith("age_apply_")) {

    const id = interaction.customId.replace("age_apply_", "");

    const result = await approveAgeUpdate(
      id,
      interaction.user.id
    );

    if (!result) {
      return interaction.reply({
        content: "⚠️ Failed to approve age update.",
        ephemeral: true
      });
    }

    return interaction.update({
      content: `✅ Age Update #${id} Applied\nApproved by ${interaction.user}`,
      components: []
    });
  }


  if (interaction.customId.startsWith("age_revoke_")) {

    const id = interaction.customId.replace("age_revoke_", "");

    const result = await denyAgeUpdate(
      id,
      interaction.user.id
    );

    if (!result) {
      return interaction.reply({
        content: "⚠️ Failed to revoke age update.",
        ephemeral: true
      });
    }

    return interaction.update({
      content: `❌ Age Update #${id} Revoked\nRejected by ${interaction.user}`,
      components: []
    });
  }
};
