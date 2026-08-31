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
const POLL_MS = 5000;

function configuredChannels() {
  const result = new Map();
  for (const [type, env] of Object.entries(CHANNELS)) {
    for (const id of String(process.env[env] || '').split(',').map(v => v.trim()).filter(Boolean)) result.set(id, type);
  }
  return result;
}

function provinceMatches(text) { return [...String(text || '').matchAll(/\((\d+:\d+)\)/g)].map(m => m[1]); }
function numberAfter(text, pattern) { const m = String(text || '').match(pattern); return m ? Number(m[1].replace(/,/g, '')) : null; }
function cleanProvinceName(name) { return String(name || '').trim().replace(/^\d+\s*-\s*/, '').trim(); }

function parseMessage(type, content) {
  const text = String(content || '').trim();
  const data = { format: 'intel7', channel_type: type, province_refs: provinceMatches(text) };

  if (type === 'attacks') {
    const direct = text.match(/^(.*?)\s+\((\d+:\d+)\)\s+(?:attacked\s+and\s+looted\s+([\d,]+)\s+(.+?)\s+from|captured\s+([\d,]+)\s+acres?\s+of\s+land\s+from)\s+(.*?)\s+\((\d+:\d+)\)/i);
    if (direct) {
      data.attacker_name = cleanProvinceName(direct[1]);
      data.attacker_kd = direct[2];
      if (direct[3] != null) {
        data.loot_amount = Number(direct[3].replace(/,/g, ''));
        data.loot_resource = direct[4].trim();
      } else {
        data.acres = Number(direct[5].replace(/,/g, ''));
        data.loot_amount = data.acres;
        data.loot_resource = 'acres';
        data.event = 'land_capture';
      }
      data.target_name = cleanProvinceName(direct[6]);
      data.target_kd = direct[7];
    } else {
      const header = text.match(/(?:^|\n)\s*⚔\s*([^\r\n(]+?)\s*\((\d+:\d+)\)\s*(?:—|-)\s*#?\s*\d+\s*-\s*[^\r\n:]+:/i);
      const arrival = text.match(/Your forces arrive at\s+([^\r\n]+?)\s+\((\d+:\d+)\)\s*\./i);
      if (header && arrival) {
        data.attacker_name = cleanProvinceName(header[1]);
        data.attacker_kd = header[2];
        data.target_name = cleanProvinceName(arrival[1]);
        data.target_kd = arrival[2];
        data.result = /managed\s+a\s+victory|victory/i.test(text) ? 'victory' : (/defeat|lost\s+the\s+battle/i.test(text) ? 'defeat' : null);
        const massacred = text.match(/massacred\s+([\d,]+)\s+peasants?,?\s*thieves?,?\s*and\s*wizards?/i);
        if (massacred) data.enemy_civilians_killed = Number(massacred[1].replace(/,/g, ''));
        const losses = text.match(/We lost\s+(.+?)\s+in this battle\./i);
        if (losses) data.our_losses = losses[1].trim();
        const killed = text.match(/We killed about\s+([\d,]+)\s+enemy troops?/i);
        if (killed) data.enemy_troops_killed = Number(killed[1].replace(/,/g, ''));
        const available = text.match(/available again in\s+([\d.]+)\s+days/i);
        if (available) data.army_return_days = Number(available[1]);
        const acres = text.match(/army has taken\s+([\d,]+)\s+acres?/i);
        if (acres) data.acres = Number(acres[1].replace(/,/g, ''));
        data.event = 'battle_report';
      }
    }
    data.event = data.event || 'attack';
  } else if (type === 'ops') {
    data.event='thievery';
    const m=text.match(/^(.*?)\s+\((\d+:\d+)\).*?(?:on|from|against)\s+(.*?)\s+\((\d+:\d+)\)/i);
    if(m){data.attacker_name=m[1].trim();data.attacker_kd=m[2];data.target_name=m[3].trim();data.target_kd=m[4];}
    data.thieves_sent=numberAfter(text,/(?:sent|used)\s+([\d,]+)\s+thieves/i);
  } else if(type==='offensive_spells'||type==='self_spells') {
    data.event='spell'; const m=text.match(/(?:cast|casts|used)\s+(?:the\s+)?(.+?)(?:\.|\s+on\s+)/i); data.spell=m?m[1].trim():null; data.success=!/failed|fail|resisted/i.test(text);
  } else if(type==='dragon') data.event='dragon';
  else if(type==='ritual') data.event='ritual';
  else if(type==='aid') { data.event='aid'; data.amount=numberAfter(text,/([\d,]+)\s+(?:gold|food|runes|soldiers|units)/i); }
  return data;
}

async function save(message, type, parsed) {
  const client=supabaseService.getClient();
  if(!client){logger.error('[INTEL7] Supabase is not configured');return false;}
  const row={
    discord_message_id:message.id,
    guild_id:message.guildId||null,
    channel_id:message.channelId,
    channel_type:type,
    kd_code:KD_CODE,
    author_id:message.author?.id||message.author?.username||null,
    author_name:message.author?.tag||message.author?.username||null,
    content:message.content||'',
    message_created_at:message.createdAt?new Date(message.createdAt).toISOString():null,
    event_type:parsed.event||type,
    parsed:true
  };
  const {error}=await client.from('intel7_messages').upsert(row,{onConflict:'discord_message_id'});
  if(error){logger.error(`[INTEL7] isolated save failed: ${error.message}`);return false;}
  logger.info(`[INTEL7 SAVED] ${type} message=${message.id} table=intel7_messages`);
  return true;
}

async function processMessage(message,type){
  if(!message?.id||!message.channelId)return;
  logger.info(`[INTEL7 RECEIVED] type=${type} channel=${message.channelId} message=${message.id}`);
  const parsed=parseMessage(type,message.content||'');
  logger.info(`[INTEL7 PARSED] type=${type} event=${parsed.event||type} message=${message.id}`);
  await save(message,type,parsed);
}

async function verifyChannels(client,channels){
  for(const [id,type] of channels){try{const c=await client.channels.fetch(id);logger.info(`[INTEL7 CHANNEL CHECK] ${type} ${id} -> FOUND guild=${c?.guild?.id||'none'} name=${c?.name||'unknown'} type=${c?.type??'unknown'}`);}catch(e){logger.error(`[INTEL7 CHANNEL CHECK] ${type} ${id} -> NOT FOUND ${e.code||''} ${e.message}`);}}
}

function startRestPoller(client,channels){
  const seen=new Map(); let first=true;
  const poll=async()=>{for(const [id,type] of channels){try{const channel=await client.channels.fetch(id);const messages=await channel.messages.fetch({limit:10});const ordered=[...messages.values()].sort((a,b)=>a.createdTimestamp-b.createdTimestamp);if(first){const newest=ordered.at(-1);if(newest)seen.set(id,newest.id);continue;}const last=seen.get(id);for(const message of ordered){if(last&&message.id===last)continue;if(!last||message.createdTimestamp>(channel.messages.cache.get(last)?.createdTimestamp||0)){logger.info(`[INTEL7 POLL] new message channel=${id} type=${type} message=${message.id}`);await processMessage(message,type);seen.set(id,message.id);}}}catch(e){if (e.code === 50001 || String(e.message).includes('Missing Access')) {
        logger.warn(`[INTEL7] No access to ${type} channel ${id} - ask admin to check permissions`);
      } else {
        logger.error(`[INTEL7 POLL ERROR] ${type} ${id} ${e.code||''} ${e.message}`);
      }}}first=false;};
  poll().catch(e=>logger.error(`[INTEL7 POLL ERROR] ${e.stack||e.message}`)); setInterval(()=>poll().catch(e=>logger.error(`[INTEL7 POLL ERROR] ${e.stack||e.message}`)),POLL_MS); logger.info(`[INTEL7] REST fallback poller active interval=${POLL_MS}ms`);
}

function initialize(client){
  const channels=configuredChannels();
  logger.info(`[INTEL7] clean isolated listener starting; channels=${JSON.stringify(Object.fromEntries(channels))}; kd=${KD_CODE}`);
  client.once('clientReady',async()=>{await verifyChannels(client,channels);startRestPoller(client,channels);});
  client.on('messageCreate',async message=>{const type=channels.get(message.channelId);if(!type)return;logger.info(`[INTEL7 EVENT] messageCreate channel=${message.channelId} guild=${message.guildId||'DM'} author=${message.author?.tag||message.author?.username||'unknown'}`);try{await processMessage(message,type);}catch(e){logger.error(`[INTEL7 ERROR] type=${type} message=${message.id} ${e.stack||e.message}`);}});
  return {channels,kd:KD_CODE};
}

module.exports={initialize,configuredChannels,parseMessage};
