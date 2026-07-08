const config = require("../config/config");
const userService = require("../services/userService");
const xpService = require("../services/xpService");

module.exports = {
  name: "messageCreate",

  async execute(message) {
    if (message.author.bot) return;

await userService.getOrCreateUser(message.author);

const xpResult = await xpService.addXP(message.author.id, 5);

if (xpResult && xpResult.leveledUp) {
  await message.reply(
    `🎉 ${message.author.username} reached Level ${xpResult.user.level}!`
  );
}

    if (!message.content.startsWith(config.prefix)) return;

    const args = message.content.slice(config.prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = message.client.commands.get(commandName);

    if (!command) return;

    try {
      await command.execute(message, args);
    } catch (error) {
      console.error(error);
      await message.reply("There was an error executing that command.");
    }
  },
};
