const { EmbedBuilder } = require("discord.js");
const thieveryCalculatorService = require("../../services/thieveryCalculatorService");

module.exports = async function thieveryHandler(interaction) {
  try {
    const operation = interaction.options.getString("operation");
    const yourTPA = interaction.options.getNumber("your_tpa");
    const targetTPA = interaction.options.getNumber("target_tpa");
    const thieves = interaction.options.getInteger("thieves");

    const yourModifiers = interaction.options.getString("your_modifiers")
      ?.split(",")
      .map(x => x.trim())
      .filter(Boolean) || [];

    const targetModifiers = interaction.options.getString("target_modifiers")
      ?.split(",")
      .map(x => x.trim())
      .filter(Boolean) || [];

    const result = await thieveryCalculatorService.calculateThieves({
      operation,
      yourTPA,
      targetTPA,
      thievesAvailable: thieves,
      yourModifiers,
      targetModifiers
    });

    const embed = new EmbedBuilder()
      .setTitle("🕵️ Thievery Analysis")
      .setDescription(`Operation: **${result.operation}**`)
      .addFields(
        {
          name: "📊 Modified TPA",
          value:
            `Your TPA: **${result.modifiedTPA.attacker}**\n` +
            `Target TPA: **${result.modifiedTPA.target}**`
        },
        {
          name: "⚖️ Result",
          value:
            `Ratio: **${result.ratio}x**\n` +
            `Rating: **${result.rating}**`
        },
        {
          name: "🧙 Recommended Thieves",
          value: `**${result.recommendedThieves.toLocaleString()}**`
        },
        {
          name: "⚔️ Your Modifiers",
          value: result.modifiers.attacker.length
            ? result.modifiers.attacker.map(x => `• ${x}`).join("\n")
            : "None"
        },
        {
          name: "🛡️ Target Defense",
          value: result.modifiers.target.length
            ? result.modifiers.target.map(x => `• ${x}`).join("\n")
            : "None"
        }
      )
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });

  } catch (err) {
    console.error("[THIEVERY HANDLER ERROR]", err);

    if (!interaction.replied) {
      await interaction.reply({
        content: "❌ Thievery calculation failed.",
        ephemeral: true
      });
    }
  }
};
