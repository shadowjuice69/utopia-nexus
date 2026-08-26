const logger = require('../services/logger');
const supabaseService = require('../services/supabase');

const CHANNELS = {
  ops: 'OPS_CHANNEL_IDS',
  offensive_spells: 'OFFENSIVE_SPELL_CHANNEL_IDS',
  self_spells: 'SELF_OPS_CHANNEL_IDS',
  dragon: 'DRAGON_CHANNEL_IDS',
  ritual: 'RITUAL_CHANNEL_IDS',
  aid: 'AID_CHANNEL_IDS',
  attacks: 'ATTACK_CHANNEL_IDS',
};

const KD_CODE = process.env.INTEL7_KD || '6:9';

function configuredChannels() {
  const result = new Map();
  for (const [type, env] of Object.entries(CHANNELS)) {
    for (const id of String(process.env[env] || '').split(',').map(v => v.trim()).filter(Boolean)) {
      result.set(id, type);
    }
  }
  return result;
}

function provinceMatches(text) {
  return [...String(text || '').matchAll(/\((\d+:\d+)\)/g)].map(match => match[1]);
}

function numberAfter(text, pattern) {
  const match = String(text || '').match(pattern);
  return match ? Number(match[1].replace(/,/g, '')) : null;
}

function parseMessage(type, content) {
  const text = String(content || '').trim();
  const provinces = provinceMatches(text);
  const data = { format: 'intel7', channel_type: type, province_refs: provinces };

  if (type === 'attacks') {
    const attack = text.match(/^(.*?)\s+\((\d+:\d+)\)\s+attacked\s+and\s+looted\s+([\d,]+)\s+(.+?)\s+from\s+(.*?)\s+\((\d+:\d+)\)/i);
    if (attack) {
      data.attacker_name = attack[1].trim(); data.attacker_kd = attack[2]; data.loot_amount = Number(attack[3].replace(/,/g, '')); data.loot_resource = attack[4].trim(); data.target_name = attack[5].trim(); data.target_kd = attack[6]; data.event = 'attack';
    } else { data.event = 'attack'; data.amount = numberAfter(text, /(?:looted|captured|gained)\s+([\d,]+)/i); }
  } else if (type === 'ops') {
    data.event = 'thievery';
    const op = text.match(/^(.*?)\s+\((\d+:\d+)\).*?(?:on|from|against)\s+(.*?)\s+\((\d+:\d+)\)/i);
    if (op) { data.attacker_name = op[1].trim(); data.attacker_kd = op[2]; data.target_name = op[3].trim(); data.target_kd = op[4]; }
    data.thieves_sent = numberAfter(text, /(?:sent|used)\s+([\d,]+)\s+thieves/i);
  } else if (type === 'offensive_spells' || type === 'self_spells') {
    data.event = 'spell';
    const spell = text.match(/(?:cast|casts|used)\s+(?:the\s+)?(.+?)(?:\.|\s+on\s+)/i);
    data.spell = spell ? spell[1].trim() : null;
    data.success = !/failed|fail|resisted/i.test(text);
  } else if (type === 'dragon') data.event = 'dragon';
  else if (type === 'ritual') data.event = 'ritual';
  else if (type === 'aid') { data.event = 'aid'; data.amount = numberAfter(text, /([\d,]+)\s+(?:gold|food|runes|soldiers|units)/i); }
  return data;
}

async function save(message, type, parsed) {
  const client = supabaseService.getClient();
  if (!client) { logger.error('[INTEL7] Supabase is not configured'); return false; }
  const messageRow = { discord_message_id: message.id, channel_id: message.channelId, channel_type: type, guild_id: message.guildId || null, author_id: message.author?.id || message.author?.username || null, author_name: message.author?.tag || message.author?.username || null, content: message.content || '', message_created_at: message.createdAt ? new Date(message.createdAt).toISOString() : null, kd_code: KD_CODE, parsed: true };
  const { error: messageError } = await client.from('intel7_messages').upsert(messageRow, { onConflict: 'discord_message_id' });
  if (messageError) { logger.error(`[INTEL7] message save failed: ${messageError.message}`); return false; }
  const eventRow = { discord_message_id: message.id, channel_type: type, event_type: parsed.event || type, kd_code: KD_CODE, province_name: parsed.attacker_name || null, province_kd: parsed.attacker_kd || null, target_name: parsed.target_name || null, target_kd: parsed.target_kd || null, action: parsed.spell || parsed.event || type, quantity: parsed.loot_amount ?? parsed.amount ?? parsed.thieves_sent ?? null, resource: parsed.loot_resource || null, raw_content: message.content || '', data: parsed };
  const { error: eventError } = await client.from('intel7_events').upsert(eventRow, { onConflict: 'discord_message_id' });
  if (eventError) { logger.error(`[INTEL7] event save failed: ${eventError.message}`); return false; }
  logger.info(`[INTEL7 SAVED] ${type} message=${message.id}`); return true;
}

async function verifyChannels(client, channels) {
  for (const [id, type] of channels) {
    try {
      const channel = await client.channels.fetch(id);
      const guild = channel?.guild;
      logger.info(`[INTEL7 CHANNEL CHECK] ${type} ${id} -> FOUND guild=${guild?.id || 'none'} name=${channel?.name || 'unknown'} type=${channel?.type ?? 'unknown'}`);
    } catch (error) {
      logger.error(`[INTEL7 CHANNEL CHECK] ${type} ${id} -> NOT FOUND ${error.code || ''} ${error.message}`);
    }
  }
}

function initialize(client) {
  const channels = configuredChannels();
  logger.info(`[INTEL7] clean listener starting; channels=${JSON.stringify(Object.fromEntries(channels))}; kd=${KD_CODE}`);
  client.once('clientReady', () => verifyChannels(client, channels).catch(error => logger.error(`[INTEL7 CHANNEL CHECK ERROR] ${error.stack || error.message}`)));
  client.on('messageCreate', async message => {
    logger.info(`[INTEL7 EVENT] messageCreate channel=${message.channelId} guild=${message.guildId || 'DM'} author=${message.author?.tag || message.author?.username || 'unknown'}`);
    const type = channels.get(message.channelId);
    if (!type) return;
    logger.info(`[INTEL7 RECEIVED] type=${type} channel=${message.channelId} message=${message.id}`);
    try {
      const parsed = parseMessage(type, message.content);
      logger.info(`[INTEL7 PARSED] type=${type} event=${parsed.event || type} message=${message.id}`);
      await save(message, type, parsed);
    } catch (error) { logger.error(`[INTEL7 ERROR] type=${type} message=${message.id} ${error.stack || error.message}`); }
  });
  return { channels, kd: KD_CODE };
}

module.exports = { initialize, configuredChannels, parseMessage };