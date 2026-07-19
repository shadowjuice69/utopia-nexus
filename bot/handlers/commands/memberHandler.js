const database = require("../../services/database");
const supabaseService = require("../../services/supabase");
const { MessageFlags } = require("discord.js");

module.exports = async function memberHandler(interaction) {
  const target = interaction.options.getUser("user");
  const supabase = supabaseService.getClient();

  if (supabase) {
    const { data: province } = await supabase
      .from("provinces")
      .select("*")
      .eq("discord_id", target.id)
      .limit(1);

    if (province && province.length > 0) {
      const p = province[0];
      return interaction.reply({
        content:
          `👤 **${target.username}**\n\n` +
          `🏰 Province: ${p.name || "None"}\n` +
          `⚔️ Race: ${p.race || "?"}/${p.personality || "?"}\n` +
          `🎯 Role: ${p.play_role || "Member"}\n` +
          `🕐 Timezone: ${p.timezone || "None"}\n` +
          `🌊 Wave Times: ${p.wave_times || "None"}`,
        flags: MessageFlags.Ephemeral
      });
    }
  }

  const db = database.getDb();
  const users = db.get("users").value() || [];
  const member = users.find(u => u.id === target.id);

  if (!member) {
    return interaction.reply({ content: `❌ No profile found for ${target.username}.`, flags: MessageFlags.Ephemeral });
  }

  return interaction.reply({
    content:
      `👤 **${target.username}**\n\n` +
      `🏰 Province: ${member.province || "None"}\n` +
      `👑 Role: ${member.kingdomRole || "Member"}\n` +
      `⭐ Level: ${member.level || 1}`,
    flags: MessageFlags.Ephemeral
  });
};
