const supabaseService = require("../../services/supabase");

module.exports = async function alertsHandler(interaction) {
  const supabase = supabaseService.getClient();
  if (!supabase) return interaction.reply({ content: "❌ Database not connected.", ephemeral: true });

  const { data, error } = await supabase
    .from("alerts")
    .select("*")
    .eq("guild_id", interaction.guildId)
    .order("created_at", { ascending: false });

  if (error) return interaction.reply({ content: `❌ Error: ${error.message}`, ephemeral: true });
  if (!data?.length) return interaction.reply({ content: "No alerts set.", ephemeral: true });

  let msg = "🔔 **Active Alerts**\n\n";
  for (const a of data) {
    msg += `**${a.label}** — Ticks: ${a.ticks.join(", ")}\n`;
    msg += `  📢 <#${a.channel_id}> | ${a.active ? "✅ Active" : "❌ Disabled"}\n`;
    msg += `  💬 ${a.message}\n\n`;
  }

  await interaction.reply({ content: msg, ephemeral: true });
};
