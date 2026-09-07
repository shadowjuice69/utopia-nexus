const { PermissionFlagsBits } = require('discord.js');

const OWNER_ID = process.env.NEXUS_STEWARD_OWNER_ID || '653534906277822494';

module.exports = async function stewardHandler(interaction) {
  if (interaction.user.id !== OWNER_ID) {
    return interaction.reply({ content: '❌ Only the Nexus Steward owner can send Steward DMs.', ephemeral: true });
  }

  const recipient = interaction.options.getUser('user', true);
  const message = interaction.options.getString('message', true).trim();

  if (!message) {
    return interaction.reply({ content: '❌ The message cannot be empty.', ephemeral: true });
  }
  if (message.length > 2000) {
    return interaction.reply({ content: '❌ The message must be 2000 characters or fewer.', ephemeral: true });
  }

  try {
    await recipient.send(message);
    console.log(`[STEWARD DM] Sent DM to ${recipient.id} requested_by=${interaction.user.id}`);
    return interaction.reply({ content: `✅ Steward sent the DM to <@${recipient.id}>.`, ephemeral: true });
  } catch (error) {
    console.error(`[STEWARD DM ERROR] recipient=${recipient.id} ${error.stack || error.message}`);
    return interaction.reply({ content: `❌ Steward could not send the DM: ${error.message}`, ephemeral: true });
  }
};
