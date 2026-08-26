const config = require("../config/config");
const logger = require("../services/logger");
const supabase = require("../services/supabase").getClient();
const { processMessage } = require("../intel7");

const CHANNELS = new Map();
for (const [type, ids] of [
  ["ops", config.opsChannelIds],
  ["offensive_spells", config.offensiveSpellChannelIds],
  ["self_spells", config.selfOpsChannelIds],
  ["dragon", config.dragonChannelIds],
  ["ritual", config.ritualChannelIds],
  ["aid", config.aidChannelIds],
  ["attacks", config.attackChannelIds],
]) {
  for (const id of ids || []) CHANNELS.set(String(id), type);
}

module.exports = {
  name: "messageCreate",
  async execute(message) {
    const channelType = CHANNELS.get(String(message.channel?.id));
    if (!channelType) return;

    if (!supabase) {
      logger.error("[INTEL7] Supabase client unavailable");
      return;
    }

    try {
      await processMessage({ message, channelType, supabase, logger });
    } catch (error) {
      logger.error(`[INTEL7 ${channelType.toUpperCase()} ERROR] ${error.stack || error.message}`);
    }
  },
};
