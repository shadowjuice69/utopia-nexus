const { analyzeWar } = require("../../services/warAnalysisService");

module.exports = async function analyzeWarHandler(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const analysis = await analyzeWar();

  if (!analysis) {
    await interaction.editReply("⚠️ Could not retrieve war data. Check database connection.");
    return;
  }

  if (analysis.length <= 1900) {
    await interaction.editReply(`⚔️ **War Analysis**\n\n${analysis}`);
  } else {
    const chunks = analysis.match(/.{1,1900}/gs);
    await interaction.editReply(`⚔️ **War Analysis**\n\n${chunks[0]}`);
    for (let i = 1; i < chunks.length; i++) {
      await interaction.followUp({ content: chunks[i], ephemeral: true });
    }
  }
};
