const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");

module.exports = async function intelHandler(interaction) {
  const type = interaction.options.getString("type") || "throne";
  console.log("[INTEL TYPE]", type, interaction.options.getString("type"));

  const modal = new ModalBuilder()
    .setCustomId(`intel_paste_${type}`)
    .setTitle(type === "news" ? "Paste Province News Log" : "Paste Province Intel");

  const pasteInput = new TextInputBuilder()
    .setCustomId("intel_text")
    .setLabel(type === "news" ? "Paste your province news/logs here" : "Paste throne/military/science/buildings page")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setPlaceholder(type === "news" 
      ? "Copy from Province Logs page and paste here..."
      : "Copy from Utopia/Genesis page and paste here...");

  modal.addComponents(new ActionRowBuilder().addComponents(pasteInput));
  return interaction.showModal(modal);
};
