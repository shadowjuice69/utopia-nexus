const interactions = require("../core/interactions");

module.exports = {
  name: "interactionCreate",

  async execute(interaction) {
    console.log(
      "Interaction received:",
      interaction.type,
      interaction.commandName,
      interaction.isModalSubmit() ? interaction.customId : ""
    );

    try {
      return await interactions.handle(interaction);
    } catch (error) {
      console.error("[INTERACTION HANDLER ERROR]", error);
      if (!interaction.replied && !interaction.deferred) {
        try {
          return await interaction.reply({
            content: "❌ The bot encountered an error processing that interaction. Please try again.",
            ephemeral: true
          });
        } catch (replyError) {
          console.error("[INTERACTION FALLBACK REPLY ERROR]", replyError);
        }
      }
    }
  },
};
