const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } = require('discord.js');

module.exports = async function spartanRegisterHandler(interaction) {
  const modal = new ModalBuilder().setCustomId('spartan_register_1').setTitle('Spartan Registration');
  const province = new TextInputBuilder().setCustomId('province').setLabel('Province Name').setStyle(TextInputStyle.Short).setRequired(true);
  const coordinates = new TextInputBuilder().setCustomId('coordinates').setLabel('Coordinates (e.g. 4:9)').setStyle(TextInputStyle.Short).setRequired(true);
  const race = new TextInputBuilder().setCustomId('race').setLabel('Race').setStyle(TextInputStyle.Short).setRequired(true);
  const personality = new TextInputBuilder().setCustomId('personality').setLabel('Personality').setStyle(TextInputStyle.Short).setRequired(true);
  const role = new TextInputBuilder().setCustomId('play_role').setLabel('Role: Attacker / Mage / Hybrid / Thief').setStyle(TextInputStyle.Short).setRequired(true);
  modal.addComponents(
    new ActionRowBuilder().addComponents(province),
    new ActionRowBuilder().addComponents(coordinates),
    new ActionRowBuilder().addComponents(race),
    new ActionRowBuilder().addComponents(personality),
    new ActionRowBuilder().addComponents(role)
  );
  return interaction.showModal(modal);
};
