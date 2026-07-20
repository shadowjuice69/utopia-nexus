const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");

module.exports = async function intelHandler(interaction) {
  const modal = new ModalBuilder()
    .setCustomId("intel_paste")
    .setTitle("Paste Province Intel");

  const provinceInput = new TextInputBuilder()
    .setCustomId("intel_province")
    .setLabel("Province name (if not in paste)")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setPlaceholder("e.g. Freaking A — leave blank if in the paste");

  const pasteInput = new TextInputBuilder()
    .setCustomId("intel_text")
    .setLabel("Paste throne/military/science page here")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setPlaceholder("Copy from Utopia/Genesis page and paste here...");

  modal.addComponents(
    new ActionRowBuilder().addComponents(provinceInput),
    new ActionRowBuilder().addComponents(pasteInput)
  );

  return interaction.showModal(modal);
};
