const { EmbedBuilder } = require("discord.js");
const { getKingdomInfo } = require("../../services/kingdomService");
const supabaseService = require("../../services/supabase");

module.exports = async function ambushHandler(interaction) {
  const kd = await getKingdomInfo();
  const sb = supabaseService.getClient();

  const targetName = interaction.options.getString("target");

  if (!targetName) {
    return interaction.reply({
      content: `❌ Provide a target province name to look up ambush data.`,
      ephemeral: true
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const { data: rows, error } = await sb
    .from("intel_throne")
    .select("province, kd_code, ambush, updated_at")
    .ilike("province", `%${targetName}%`)
    .not("ambush", "is", null)
    .order("updated_at", { ascending: false })
    .limit(5);

  if (error || !rows || rows.length === 0) {
    return interaction.editReply({
      content: `❌ No ambush data found for **${targetName}**. Run the ARMIES tab intel first.`
    });
  }

  const embed = new EmbedBuilder()
    .setTitle(`⚡ Ambush Numbers — "${targetName}"`)
    .setColor(0xff6600);

  for (const row of rows) {
    const minOff = row.ambush;
    const safeOff = minOff + 100;
    const age = Math.round((Date.now() - new Date(row.updated_at)) / 60000);
    embed.addFields({
      name: `${row.province} (${row.kd_code})`,
      value: [
        `🛡️ Ambush def: **${row.ambush.toLocaleString()}**`,
        `⚔️ Need: **${minOff.toLocaleString()}** raw off (safe: **${safeOff.toLocaleString()}**)`,
        `🕐 Intel: ${age}m ago`
      ].join("\n")
    });
  }

  embed.setFooter({ text: kd.footer });
  return interaction.editReply({ embeds: [embed] });
};
