const logger = require('./logger');

const CHANNELS = {
  ops: 'OPS_CHANNEL_IDS',
  offensive_spells: 'OFFENSIVE_SPELL_CHANNEL_IDS',
  self_spells: 'SELF_OPS_CHANNEL_IDS',
  dragon: 'DRAGON_CHANNEL_IDS',
  ritual: 'RITUAL_CHANNEL_IDS',
  aid: 'AID_CHANNEL_IDS',
  attacks: 'ATTACK_CHANNEL_IDS'
};

function channelType(id) {
  for (const [type, env] of Object.entries(CHANNELS)) {
    const values = String(process.env[env] || '').split(',').map(v => v.trim()).filter(Boolean);
    if (values.includes(id)) return type;
  }
  return null;
}

function initialize(client) {
  client.on('messageCreate', async message => {
    const type = channelType(message.channelId);
    if (!type) return;
    logger.info(`[INTEL7 RECEIVED] channel=${message.channelId} type=${type} message=${message.id}`);
  });
  logger.info('[INTEL7] Standalone Discord listener initialized');
}

module.exports = { initialize, channelType };
