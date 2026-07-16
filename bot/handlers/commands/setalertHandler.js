const supabaseService = require("../../services/supabase");

module.exports = async function setalertHandler(interaction) {
  const supabase = supabaseService.getClient();
  if (!supabase) return interaction.reply({ content: "❌ Database not connected.", ephemeral: true });

  const label = interaction.options.getString("label");
  const ticksRaw = interaction.options.getString("ticks");
  const message = interaction.options.getString("message");
  const channelId = interaction.options.getChannel("channel")?.id || interaction.channelId;
  const pingRole = interaction.options.getRole("role")?.id || null;

  const ticks = ticksRaw.split(",").map(t => parseInt(t.trim())).filter(t => !isNaN(t) && t >= 1 && t <= 24);

  if (!ticks.length) return interaction.reply({ content: "❌ Invalid ticks. Use comma-separated numbers 1-24.", ephemeral: true });

  const { error } = await supabase.from("alerts").insert({
    guild_id: interaction.guildId,
    channel_id: channelId,
    label,
    ticks,
    message,
    ping_role: pingRole,
    created_by: interaction.user.id,
    active: true
  });

  if (error) return interaction.reply({ content: `❌ Error: ${error.message}`, ephemeral: true });

  await interaction.reply({
    content: `✅ Alert **${label}** set for tick(s) **${ticks.join(", ")}**\n📢 Channel: <#${channelId}>${pingRole ? `\n🔔 Ping: <@&${pingRole}>` : ""}`,
    ephemeral: true
  });
};
