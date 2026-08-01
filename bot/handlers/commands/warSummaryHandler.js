const { getWarSummary, formatSummary } = require("../../services/warSummaryService");

module.exports = async function warSummaryHandler(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const summary = await getWarSummary();
  const text = formatSummary(summary);

  if (text.length <= 2000) {
    await interaction.editReply(text);
  } else {
    const chunks = text.match(/[\s\S]{1,1900}/g);
    await interaction.editReply(chunks[0]);
    for (let i = 1; i < chunks.length; i++) {
      await interaction.followUp({ content: chunks[i], ephemeral: true });
    }
  }
};
