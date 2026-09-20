const { MessageFlags } = require('discord.js');
const spartanAccess = require('../services/spartanAccessService');

module.exports = async function spartanRegistrationModalHandler(interaction) {
  if (interaction.customId !== 'spartan_register_1') return false;
  const userId = interaction.user.id;
  const data = {
    name: interaction.fields.getTextInputValue('province').trim(),
    coordinates: interaction.fields.getTextInputValue('coordinates').trim(),
    race: interaction.fields.getTextInputValue('race').trim(),
    personality: interaction.fields.getTextInputValue('personality').trim(),
    play_role: interaction.fields.getTextInputValue('play_role').trim()
  };
  if (!data.name || !data.coordinates) return interaction.reply({ content: '❌ Province name and kingdom coordinates are required.', flags: MessageFlags.Ephemeral });
  try {
    // Store the actual Spartan screen/province name, not the Discord username.
    const access = await spartanAccess.register({
      userId,
      username: data.name,
      metadata: { source: 'discord-bot-registration', discord_username: interaction.user.username, province: data.name, coordinates: data.coordinates, race: data.race || null, personality: data.personality || null, play_role: data.play_role || null }
    });
    return interaction.reply({
      content: `🛡️ **Spartan registration complete.**\n\n🏰 Province: **${data.name}**\n📍 Kingdom: **${data.coordinates}**\n👤 Discord: <@${userId}>\n\nYour Spartan screen name is now permanently linked to your Discord identity. Use **${data.name}** when registering on the Spartan website.`,
      flags: MessageFlags.Ephemeral
    });
  } catch (error) {
    console.error('[SPARTAN REGISTRATION ERROR]', error);
    return interaction.reply({ content: `❌ Spartan registration failed: ${error.message}`, flags: MessageFlags.Ephemeral });
  }
};
