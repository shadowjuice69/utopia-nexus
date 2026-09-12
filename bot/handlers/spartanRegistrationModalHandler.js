const { MessageFlags } = require('discord.js');
const supabaseService = require('../services/supabase');
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

  try {
    const access = await spartanAccess.register({
      userId,
      username: interaction.user.username,
      metadata: { source: 'discord-bot-registration', ...data }
    });

    const sb = supabaseService.getClient();
    if (sb) {
      const { data: existing } = await sb.from('provinces').select('id').ilike('name', data.name).is('user_id', null).limit(1);
      if (existing?.[0]) {
        await sb.from('provinces').update({
          user_id: userId, discord_id: userId, name: data.name, coordinates: data.coordinates,
          race: data.race, personality: data.personality, play_role: data.play_role,
          updated_at: new Date().toISOString()
        }).eq('id', existing[0].id);
      } else {
        await sb.from('provinces').upsert({
          user_id: userId, discord_id: userId, name: data.name, coordinates: data.coordinates,
          race: data.race, personality: data.personality, play_role: data.play_role,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
      }
    }

    return interaction.reply({
      content: `🛡️ **Spartan access granted.**\n\n🏰 ${data.name}\n📍 ${data.coordinates}\n⚔️ ${data.race}\n🧠 ${data.personality}\n🎯 ${data.play_role}\n\nYour Discord identity is now the control point for Spartan access.`,
      flags: MessageFlags.Ephemeral
    });
  } catch (error) {
    console.error('[SPARTAN REGISTRATION ERROR]', error);
    return interaction.reply({ content: `❌ Spartan registration failed: ${error.message}`, flags: MessageFlags.Ephemeral });
  }
};
