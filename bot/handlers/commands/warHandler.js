const supabaseService = require("../../services/supabase");

module.exports = async function warHandler(interaction) {
  const supabase = supabaseService.getClient();
  if (!supabase) return interaction.reply({ content: "❌ Database not connected.", ephemeral: true });

  const action = interaction.options.getString("action");
  const kingdom = interaction.options.getString("kingdom");
  const coords = interaction.options.getString("coords");
  const notes = interaction.options.getString("notes");

  if (action === "declare") {
    if (!kingdom || !coords) return interaction.reply({ content: "❌ Kingdom name and coords required.", ephemeral: true });
    await supabase.from("wars").update({ active: false }).eq("guild_id", interaction.guildId);
    const { error } = await supabase.from("wars").insert({
      guild_id: interaction.guildId,
      enemy_kingdom: kingdom,
      enemy_coords: coords,
      declared_by: interaction.user.id,
      notes: notes || null,
      active: true
    });
    if (error) return interaction.reply({ content: `❌ Error: ${error.message}`, ephemeral: true });
    return interaction.reply(`🔥 **War declared on ${kingdom} (${coords})!**${notes ? `\n📝 ${notes}` : ""}`);
  }

  if (action === "end") {
    await supabase.from("wars").update({ active: false }).eq("guild_id", interaction.guildId);
    return interaction.reply(`🕊️ **War ended.** Kingdom is at peace.`);
  }

  if (action === "status") {
    const { data } = await supabase.from("wars").select("*").eq("active", true).eq("guild_id", interaction.guildId).limit(1);
    const w = data?.[0];
    if (!w) return interaction.reply({ content: "🕊️ No active war.", ephemeral: true });
    let msg = `🔥 **Active War: ${w.enemy_kingdom} (${w.enemy_coords})**\n`;
    msg += `📅 Declared: ${new Date(w.declared_at).toLocaleString()}\n`;
    if (w.notes) msg += `📝 ${w.notes}\n`;
    return interaction.reply({ content: msg, ephemeral: true });
  }
};
