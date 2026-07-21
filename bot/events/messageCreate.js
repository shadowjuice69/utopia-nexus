const logger = require("../services/logger");
const config = require("../config/config");
const userService = require("../services/userService");
const xpService = require("../services/xpService");
const { saveOpsMessage, saveAttack, saveHostileOp, saveSpell } = require("../services/opsService");
const { parseOpsMessage } = require("../parsers/opsParser");
const axios = require("axios");
const pdfParse = require("pdf-parse/lib/pdf-parse.js");
const { saveAgeUpdate } = require("../services/ageUpdateService");
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const UTOPIABOT_IDS = new Set((process.env.UTOPIABOT_IDS || "").split(",").map(s => s.trim()).filter(Boolean));

module.exports = {
  name: "messageCreate",
  async execute(message) {
    console.log("[HANDLER INSTANCE]", process.pid, message.id);
    console.log("[MESSAGE HANDLER HIT]", message.id);

    if (message.author.bot) return;

    const isAgeUpdateChannel = message.channel.id === process.env.AGE_UPDATE_CHANNEL_ID;

    if (isAgeUpdateChannel) {
      console.log("📘 Age update channel message detected");
      let updateText = message.content || "";
      let ageUpdateFilename = null;

      if (message.attachments.size > 0) {
        const attachment = message.attachments.first();
        ageUpdateFilename = attachment.name;
        console.log("📎 Attachments:", message.attachments.size);
        console.log("📄 File name:", attachment.name);

        try {
          const response = await axios.get(attachment.url, { responseType: "arraybuffer" });
          const buffer = Buffer.from(response.data);

          // Detect PDF by magic bytes
          const isPdf = buffer.slice(0, 4).toString("ascii") === "%PDF";

          if (isPdf) {
            console.log("📄 Detected PDF — extracting text with pdf-parse");
            const parsed = await pdfParse(buffer);
            updateText += "\n" + parsed.text;
          } else {
            updateText += "\n" + buffer.toString("utf8");
          }

          console.log("📏 Age Update Text Length:", updateText.length);
        } catch (err) {
          logger.error(`[AGE UPDATE] File download/parse error: ${err.message}`);
          return message.reply("⚠️ Failed to read the attachment. Make sure it's a valid PDF or TXT file.");
        }
      }

      if (!updateText || updateText.trim().length === 0) {
        logger.info("[AGE UPDATE] Skipping empty file");
        return message.reply("⚠️ Age update file contained no readable text. Upload the TXT or PDF file.");
      }

      const savedUpdate = await saveAgeUpdate(updateText, message.author.id, ageUpdateFilename);

      if (!savedUpdate || savedUpdate.error) {
        logger.info(`[AGE UPDATE] Skipping approval window: ${savedUpdate?.error || "unknown error"}`);
        return;
      }

      if (savedUpdate.error === "no_age_number") {
        return message.reply("⚠️ Could not detect age number from filename. Name your file like `Age_116_changes.txt`.");
      }

      if (savedUpdate.error === "duplicate") {
        return message.reply(`⚠️ Age update already exists and is **${savedUpdate.status}**. No duplicate created.`);
      }

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`age_apply_${savedUpdate.id}`)
          .setLabel("✅ Apply")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`age_revoke_${savedUpdate.id}`)
          .setLabel("❌ Revoke")
          .setStyle(ButtonStyle.Danger)
      );

      await message.reply({
        content: [
          `📘 **Age ${savedUpdate.age_number} Update — Pending Review**`,
          ``,
          savedUpdate.parsedSummary || "Parsing summary unavailable.",
          ``,
          `Click **Apply** to write all rules to the database.`
        ].join('\n'),
        components: [buttons]
      });

      return;
    }

    const isOpsChannel = config.opsChannelIds.includes(message.channel.id);
    const isAttackChannel = config.attackChannelIds.includes(message.channel.id);

    if (!isOpsChannel && !isAttackChannel) return;

    if (message.author.bot) {
      if (!UTOPIABOT_IDS.has(message.author.id)) return;
    } else {
      await userService.getOrCreateUser(message.author);
      const xpResult = await xpService.addXP(message.author.id, config.xp.amountPerMessage);
      if (xpResult && xpResult.leveledUp) {
        await message.reply(`🎉 ${message.author.username} reached Level ${xpResult.user.level}!`);
      }
    }

    const parsed = parseOpsMessage({
      id: message.id,
      content: message.content,
      timestamp: message.createdAt.toISOString()
    });

    console.log(`[OPS PARSED] ${parsed.ops.length} ops, ${parsed.atks.length} attacks, ${parsed.spells.length} spells`);
    for (const attack of parsed.atks) await saveAttack(attack);
    for (const op of parsed.ops) await saveHostileOp(op);
    for (const spell of parsed.spells) await saveSpell(spell);

    await saveOpsMessage({ msgId: message.id, message: message.content });

    if (message.author.bot) return;
    if (!message.content.startsWith(config.prefix)) return;

    const args = message.content.slice(config.prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    const command = message.client.commands.get(commandName);
    if (!command) return;

    try {
      await command.execute(message, args);
      setTimeout(() => { message.delete().catch(() => {}); }, 90000);
    } catch (error) {
      console.error(error);
      const reply = await message.reply("There was an error executing that command.");
      setTimeout(() => { reply.delete().catch(() => {}); message.delete().catch(() => {}); }, 90000);
    }
  }
};
