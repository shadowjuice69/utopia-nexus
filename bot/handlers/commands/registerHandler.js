const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require("discord.js");

module.exports = async function registerHandler(interaction) {

  const modal = new ModalBuilder()
    .setCustomId("utopia_register")
    .setTitle("Province Registration");

  const province = new TextInputBuilder()
    .setCustomId("province")
    .setLabel("Province Name")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const coordinates = new TextInputBuilder()
    .setCustomId("coordinates")
    .setLabel("Coordinates")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(province),
    new ActionRowBuilder().addComponents(coordinates)
  );

  return interaction.showModal(modal);
};
