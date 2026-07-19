const supabaseService = require("../../services/supabase");
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");

module.exports = async function broadcastHandler(interaction) {
  const modal = new ModalBuilder()
    .setCustomId("broadcast_modal")
    .setTitle("📢 Kingdom Broadcast");

  const messageInput = new TextInputBuilder()
    .setCustomId("broadcast_message")
    .setLabel("Message to send to all members")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setPlaceholder("e.g. Wave starting tick 5! All attackers online NOW.");

  const titleInput = new TextInputBuilder()
    .setCustomId("broadcast_title")
    .setLabel("Title (optional)")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setPlaceholder("e.g. WAR CALL");

  modal.addComponents(
    new ActionRowBuilder().addComponents(titleInput),
    new ActionRowBuilder().addComponents(messageInput)
  );

  return interaction.showModal(modal);
};
