const { MessageFlags } = require('discord.js');
const spartanAccess = require('../services/spartanAccessService');

const EPHEMERAL = MessageFlags.Ephemeral;

function getField(interaction, id, required = false) {
  try {
    return interaction.fields.getTextInputValue(id).trim();
  } catch (error) {
    if (required) throw new Error(`Missing required registration field: ${id}`);
    return '';
  }
}

module.exports = async function spartanRegistrationModalHandler(interaction) {
  if (interaction.customId !== 'spartan_register_1') return false;

  const userId = interaction.user?.id;
  if (!userId) throw new Error('Discord user identity is unavailable.');

  // Acknowledge the Discord modal immediately. Database work can take longer
  // than Discord's 3-second interaction deadline.
  await interaction.deferReply({ flags: EPHEMERAL });

  try {
    const data = {
      name: getField(interaction, 'province', true),
      coordinates: getField(interaction, 'coordinates', true),
      race: getField(interaction, 'race'),
      personality: getField(interaction, 'personality'),
      play_role: getField(interaction, 'play_role')
    };

    if (!data.name || !data.coordinates) {
      return interaction.editReply({
        content: '❌ Province name and kingdom coordinates are required.'
      });
    }

    const access = await spartanAccess.register({
      userId,
      username: data.name,
      metadata: {
        source: 'discord-bot-registration',
        discord_username: interaction.user.username,
        province: data.name,
        coordinates: data.coordinates,
        race: data.race || null,
        personality: data.personality || null,
        play_role: data.play_role || null
      }
    });

    return interaction.editReply({
      content:
        `🛡️ **Spartan registration complete.**

🏰 Province: **${data.name}**
📍 Kingdom: **${data.coordinates}**
👤 Discord: <@${userId}>
🔗 Spartan identity: **${access.username || data.name}**

Your Spartan screen name is now permanently linked to your Discord identity. Use **${data.name}** when registering on the Spartan website.`
    });
  } catch (error) {
    console.error('[SPARTAN REGISTRATION ERROR]', error);
    return interaction.editReply({
      content: `❌ Spartan registration failed: ${error.message || 'Unknown error'}`
    });
  }
};
