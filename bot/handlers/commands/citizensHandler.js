const database = require("../../services/database");
const supabaseService = require("../../services/supabase");
const { MessageFlags } = require("discord.js");

module.exports = async function citizensHandler(interaction) {
  const supabase = supabaseService.getClient();
  if (supabase) {
    const { data: provinces } = await supabase
      .from("provinces")
      .select("name, race, personality, play_role, discord_id")
      .order("name");

    if (provinces && provinces.length > 0) {
      const lines = provinces.map(p =>
        `• ${p.discord_id ? `<@${p.discord_id}>` : p.name} — ${p.race || "?"}/${p.personality || "?"} (${p.play_role || "Member"})`
      );
      return interaction.reply({
        content: `👥 **Kingdom Citizens (${provinces.length})**\n\n${lines.join("\n")}`.slice(0, 1900),
        flags: MessageFlags.Ephemeral
      });
    }
  }

  const db = database.getDb();
  const users = db.get("users").value() || [];
  if (!users.length) {
    return interaction.reply({ content: "👥 No citizens registered yet.", flags: MessageFlags.Ephemeral });
  }
  const lines = users.map(u => `• <@${u.id}> — ${u.kingdomRole || "Member"}`);
  return interaction.reply({
    content: `👥 **Kingdom Citizens (${users.length})**\n\n${lines.join("\n")}`.slice(0, 1900),
    flags: MessageFlags.Ephemeral
  });
};
