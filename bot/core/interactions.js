const musicHandler = require('../handlers/commands/musicHandler');
const playlistHandler = require('../handlers/commands/playlistHandler');

async function handle(interaction) {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === 'music') return musicHandler(interaction);
  if (interaction.commandName === 'playlist') return playlistHandler(interaction);
  return interaction.reply({ content: '❌ This command is not available in the rebuilt Nexus.', ephemeral: true });
}

module.exports = { handle };
