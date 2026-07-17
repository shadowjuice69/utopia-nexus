const config = require("../config/config");
const userService = require("../services/userService");
const xpService = require("../services/xpService");
const { saveOpsMessage, saveAttack, saveHostileOp, saveSpell } = require("../services/opsService");
const { parseOpsMessage } = require("../parsers/opsParser");
const axios = require("axios");
const { saveAgeUpdate } = require("../services/ageUpdateService");

const UTOPIABOT_IDS = new Set((process.env.UTOPIABOT_IDS || "").split(",").map(s => s.trim()).filter(Boolean));

module.exports = {
  name: "messageCreate",
  async execute(message) {

    if (message.author.bot) return;

    const isAgeUpdateChannel = message.channel.id === process.env.AGE_UPDATE_CHANNEL_ID;

    if (isAgeUpdateChannel) {
      console.log("📘 Age update channel message detected");
      console.log("📎 Attachments:", message.attachments.size);

      let updateText = message.content || "";

      if (message.attachments.size > 0) {
        const attachment = message.attachments.first();

        console.log("📄 File name:", attachment.name);

        if (attachment.name.endsWith(".txt")) {
          const response = await axios.get(attachment.url);
          updateText += "\n" + response.data;
        }
      }

      console.log("📏 Age Update Text Length:", updateText.length);

      const savedUpdate = await saveAgeUpdate(
        updateText,
        message.author.id,
        attachment.name
      );

      if (savedUpdate) {
        await message.reply(
          `📘 Age update saved for review #${savedUpdate.id}`
        );
      } else {
        await message.reply(
          `⚠️ Age update save failed`
        );
      }

      return;
    }

    const isOpsChannel = config.opsChannelIds.includes(message.channel.id);
    const isAttackChannel = config.attackChannelIds.includes(message.channel.id);

    if (!isOpsChannel && !isAttackChannel) return;

    if (message.author.bot) {
      if (!UTOPIABOT_IDS.has(message.author.id)) return;
    } else {
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
    }

    const parsed = parseOpsMessage({
      id: message.id,
      content: message.content,
      timestamp: message.createdAt.toISOString()
    });

    console.log(
      `[OPS PARSED] ${parsed.ops.length} ops, ${parsed.atks.length} attacks, ${parsed.spells.length} spells`
    );

    for (const attack of parsed.atks) {
      await saveAttack(attack);
    }

    for (const op of parsed.ops) {
      await saveHostileOp(op);
    }

    for (const spell of parsed.spells) {
      await saveSpell(spell);
    }

    await saveOpsMessage({
      msgId: message.id,
      message: message.content
    });

    if (message.author.bot) return;
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
  }
};
