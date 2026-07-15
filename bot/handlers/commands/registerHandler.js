const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require("discord.js");

module.exports = async function registerHandler(interaction) {

  const modal = new ModalBuilder()
    .setCustomId("utopia_register_1")
    .setTitle("Register — Step 1 of 2");

  const province = new TextInputBuilder()
    .setCustomId("province")
    .setLabel("Province Name")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const coordinates = new TextInputBuilder()
    .setCustomId("coordinates")
    .setLabel("Coordinates (e.g. 4:9)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const race = new TextInputBuilder()
    .setCustomId("race")
    .setLabel("Race (e.g. Orc, Elf, Human)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const personality = new TextInputBuilder()
    .setCustomId("personality")
    .setLabel("Personality (e.g. General, Heretic)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const playRole = new TextInputBuilder()
    .setCustomId("play_role")
    .setLabel("Role: Attacker / Mage / Hybrid / Thief")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(province),
    new ActionRowBuilder().addComponents(coordinates),
    new ActionRowBuilder().addComponents(race),
    new ActionRowBuilder().addComponents(personality),
    new ActionRowBuilder().addComponents(playRole)
  );

  return interaction.showModal(modal);
};
