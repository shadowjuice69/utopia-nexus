const logger = require("../services/logger");
const config = require("../config/config");
const userService = require("../services/userService");
const xpService = require("../services/xpService");
const supabaseService = require("../services/supabase");
const { processMessage } = require("../intel7");
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

    // Dedicated Intel 7 channels are isolated from all legacy parsers.
    if (channelType) {
      if (!message.author.bot) {
        await userService.getOrCreateUser(message.author);
        const xpResult = await xpService.addXP(message.author.id, config.xp.amountPerMessage);
        if (xpResult && xpResult.leveledUp) await message.reply(`🎉 ${message.author.username} reached Level ${xpResult.user.level}!`);
      }

      const supabase = supabaseService.getClient();
      if (!supabase) {
        logger.error(`[INTEL7] Supabase unavailable; message ${message.id} not stored`);
        return;
      }

      try {
        await processMessage({ message, channelType, supabase, logger });
      } catch (error) {
        logger.error(`[INTEL7 ${channelType.toUpperCase()}] processing error: ${error.message}`);
      }
      return;
    }

    // Legacy bot-spam / command handling remains unchanged and separate.
    if (message.author.bot && !UTOPIABOT_IDS.has(message.author.id)) return;
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
