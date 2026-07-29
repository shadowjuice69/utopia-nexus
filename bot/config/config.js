module.exports = {
  prefix: "!",
  botName: "Utopia Nexus",

  opsChannelIds: process.env.OPS_CHANNEL_IDS
    ? process.env.OPS_CHANNEL_IDS.split(",")
    : [],

  attackChannelIds: process.env.ATTACK_CHANNEL_IDS
    ? process.env.ATTACK_CHANNEL_IDS.split(",")
    : [],

  selfOpsChannelIds: process.env.SELF_OPS_CHANNEL_IDS
    ? process.env.SELF_OPS_CHANNEL_IDS.split(",")
    : [],

  botSpamChannelId: process.env.BOT_SPAM_CHANNEL_ID || null,

  xp: {
    amountPerMessage: 5,
    cooldown: 60000,
    xpPerLevel: 200,
  },
};
