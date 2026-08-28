const { parseIntel7 } = require("./parsers");
const config = require("../config/config");

const CHANNEL_TYPES = {
  ops: "thieves",
  offensive_spells: "offensive",
  self_spells: "self",
  dragon: "dragon",
  ritual: "ritual",
  aid: "aid",
  attacks: "attacks",
};

function classify(channelType) {
  return CHANNEL_TYPES[channelType] || channelType;
}

async function processMessage({ message, channelType, supabase, logger }) {
  const intelType = classify(channelType);
  const raw = String(message.content || "").trim();
  if (!raw) return { received: false, parsed: 0 };

  logger.info(`[INTEL7 ${intelType.toUpperCase()}] received ${message.id}`);

  const { error: rawError } = await supabase.from("intel7_messages").upsert({
    message_id: message.id,
    channel_id: message.channel.id,
    channel_type: intelType,
    kingdom: config.intel7KdCode,
    content: raw,
    author_id: message.author?.id || null,
    created_at: message.createdAt?.toISOString?.() || new Date().toISOString(),
  }, { onConflict: "message_id" });

  if (rawError) logger.error(`[INTEL7 RAW ERROR] ${rawError.message}`);

  const events = parseIntel7(intelType, raw).map(event => ({
    message_id: message.id,
    channel_id: message.channel.id,
    channel_type: intelType,
    kingdom: config.intel7KdCode,
    event_type: event.eventType || event.type || "unknown",
    attacker_province: event.attackerProvince || null,
    attacker_kingdom: event.attackerKingdom || null,
    target_province: event.targetProvince || null,
    target_kingdom: event.targetKingdom || null,
    operation: event.operation || null,
    spell_name: event.spellName || null,
    resource_type: event.resourceType || null,
    amount: event.acresCaptured ?? event.amount ?? null,
    success: event.success ?? null,
    data: {
      ...event,
      acres_captured: event.acresCaptured ?? null,
      credits: event.credits ?? null,
      peasants: event.peasants ?? null,
      kills: event.kills ?? null,
      imprisoned: event.imprisoned ?? null,
      troops_lost: event.troopsLost ?? null,
    },
    raw,
    timestamp: message.createdAt?.toISOString?.() || new Date().toISOString(),
  }));

  if (events.length) {
    const { error } = await supabase.from("intel7_events").upsert(events, { onConflict: "message_id,event_type" });
    if (error) logger.error(`[INTEL7 EVENT ERROR] ${error.message}`);
    else logger.info(`[INTEL7 ${intelType.toUpperCase()}] saved ${events.length} event(s)`);
  } else {
    logger.warn(`[INTEL7 ${intelType.toUpperCase()}] received but not parsed: ${message.id}`);
  }

  return { received: true, parsed: events.length };
}

module.exports = { processMessage, CHANNEL_TYPES };
