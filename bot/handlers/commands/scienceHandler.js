const { EmbedBuilder } = require("discord.js");
const { getKingdomInfo } = require("../../services/kingdomService");
const wikiService = require("../../services/wikiService");

const CATEGORY_EMOJI = {
  economy: '💰', military: '⚔️', arcane_arts: '🔮',
};

module.exports = async function scienceHandler(interaction) {
  const kd = await getKingdomInfo();
  const type = interaction.options.getString("type");
  const rows = await wikiService.searchScience(type);

  if (!rows || rows.length === 0) {
    return interaction.reply({ content: `🔬 No science data found for **${type}**.`, ephemeral: true });
  }

  const grouped = {};
  for (const row of rows) {
    if (!grouped[row.category]) grouped[row.category] = [];
    grouped[row.category].push(row);
  }

  const embed = new EmbedBuilder()
    .setTitle(`🔬 Science Reference — Age ${rows[0].age_number}`)
    .setColor(0x6366f1)
    .setFooter({ text: kd.footer });

  for (const [cat, sciences] of Object.entries(grouped)) {
    const emoji = CATEGORY_EMOJI[cat] || '📊';
    const catName = cat.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
    const lines = sciences.map(s => {
      let line = `**${s.science_name}** — ${s.effect} \`×${s.multiplier}\``;
      if (s.personality_modifier) line += `\n  └ Pers: ${s.personality_modifier}`;
      if (s.race_modifier)        line += `\n  └ Race: ${s.race_modifier}`;
      if (s.notes)                line += `\n  └ ⚠️ ${s.notes}`;
      return line;
    });
    embed.addFields({ name: `${emoji} ${catName}`, value: lines.join('\n'), inline: false });
  }

  return interaction.reply({ embeds: [embed], ephemeral: true });
};
