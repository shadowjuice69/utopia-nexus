const { parseIntel7 } = require("./parsers");
const { parseAttackReport } = require("./attackParser");
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

async function saveStructuredAttack({ supabase, message, event }) {
  if (!event) return;

  const timestamp = message.createdAt?.toISOString?.() || new Date().toISOString();
  const landAmount = event.acresCaptured ?? event.acresRecaptured ?? event.acresDestroyed ?? null;
  const row = {
    msg_id: message.id,
    message_id: message.id,
    timestamp,
    created_at: timestamp,
    kd_code: event.attackerKingdom || config.intel7KdCode || null,
    attacker_province: event.attackerProvince || null,
    attacker_kingdom: event.attackerKingdom || null,
    target_province: event.targetProvince || null,
    target_kingdom: event.targetKingdom || null,
    acres_captured: event.acresCaptured ?? null,
    acres_recaptured: event.acresRecaptured ?? null,
    acres_destroyed: event.acresDestroyed ?? null,
    attack_type: event.attackType || "offensive",
    offense_sent: event.offenseSent ?? null,
    sent: event.offenseSent ?? null,
    enemy_defense: event.enemyDefense ?? null,
    kills: event.kills ?? null,
    prisoners: event.imprisoned ?? null,
    training_credits: event.credits ?? null,
    spec_creds: event.credits ?? null,
    peasants_gained: event.peasants ?? null,
    buildings_survived: event.buildingsSurvived ?? null,
    return_days: event.returnDays ?? null,
    losses: event.losses || null,
  };

  const { data: existing, error: lookupError } = await supabase
    .from("attacks")
    .select("id")
    .eq("msg_id", message.id)
    .limit(1)
    .maybeSingle();

  if (lookupError) loggerSafeError(`[INTEL7 ATTACK LOOKUP ERROR] ${lookupError.message}`);

  const result = existing?.id
    ? await supabase.from("attacks").update(row).eq("id", existing.id)
    : await supabase.from("attacks").insert(row);

  if (result.error) loggerSafeError(`[INTEL7 ATTACK SAVE ERROR] ${result.error.message}`);
  else console.log(`[INTEL7 ATTACK] structured attack saved ${message.id}: ${landAmount ?? 0} acres`);
}

function loggerSafeError(message) {
  console.error(message);
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

  let parsedEvents = parseIntel7(intelType, raw);
  if (intelType === "attacks") {
    const attack = parseAttackReport(raw);
    if (attack) {
      attack.direction = attack.attackerKingdom === config.intel7KdCode ? "outgoing" : "incoming";
      parsedEvents = [attack];
      await saveStructuredAttack({ supabase, message, event: attack });
    }
  }

  const events = parsedEvents.map(event => ({
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
    amount: event.acresCaptured ?? event.acresRecaptured ?? event.acresDestroyed ?? event.amount ?? null,
    success: event.success ?? null,
    data: {
      ...event,
      acres_captured: event.acresCaptured ?? null,
      acres_recaptured: event.acresRecaptured ?? null,
      acres_destroyed: event.acresDestroyed ?? null,
      credits: event.credits ?? null,
      peasants: event.peasants ?? null,
      kills: event.kills ?? null,
      imprisoned: event.imprisoned ?? null,
      troops_lost: event.troopsLost ?? event.losses ?? null,
      buildings_survived: event.buildingsSurvived ?? null,
      offense_sent: event.offenseSent ?? null,
      enemy_defense: event.enemyDefense ?? null,
      return_days: event.returnDays ?? null,
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