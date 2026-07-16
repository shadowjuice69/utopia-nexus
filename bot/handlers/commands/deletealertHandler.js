const supabaseService = require("../../services/supabase");

module.exports = async function deletealertHandler(interaction) {
  const supabase = supabaseService.getClient();
  if (!supabase) return interaction.reply({ content: "❌ Database not connected.", ephemeral: true });

  const label = interaction.options.getString("label");

  const { error } = await supabase
    .from("alerts")
    .delete()
    .eq("guild_id", interaction.guildId)
    .eq("label", label);

  if (error) return interaction.reply({ content: `❌ Error: ${error.message}`, ephemeral: true });

  await interaction.reply({ content: `✅ Alert **${label}** deleted.`, ephemeral: true });
};
