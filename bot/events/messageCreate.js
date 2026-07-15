const config = require("../config/config");
const userService = require("../services/userService");
const xpService = require("../services/xpService");
const { saveOpsMessage, saveAttack, saveHostileOp } = require("../services/opsService");
const { parseOpsMessage } = require("../parsers/opsParser");

module.exports = {
  name: "messageCreate",

  async execute(message) {
    if (message.author.bot) return;

    const isOpsChannel = config.opsChannelIds.includes(message.channel.id);
    const isAttackChannel = config.attackChannelIds.includes(message.channel.id);

    if (!isOpsChannel && !isAttackChannel) return;

    await userService.getOrCreateUser(message.author);

    const xpResult = await xpService.addXP(
      message.author.id,
      config.xp.amountPerMessage
    );

    if (xpResult && xpResult.leveledUp) {
      await message.reply(
        `🎉 ${message.author.username} reached Level ${xpResult.user.level}!`
      );
    }

    await saveOpsMessage({
      msgId: message.id,
      message: message.content
    });

    const parsed = parseOpsMessage({
      id: message.id,
      content: message.content,
      timestamp: new Date().toISOString()
    });

    console.log(
      "[OPS PARSED]",
      parsed.ops.length,
      "ops,",
      parsed.atks.length,
      "attacks"
    );

    for (const attack of parsed.atks) {
      await saveAttack(attack);
    }

    for (const op of parsed.ops) {
      await saveHostileOp(op);
    }

    if (!message.content.startsWith(config.prefix)) return;

    const args = message.content
      .slice(config.prefix.length)
      .trim()
      .split(/ +/);

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
