const config = require("../config/config");
const userService = require("../services/userService");
const xpService = require("../services/xpService");
const { saveOpsMessage } = require("../services/opsService");

module.exports = {
  name: "messageCreate",

  async execute(message) {
    if (message.author.bot) return;

if (!config.opsChannelIds.includes(message.channel.id)) return;

await userService.getOrCreateUser(message.author);

const xpResult = await xpService.addXP(message.author.id, 5);

if (xpResult && xpResult.leveledUp) {
  await message.reply(
    `🎉 ${message.author.username} reached Level ${xpResult.user.level}!`
  );
}

await saveOpsMessage({
  msgId: message.id,
  message: message.content
});

    if (!message.content.startsWith(config.prefix)) return;

    const args = message.content.slice(config.prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = message.client.commands.get(commandName);

    if (!command) return;

    try {
  await command.execute(message, args);

  setTimeout(() => {
    message.delete().catch(() => {});
  }, 90000);

} catch (error) {
  console.error(error);

  const reply = await message.reply(
    "There was an error executing that command."
  );

  setTimeout(() => {
    reply.delete().catch(() => {});
    message.delete().catch(() => {});
  }, 90000);
}
  },
};
