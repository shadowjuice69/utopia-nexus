const { MessageFlags } = require('discord.js');
const spartanAccess = require('../../services/spartanAccessService');

module.exports = async function spartanStatusHandler(interaction) {
  const row = await spartanAccess.get(interaction.user.id);
  if (!row) return interaction.reply({ content: '🛡️ **Spartan:** not registered. Use `/spartan register`.', flags: MessageFlags.Ephemeral });
  return interaction.reply({
    content: `🛡️ **Spartan Access**\nStatus: **${row.status}**\nRole: **${row.role}**\nRegistration: **${row.registration_id}**${row.reason ? `\nReason: ${row.reason}` : ''}`,
    flags: MessageFlags.Ephemeral
  });
};
