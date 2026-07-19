const database = require("../../services/database");
const supabaseService = require("../../services/supabase");
const { MessageFlags } = require("discord.js");

module.exports = async function profileHandler(interaction) {
  // Try Supabase first
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
          `👤 **Profile**\n\n` +
          `🏰 Province: ${p.name || "None"}\n` +
          `⚔️ Race: ${p.race || "?"} / ${p.personality || "?"}\n` +
          `🎯 Role: ${p.play_role || "Member"}\n` +
          `📍 Coordinates: ${p.coordinates || "None"}\n` +
          `🕐 Timezone: ${p.timezone || "None"}\n` +
          `🌊 Wave Times: ${p.wave_times || "None"}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  // Fallback to local DB
  const db = database.getDb();
  const users = db.get("users").value() || [];
  const user = users.find(u => u.id === interaction.user.id);

  if (!user) {
    return interaction.reply({
      content: "❌ No profile found. Use `/utopia register` to get started.",
      flags: MessageFlags.Ephemeral,
    });
  }

  return interaction.reply({
    content:
      `👤 **Profile**\n\n` +
      `🏰 Province: ${user.province || "None"}\n` +
      `📍 Coordinates: ${user.coordinates || "None"}\n` +
      `👑 Role: ${user.kingdomRole || "Member"}\n` +
      `⭐ Level: ${user.level || 1}`,
    flags: MessageFlags.Ephemeral,
  });
};
