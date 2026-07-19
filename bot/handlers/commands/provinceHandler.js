const database = require("../../services/database");
const supabaseService = require("../../services/supabase");
const { MessageFlags } = require("discord.js");

module.exports = async function provinceHandler(interaction) {
  const supabase = supabaseService.getClient();

  if (supabase) {
    const { data: province } = await supabase
      .from("provinces")
      .select("*")
      .eq("discord_id", interaction.user.id)
      .limit(1);

    if (province && province.length > 0) {
      const p = province[0];
      return interaction.reply({
        content:
          `🏰 **${p.name}**\n\n` +
          `⚔️ ${p.race || "?"}/${p.personality || "?"}\n` +
          `🎯 Role: ${p.play_role || "Member"}\n` +
          `📍 Coordinates: ${p.coordinates || "None"}\n` +
          `🕐 Timezone: ${p.timezone || "None"}\n` +
          `🌊 Wave Times: ${p.wave_times || "None"}`,
        flags: MessageFlags.Ephemeral
      });
    }
  }

  const db = database.getDb();
  const users = db.get("users").value() || [];
  const user = users.find(u => u.id === interaction.user.id);

  if (!user) {
    return interaction.reply({ content: "❌ No province found. Use /utopia register first.", flags: MessageFlags.Ephemeral });
  }

  return interaction.reply({
    content: `🏰 **${user.province || "Unknown"}**\n📍 ${user.coordinates || "None"}`,
    flags: MessageFlags.Ephemeral
  });
};
