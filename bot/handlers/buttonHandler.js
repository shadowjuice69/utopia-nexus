const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const { approveAgeUpdate, denyAgeUpdate } = require("../services/ageUpdateService");

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

    // Defer so we have time to parse + insert
    await interaction.deferUpdate();

    const result = await approveAgeUpdate(id, interaction.user.id);

    if (!result) {
      return interaction.editReply({
        content: "⚠️ Failed to apply age update.",
        components: []
      });
    }

    // Update the review message - single edit, no spam
    await interaction.editReply({
      content: [
        `✅ **Age ${result.age_number} Applied** by ${interaction.user}`,
        ``,
        result.stats.summary,
        ``,
        `📊 **Rows written:** ${result.stats.raceRows} race rules • ${result.stats.personalityRows} personality rules • ${result.stats.gameRows} game rules`
      ].join('\n'),
      components: []
    });

    // Send ONE announcement to the alert channel
    const supabaseService = require("../services/supabase");
    const supabase = supabaseService.getClient();
    if (supabase) {
      const { data: setting } = await supabase
        .from("bot_settings")
        .select("value")
        .eq("key", "alert_channel")
        .limit(1);

      const channelId = setting?.[0]?.value;
      if (channelId) {
        const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
        if (channel) {
          await channel.send([
            `📘 **Age ${result.age_number} Rules Now Active**`,
            ``,
            result.stats.summary,
            ``,
            `Applied by ${interaction.user} • All wiki data updated.`
          ].join('\n'));
        }
      }
    }

    return;
  }

  if (interaction.customId.startsWith("age_revoke_")) {
    const id = interaction.customId.replace("age_revoke_", "");

    const result = await denyAgeUpdate(id, interaction.user.id);

    if (!result) {
      return interaction.reply({
        content: "⚠️ Failed to revoke age update.",
        ephemeral: true
      });
    }

    return interaction.update({
      content: `❌ Age Update #${id} Revoked by ${interaction.user}`,
      components: []
    });
  }
};
