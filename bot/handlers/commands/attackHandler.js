const { EmbedBuilder } = require("discord.js");
const { calculateAttack } = require("../../services/attackCalculatorService");

module.exports = async function attackHandler(interaction) {
  try {
    const yourNW      = interaction.options.getNumber("your_nw", true);
    const targetNW    = interaction.options.getNumber("target_nw", true);
    const yourAcres   = interaction.options.getInteger("your_acres", true);
    const targetAcres = interaction.options.getInteger("target_acres", true);
    const yourMAP     = interaction.options.getInteger("your_map") ?? 0;
    const isWar       = interaction.options.getBoolean("war") ?? false;
    const offMods     = interaction.options.getInteger("off_mods") ?? 0;

    const result = calculateAttack({ yourNW, targetNW, yourAcres, targetAcres, yourMAP, isWar, offMods });

    if (!result) {
      return interaction.reply({ content: "❌ Attack calculation failed.", ephemeral: true });
    }

    const modLabel = isWar ? "War Modifier" : "Magic Modifier";
    const modValue = isWar ? result.war : result.magic;

    const embed = new EmbedBuilder()
      .setTitle("⚔️ Attack Calculator")
      .setColor(isWar ? 0xcc2200 : 0x2255cc)
      .addFields(
        {
          name: "📊 NW Ratio",
          value:
            `a = **${result.a}**\n` +
            `${modLabel}: **${modValue}**\n` +
            `Gains Factor (GF): **${result.gf}**`,
          inline: false
        },
        {
          name: "🗺️ MAP",
          value:
            `Current MAP: **${yourMAP}%**\n` +
            `MAP Factor: **${result.mapf.toFixed(3)}**\n` +
            `MAP Gain (if hit): **+${result.mapGain}** → **${result.newMAP}%**`,
          inline: false
        },
        {
          name: "🏰 Estimated Acres Gained",
          value:
            `**${result.acresGained.toLocaleString()} acres**` +
            (result.cappedAt20Percent ? "\n⚠️ Capped at 20% of your land" : ""),
          inline: false
        },
        {
          name: "⚙️ Parameters",
          value:
            `Your NW: **${yourNW.toLocaleString()}** | Target NW: **${targetNW.toLocaleString()}**\n` +
            `Your Acres: **${yourAcres.toLocaleString()}** | Target Acres: **${targetAcres.toLocaleString()}**\n` +
            `War: **${isWar ? "Yes" : "No"}** | Offensive Mods: **${offMods}**`,
          inline: false
        }
      )
      .setTimestamp()
      .setFooter({ text: "Formula: dev 2026-08-19" });

    await interaction.reply({ embeds: [embed], ephemeral: true });

  } catch (err) {
    console.error("[ATTACK HANDLER ERROR]", err);
    if (!interaction.replied) {
      await interaction.reply({ content: "❌ Attack calculation failed.", ephemeral: true });
    }
  }
};
