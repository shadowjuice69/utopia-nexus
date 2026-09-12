const spartanAI = require('../../services/spartanAI');
const spartanBotBridge = require('../../services/spartanBotBridge');

module.exports = async function spartanHandler(interaction) {
  const question = interaction.options.getString('question', true).trim();
  await interaction.deferReply({ ephemeral: false });
  try {
    const result = await spartanAI.ask({ question, userId: interaction.user.id, channelId: interaction.channelId, guildId: interaction.guildId });
    const answer = result.answer.length > 1900 ? `${result.answer.slice(0, 1897)}...` : result.answer;
    await interaction.editReply(`🛡️ **Spartan AI**\n\n${answer}`);
    await spartanBotBridge.outboundMessage({ userId: interaction.user.id, channelId: interaction.channelId, guildId: interaction.guildId, messageId: interaction.id, content: answer, metadata: { ai: true, session_id: result.sessionId, model: result.model } });
  } catch (error) {
    await interaction.editReply(`❌ Spartan AI: ${error.message}`);
  }
};
