require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { musicCommand, playlistCommand } = require('../core/commands');

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
const guildIds = [...new Set([process.env.GUILD_ID, '1534817549374455848'].filter(Boolean))];

(async () => {
  for (const guildId of guildIds) {
    const route = Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId);
    await rest.put(route, { body: [musicCommand, playlistCommand] });
    console.log(`✅ Clean commands registered for guild ${guildId}: music, playlist`);
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
