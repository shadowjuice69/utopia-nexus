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

    await interaction.reply({
      content:
`🕵️ **Thievery Analysis**

Operation: **${result.operation}**

Raw TPA:
• Your TPA: ${result.rawTPA.attacker}
• Target TPA: ${result.rawTPA.target}

Modified TPA:
• Your TPA: ${result.modifiedTPA.attacker}
• Target TPA: ${result.modifiedTPA.target}

Ratio: **${result.ratio}x**

Rating: **${result.rating}**

Recommended Thieves:
**${result.recommendedThieves.toLocaleString()}**

Your Modifiers:
${result.modifiers.attacker.map(x => `• ${x}`).join("\n") || "None"}

Target Defense:
${result.modifiers.target.map(x => `• ${x}`).join("\n") || "None"}`
    });

  } catch (err) {
    console.error("[THIEVERY HANDLER ERROR]", err);
    await interaction.reply({
      content: "❌ Thievery calculation failed.",
      ephemeral: true
    });
  }
};
