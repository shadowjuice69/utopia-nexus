const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const { approveAgeUpdate, denyAgeUpdate } = require("../services/ageUpdateService");
const { recalculateBuildLibrary } = require("../services/buildAgeRecalculator");

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

    if (!id || id === "undefined") {
      return interaction.reply({
        content: "⚠️ This approval button is expired. Upload the age update again.",
        ephemeral: true
      });
    }

    await interaction.deferUpdate();

    const result = await approveAgeUpdate(id, interaction.user.id);

    if (!result) {
      return interaction.editReply({
        content: "⚠️ Failed to apply age update.",
        components: []
      });
    }

    let buildRefresh = { total: 0, updated: 0, unchanged: 0, failed: [] };
    try {
      buildRefresh = await recalculateBuildLibrary(result.age_number, result.id, result.parsed || {});
    } catch (err) {
      console.error("[BUILD AGE RECALC]", err);
      buildRefresh = { total: 0, updated: 0, unchanged: 0, failed: [{ name: "Build Library", error: err.message }] };
    }

    await interaction.editReply({
      content: [
        `✅ **Age ${result.age_number} Applied** by ${interaction.user}`,
        ``,
        result.stats.summary,
        ``,
        `📊 **Rows written:** ${result.stats.raceRows} race rules • ${result.stats.personalityRows} personality rules • ${result.stats.gameRows} game rules`,
        `🧠 **Build Library:** ${buildRefresh.updated} changed • ${buildRefresh.unchanged} validated • ${buildRefresh.failed.length} failed of ${buildRefresh.total}`,
        buildRefresh.failed.length ? `⚠️ Failed builds: ${buildRefresh.failed.map((b) => b.name).slice(0, 10).join(", ")}` : `✅ All active saved builds were processed for the new Age.`
      ].join("\n"),
      components: []
    });

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
            `🧠 Build Library recalculated: ${buildRefresh.updated} changed • ${buildRefresh.unchanged} validated • ${buildRefresh.failed.length} failed`,
            `Applied by ${interaction.user} • All wiki data updated.`
          ].join("\n"));
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
