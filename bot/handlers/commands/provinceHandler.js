const database = require("../../services/database");
const supabaseService = require("../../services/supabase");
const { MessageFlags } = require("discord.js");

module.exports = async function provinceHandler(interaction) {
  const supabase = supabaseService.getClient();

  if (supabase) {
    const { data: province } = await supabase
      .from("spartan_province_registry")
      .select("province_name, kingdom_code, slot, metadata")
      .eq("user_id", interaction.user.id)
      .limit(1);

    if (province && province.length > 0) {
      const p = province[0];
      const metadata = p.metadata && typeof p.metadata === "object" ? p.metadata : {};
      const throne = metadata.throne && typeof metadata.throne === "object" ? metadata.throne : {};
      return interaction.reply({
        content:
          `🏰 **${p.province_name || "Unknown"}**

` +
          `⚔️ ${throne.race || "?"}/${throne.personality || "?"}
` +
          `🎯 Role: ${metadata.play_role || "Member"}
` +
          `📍 Coordinates: ${metadata.coordinates || p.slot || "None"}
` +
          `🕐 Timezone: ${metadata.timezone || "None"}
` +
          `🌊 Wave Times: ${metadata.wave_times || "None"}
` +
          `🏳️ Kingdom: ${p.kingdom_code || "None"}`,
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
    content: `🏰 **${user.province || "Unknown"}**
📍 ${user.coordinates || "None"}`,
    flags: MessageFlags.Ephemeral
  });
};
