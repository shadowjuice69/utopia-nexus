const database = require("../services/database");
const supabaseService = require("../services/supabase");
const { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");

module.exports = async function modalHandler(interaction) {

  const db = database.getDb();
  const supabase = supabaseService.getClient();

  // STEP 1
  if (interaction.customId === "utopia_register_1") {

    const user = db.data.users.find(u => u.id === interaction.user.id);

    if (!user) {
      return interaction.reply({
        content: "❌ You need a profile first. Use /utopia register.",
        flags: MessageFlags.Ephemeral,
      });
    }

    // Save step 1 data temporarily on user object
    user.province = interaction.fields.getTextInputValue("province");
    user.coordinates = interaction.fields.getTextInputValue("coordinates");
    user._reg_race = interaction.fields.getTextInputValue("race");
    user._reg_personality = interaction.fields.getTextInputValue("personality");
    user._reg_play_role = interaction.fields.getTextInputValue("play_role");
    await db.write();

    // Show step 2 modal
    const modal2 = new ModalBuilder()
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

    modal2.addComponents(
      new ActionRowBuilder().addComponents(timezone),
      new ActionRowBuilder().addComponents(waveTimes)
    );

    return interaction.showModal(modal2);
  }

  // STEP 2
  if (interaction.customId === "utopia_register_2") {

    const user = db.data.users.find(u => u.id === interaction.user.id);

    if (!user) {
      return interaction.reply({
        content: "❌ Registration session expired. Please start again.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const timezone = interaction.fields.getTextInputValue("timezone");
    const waveTimes = interaction.fields.getTextInputValue("wave_times");

    // Save to local db
    user.timezone = timezone;
    user.wave_times = waveTimes;
    await db.write();

    // Save to Supabase provinces table
    if (supabase) {
      const { error } = await supabase
        .from("provinces")
        .upsert({
          user_id: interaction.user.id,
          name: user.province,
          coordinates: user.coordinates,
          race: user._reg_race,
          personality: user._reg_personality,
          play_role: user._reg_play_role,
          timezone: timezone,
          wave_times: waveTimes,
          discord_id: interaction.user.id,
          updated_at: new Date().toISOString()
        }, { onConflict: "user_id" });

      if (error) {
        console.error("[REGISTER SUPABASE ERROR]", error.message);
      }
    }

    return interaction.reply({
      content:
        `✅ **Registration Complete!**\n\n` +
        `🏰 Province: ${user.province}\n` +
        `📍 Coordinates: ${user.coordinates}\n` +
        `⚔️ Race: ${user._reg_race}\n` +
        `🧠 Personality: ${user._reg_personality}\n` +
        `🎯 Role: ${user._reg_play_role}\n` +
        `🕐 Timezone: ${timezone}\n` +
        `⏰ Best Wave Times: ${waveTimes}`,
      flags: MessageFlags.Ephemeral,
    });
  }
};
