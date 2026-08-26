const logger = require("../services/logger");
const config = require("../config/config");
const userService = require("../services/userService");
const xpService = require("../services/xpService");
const { saveOpsMessage, saveAttack, saveHostileOp, saveSpell, saveChannelEvent } = require("../services/opsService");
const { parseOpsMessage } = require("../parsers/opsParser");
const { parseChannelMessage } = require("../parsers/intelChannelParser");
const axios = require("axios");
const pdfParse = require("pdf-parse");
const { saveAgeUpdate } = require("../services/ageUpdateService");
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const UTOPIABOT_IDS = new Set((process.env.UTOPIABOT_IDS || "").split(",").map(s => s.trim()).filter(Boolean));

module.exports = {
  name: "messageCreate",
  async execute(message) {
    const isAgeUpdateChannel = message.channel.id === process.env.AGE_UPDATE_CHANNEL_ID;

    if (isAgeUpdateChannel) {
      let updateText = message.content || "";
      let ageUpdateFilename = null;
      if (message.attachments.size > 0) {
        const attachment = message.attachments.first();
        ageUpdateFilename = attachment.name;
        try {
          const response = await axios.get(attachment.url, { responseType: "arraybuffer" });
          const buffer = Buffer.from(response.data);
          if (buffer.slice(0, 4).toString("ascii") === "%PDF") {
            const parsed = await pdfParse(buffer);
            updateText += "\n" + parsed.text;
          } else updateText += "\n" + buffer.toString("utf8");
        } catch (err) {
          logger.error(`[AGE UPDATE] File download/parse error: ${err.message}`);
          return message.reply("⚠️ Failed to read the attachment. Make sure it's a valid PDF or TXT file.");
        }
      }
      if (!updateText.trim()) return;
      const savedUpdate = await saveAgeUpdate(updateText, message.author.id, ageUpdateFilename);
      if (!savedUpdate || savedUpdate.error) return;
      if (savedUpdate.error === "no_age_number") return message.reply("⚠️ Could not detect age number from filename. Name your file like `Age_116_changes.txt`.");
      if (savedUpdate.error === "duplicate") return message.reply(`⚠️ Age update already exists and is **${savedUpdate.status}**. No duplicate created.`);
      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`age_apply_${savedUpdate.id}`).setLabel("✅ Apply").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`age_revoke_${savedUpdate.id}`).setLabel("❌ Revoke").setStyle(ButtonStyle.Danger)
      );
      await message.reply({ content: [`📘 **Age ${savedUpdate.age_number} Update — Pending Review**`, ``, savedUpdate.parsedSummary || "Parsing summary unavailable.", ``, `Click **Apply** to write all rules to the database.`].join("\n"), components: [buttons] });
      return;
    }

    const channelId = message.channel.id;
    const channelType =
      config.opsChannelIds.includes(channelId) ? "ops" :
      config.offensiveSpellChannelIds.includes(channelId) ? "offensive_spells" :
      config.selfOpsChannelIds.includes(channelId) ? "self_spells" :
      config.dragonChannelIds.includes(channelId) ? "dragon" :
      config.ritualChannelIds.includes(channelId) ? "ritual" :
      config.aidChannelIds.includes(channelId) ? "aid" :
      config.attackChannelIds.includes(channelId) ? "attacks" : null;

    const isBotSpamChannel = channelId === config.botSpamChannelId;
    if (!channelType && !isBotSpamChannel) return;

    // Intel channels are dedicated ingestion feeds. Accept bot-authored messages
    // in these channels without requiring a hard-coded UTOPIABOT_IDS value.
    // This prevents the new seven-channel feed from being silently discarded
    // when the source bot changes or its ID is not configured in Render.
    if (message.author.bot && !channelType && !UTOPIABOT_IDS.has(message.author.id)) return;

    if (!message.author.bot) {
      await userService.getOrCreateUser(message.author);
      const xpResult = await xpService.addXP(message.author.id, config.xp.amountPerMessage);
      if (xpResult && xpResult.leveledUp) await message.reply(`🎉 ${message.author.username} reached Level ${xpResult.user.level}!`);
    }

    if (channelType) {
      logger.info(`[INTEL ${channelType.toUpperCase()}] received message ${message.id}`);
      const intelEvents = parseChannelMessage({ id: message.id, content: message.content, timestamp: message.createdAt.toISOString(), channelType });
      if (intelEvents.length) {
        logger.info(`[INTEL ${channelType.toUpperCase()}] parsed ${intelEvents.length} event(s)`);
        for (const event of intelEvents) {
          if (event.type === "attack") await saveAttack(event);
          else if (event.type === "offensive_spell" || event.type === "self_spell") await saveSpell(event);
          else await saveChannelEvent(event);
        }
      } else {
        logger.warn(`[INTEL ${channelType.toUpperCase()}] no event parsed for message ${message.id}`);
      }

      // Preserve the established parser for the original thievery feed and as a fallback for legacy attack/self-spell formatting.
      if (channelType === "ops" || !intelEvents.length && ["attacks", "self_spells"].includes(channelType)) {
        const parsed = parseOpsMessage({ id: message.id, content: message.content, timestamp: message.createdAt.toISOString() });
        for (const attack of parsed.atks) await saveAttack(attack);
        for (const attack of parsed.incomingAtks || []) await saveAttack({ ...attack, attack_type: "incoming" });
        for (const op of parsed.ops) await saveHostileOp(op);
        for (const spell of parsed.spells) await saveSpell(spell);
        for (const spell of parsed.selfSpells || []) await saveSpell({ ...spell, op: spell.spell });
      }
      await saveOpsMessage({ msgId: message.id, message: message.content });
    }

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
