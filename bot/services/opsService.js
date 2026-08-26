const supabaseService = require("./supabase");
const supabase = supabaseService.getClient();
const logger = require("./logger");

async function saveHostileOp(op) {
  if (!supabase) return;
  try {
    const now = new Date().toISOString();
    const { error } = await supabase.from("hostile_ops").insert({ message_id: op.msgId, timestamp: now, attacker_province: op.attackerProvince, target_province: op.targetProvince, target_kingdom: op.targetKingdom, operation: op.op, category: op.category, success: op.success, result_value: op.resultValue, thieves_sent: op.thievesSent, thieves_lost: op.thievesLost, wizards_lost: op.wizardsLost });
    if (error) throw error;
    logger.info(`[HOSTILE OP SAVED] ${op.attackerProvince} → ${op.targetProvince}`);
  } catch (err) { logger.error(`[HOSTILE OP ERROR] ${err.message}`); }
}

async function saveSpell(spell) {
  if (!supabase) return;
  try {
    const { error } = await supabase.from("spell_events").insert({ message_id: spell.msgId || spell.messageId, timestamp: spell.timestamp || new Date().toISOString(), caster_province: spell.attackerProvince || spell.casterProvince || null, caster_kingdom: spell.attackerKingdom || spell.casterKingdom || null, target_province: spell.targetProvince || null, target_kingdom: spell.targetKingdom || null, spell_name: spell.op || spell.spell || spell.spellName || spell.name, category: spell.category || "sorcery", success: spell.success, result_value: spell.resultValue ?? spell.runes ?? null });
    if (error) throw error;
    logger.info(`[SPELL SAVED] ${spell.spellName || spell.op || spell.spell}`);
  } catch (err) { logger.error(`[SPELL ERROR] ${err.message}`); }
}

async function saveAttack(atk) {
  if (!supabase) return;
  try {
    const { error } = await supabase.from("attacks").insert({
      message_id: atk.msgId || atk.messageId,
      timestamp: atk.timestamp || new Date().toISOString(),
      attacker_province: atk.attackerProvince,
      attacker_kingdom: atk.attackerKingdom || null,
      target_province: atk.targetProvince,
      target_kingdom: atk.targetKingdom,
      attack_type: atk.attack_type || atk.attackType,
      acres_captured: atk.acresCaptured ?? null,
      acres_recaptured: atk.acresRecaptured ?? null,
      acres_destroyed: atk.acresDestroyed ?? null,
      offense_sent: atk.offenseSent ?? null,
      peasants: atk.peasants ?? null,
      spec_creds: atk.specCredits ?? null,
      kills: atk.kills ?? null,
      prisoners: atk.prisoners ?? null,
      losses: atk.losses || null,
      sent: atk.sent ?? atk.offenseSent ?? null,
      books_captured: atk.loot?.books ?? null,
      enemy_defense: atk.enemyDefense ?? null,
      return_days: atk.returnDays ?? null,
      loot: atk.loot || null
    });
    if (error) throw error;
    logger.info(`[ATTACK SAVED] ${atk.attackerProvince} → ${atk.targetProvince}`);
  } catch (err) { logger.error(`[ATTACK SERVICE ERROR] ${err.message}`); }
}

async function saveChannelEvent(event) {
  if (!supabase) return;
  try {
    if (event.type === "dragon") {
      const { error } = await supabase.from("dragon_events").insert({ message_id: event.messageId, timestamp: event.timestamp, event_type: event.eventType, province: event.province || null, kingdom: event.targetKingdom || event.kingdom || null, dragon_name: event.dragonName, strength: event.strength, raw: event.raw, data: event });
      if (error) throw error;
    } else if (event.type === "ritual") {
      const { error } = await supabase.from("ritual_events").insert({ message_id: event.messageId, timestamp: event.timestamp, caster_province: event.casterProvince, caster_kingdom: event.casterKingdom, success: event.success, cast_count: event.castCount, cast_needed: event.castNeeded, raw: event.raw, data: event });
      if (error) throw error;
    } else if (event.type === "aid") {
      const { error } = await supabase.from("aid_events").insert({ message_id: event.messageId, timestamp: event.timestamp, sender_province: event.senderProvince, sender_kingdom: event.senderKingdom, target_province: event.targetProvince, target_kingdom: event.targetKingdom, resource_type: event.resourceType, amount: event.amount, surplus_gold: event.surplusGold, raw: event.raw, data: event });
      if (error) throw error;
    }
    logger.info(`[INTEL EVENT SAVED] ${event.type}`);
  } catch (err) { logger.error(`[INTEL EVENT ERROR] ${event.type}: ${err.message}`); }
}

async function saveOpsMessage(message) { logger.info(`[OPS STORED] ${message.content || message || "unknown"}`); }

module.exports = { saveOpsMessage, saveHostileOp, saveAttack, saveSpell, saveChannelEvent };
