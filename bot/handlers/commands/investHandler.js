const { EmbedBuilder } = require("discord.js");
const { calculateInvest } = require("../../services/scienceInvestService");

const CATEGORY_EMOJI = { economy: '💰', military: '⚔️', arcane: '🔮' };
const CATEGORY_LABELS = { economy: 'Economy', military: 'Military', arcane: 'Arcane Arts' };
const CATEGORY_ORDER = ['economy', 'military', 'arcane'];

module.exports = async function investHandler(interaction) {
  try {
    const buildName = interaction.options.getString("build", true);
    const categoryBooks = {
      economy: interaction.options.getInteger("economy_books") ?? 0,
      military: interaction.options.getInteger("military_books") ?? 0,
      arcane: interaction.options.getInteger("arcane_books") ?? 0
    };

    const outcome = await calculateInvest(buildName, categoryBooks);

    if (outcome.error) {
      return interaction.reply({ content: `❌ ${outcome.error}`, ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle(`📚 Science Investment — ${outcome.buildName}`)
      .setColor(0x6366f1)
      .setTimestamp();

    const orderedCats = [
      ...CATEGORY_ORDER.filter(c => outcome.results[c]),
      ...Object.keys(outcome.results).filter(c => !CATEGORY_ORDER.includes(c))
    ];

    for (const cat of orderedCats) {
      const r = outcome.results[cat];
      const emoji = CATEGORY_EMOJI[cat] || '📊';
      const label = CATEGORY_LABELS[cat] || cat;
      const lines = r.rows.map(row =>
        `**${row.name}** — ${row.allocated.toLocaleString()} books${row.effect ? `\n  └ ${row.effect}` : ""}`
      );
      embed.addFields({
        name: `${emoji} ${label} — ${r.books.toLocaleString()} books`,
        value: lines.join("\n"),
        inline: false
      });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (err) {
    console.error("[INVEST HANDLER ERROR]", err);
    if (!interaction.replied) {
      await interaction.reply({ content: "❌ Investment calculation failed.", ephemeral: true });
    }
  }
};
