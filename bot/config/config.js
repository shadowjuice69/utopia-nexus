module.exports = {
  prefix: "!",
  botName: "Utopia Nexus",

  opsChannelIds: process.env.OPS_CHANNEL_IDS ? process.env.OPS_CHANNEL_IDS.split(",").map(s => s.trim()).filter(Boolean) : [],
  offensiveSpellChannelIds: process.env.OFFENSIVE_SPELL_CHANNEL_IDS ? process.env.OFFENSIVE_SPELL_CHANNEL_IDS.split(",").map(s => s.trim()).filter(Boolean) : [],
  attackChannelIds: process.env.ATTACK_CHANNEL_IDS ? process.env.ATTACK_CHANNEL_IDS.split(",").map(s => s.trim()).filter(Boolean) : [],
  selfOpsChannelIds: process.env.SELF_OPS_CHANNEL_IDS ? process.env.SELF_OPS_CHANNEL_IDS.split(",").map(s => s.trim()).filter(Boolean) : [],
  dragonChannelIds: process.env.DRAGON_CHANNEL_IDS ? process.env.DRAGON_CHANNEL_IDS.split(",").map(s => s.trim()).filter(Boolean) : [],
  ritualChannelIds: process.env.RITUAL_CHANNEL_IDS ? process.env.RITUAL_CHANNEL_IDS.split(",").map(s => s.trim()).filter(Boolean) : [],
  aidChannelIds: process.env.AID_CHANNEL_IDS ? process.env.AID_CHANNEL_IDS.split(",").map(s => s.trim()).filter(Boolean) : [],

  botSpamChannelId: process.env.BOT_SPAM_CHANNEL_ID || null,

  xp: {
    amountPerMessage: 5,
    cooldown: 60000,
    xpPerLevel: 200,
  },

  intel7KdCode: process.env.INTEL7_KD || '6:9',
};
