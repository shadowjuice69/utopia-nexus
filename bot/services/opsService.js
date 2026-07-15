const supabaseService = require("./supabase");
const supabase = supabaseService.getClient();
const logger = require("./logger");

async function saveHostileOp(op) {
  if (!supabase) return;

  try {
    const { error } = await supabase
      .from("hostile_ops")
      .insert({
        message_id: op.msgId,
        timestamp: new Date().toISOString(),
        attacker_province: op.attackerProvince,
        target_province: op.targetProvince,
        target_kingdom: op.targetKingdom,
        operation: op.op,
        category: op.category,
        success: op.success,
        result_value: op.resultValue,
        thieves_sent: op.thievesSent,
        thieves_lost: op.thievesLost,
        wizards_lost: op.wizardsLost
      });

    if (error) throw error;

    logger.info(
      `[HOSTILE OP SAVED] ${op.attackerProvince} → ${op.targetProvince}`
    );
  } catch (err) {
    logger.error(`[HOSTILE OP ERROR] ${err.message}`);
  }
}

async function saveAttack(atk) {
  if (!supabase) return;

  try {
    const { error } = await supabase
      .from("attacks")
      .insert({
        message_id: atk.msgId,
        timestamp: new Date().toISOString(),
        attacker_province: atk.attackerProvince,
        target_province: atk.targetProvince,
        target_kingdom: atk.targetKingdom,
        attack_type: atk.attackType,
        acres_captured: atk.acresCaptured,
        offense_sent: atk.offenseSent,
        peasants: atk.peasants,
        spec_creds: atk.specCredits,
        kills: atk.kills,
        prisoners: atk.prisoners
      });

    if (error) throw error;

    logger.info(
      `[ATTACK SAVED] ${atk.attackerProvince} → ${atk.targetProvince}`
    );
  } catch (err) {
    logger.error(`[ATTACK SERVICE ERROR] ${err.message}`);
  }
}

async function saveOpsMessage(message) {
  logger.info(`[OPS STORED] ${message.content || message || "unknown"}`);
}

module.exports = {
  saveOpsMessage,
  saveHostileOp,
  saveAttack
};
