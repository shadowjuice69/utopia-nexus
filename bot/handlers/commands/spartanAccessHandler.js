const { MessageFlags } = require('discord.js');
const spartanAccess = require('../../services/spartanAccessService');

module.exports = async function spartanAccessHandler(interaction) {
  const action = interaction.options.getString('action', true);
  const target = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason') || 'Spartan administrator action';
  const actor = interaction.user.id;

  if (target.id === actor && action !== 'grant') {
    return interaction.reply({ content: '❌ You cannot disable your own Spartan access.', flags: MessageFlags.Ephemeral });
  }

  try {
    let row;
    if (action === 'grant') row = await spartanAccess.grant(target.id, actor, reason);
    if (action === 'suspend') row = await spartanAccess.suspend(target.id, actor, reason);
    if (action === 'revoke') row = await spartanAccess.revoke(target.id, actor, reason);
    if (!row) return interaction.reply({ content: '❌ Unknown access action.', flags: MessageFlags.Ephemeral });
    return interaction.reply({
      content: `🛡️ **Spartan access updated**\nUser: <@${target.id}>\nStatus: **${row.status}**\nReason: ${reason}`,
      flags: MessageFlags.Ephemeral
    });
  } catch (error) {
    console.error('[SPARTAN ACCESS COMMAND]', error);
    return interaction.reply({ content: `❌ ${error.message}`, flags: MessageFlags.Ephemeral });
  }
};
