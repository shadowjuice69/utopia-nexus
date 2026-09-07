const commandHandler = require('../handlers/commandHandler');
const modalHandler = require('../handlers/modalHandler');
const buttonHandler = require('../handlers/buttonHandler');

async function handle(interaction) {
  // Slash commands
  if (interaction.isChatInputCommand()) {
    return commandHandler(interaction);
  }

  // Modal submissions (registration, intel paste, etc.)
  if (interaction.isModalSubmit()) {
    return modalHandler(interaction);
  }

  // Buttons (registration continuation, age approvals, etc.)
  if (interaction.isButton()) {
    return buttonHandler(interaction);
  }

  return undefined;
}

module.exports = { handle };
