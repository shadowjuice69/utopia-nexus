const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = async function spartanRegisterHandler(interaction) {
  const modal = new ModalBuilder().setCustomId('spartan_register_1').setTitle('Spartan Registration');
  const fields = [
    ['province', 'Spartan screen / province name', 'Enter the exact province name you use on Spartan', true, 100],
    ['coordinates', 'Kingdom coordinates (e.g. 6:9)', '6:9', true, 20],
    ['race', 'Race', 'Optional', false, 50],
    ['personality', 'Personality', 'Optional', false, 50],
    ['play_role', 'Spartan role', 'Optional', false, 100]
  ];
  modal.addComponents(...fields.map(([id, label, placeholder, required, maxLength]) =>
    new ActionRowBuilder().addComponents(new TextInputBuilder()
      .setCustomId(id).setLabel(label).setStyle(TextInputStyle.Short)
      .setPlaceholder(placeholder).setRequired(required).setMaxLength(maxLength))
  ));
  return interaction.showModal(modal);
};
