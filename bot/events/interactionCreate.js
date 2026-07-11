const modalHandler = require("../handlers/modalHandler");
const commandHandler = require("../handlers/commandHandler");
const buttonHandler = require("../handlers/buttonHandler");

module.exports = {
  name: "interactionCreate",

  async execute(interaction) {
    console.log(
      "Interaction received:",
      interaction.type,
      interaction.commandName
    );

    if (interaction.isModalSubmit()) {
      return modalHandler(interaction);
    }

    if (interaction.isButton()) {
      return buttonHandler(interaction);
    }

    if (interaction.isChatInputCommand()) {
      return commandHandler(interaction);
    }
  },
};
