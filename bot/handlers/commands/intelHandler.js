const supabaseService = require("../../services/supabase");
const { parseThrone, parseMilitary, summarizeIntel } = require("../../parsers/throneParser");
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require("discord.js");

module.exports = async function intelHandler(interaction) {
  // Show modal for pasting throne data
  const modal = new ModalBuilder()
    .setCustomId("intel_paste")
    .setTitle("Paste Province Intel");

  const pasteInput = new TextInputBuilder()
    .setCustomId("intel_text")
    .setLabel("Paste throne/military page here")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setPlaceholder("Copy from Utopia throne or military page and paste here...");

  modal.addComponents(new ActionRowBuilder().addComponents(pasteInput));

  return interaction.showModal(modal);
};
