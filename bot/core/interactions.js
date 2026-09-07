const commandHandler = require('../handlers/commandHandler');

async function handle(interaction) {
  if (!interaction.isChatInputCommand()) return;
  return commandHandler(interaction);
}

module.exports = { handle };
