const commandHandler = require('../handlers/commandHandler');
const modalHandler = require('../handlers/modalHandler');
const buttonHandler = require('../handlers/buttonHandler');
const investInteractionHandler = require('../handlers/investInteractionHandler');

async function handle(interaction) {
  if (interaction.isChatInputCommand()) return commandHandler(interaction);
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('invest_build_select:')) return investInteractionHandler.handleSelect(interaction);
  if (interaction.isModalSubmit() && interaction.customId.startsWith('invest_books:')) return investInteractionHandler.handleModal(interaction);
  if (interaction.isModalSubmit()) return modalHandler(interaction);
  if (interaction.isButton() && interaction.customId.startsWith('invest_build_page:')) return investInteractionHandler.handlePage(interaction);
  if (interaction.isButton()) return buttonHandler(interaction);
  return undefined;
}

module.exports = { handle };
