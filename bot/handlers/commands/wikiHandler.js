module.exports = async function wikiHandler(interaction) {
  await interaction.reply({
    content:
      "📖 **Utopia Nexus Wiki**\nhttps://shadowjuice69.github.io/utopia-war-room/utopia-wiki.html",
    ephemeral: true,
  });
};
