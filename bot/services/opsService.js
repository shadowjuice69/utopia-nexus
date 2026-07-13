const supabaseService = require("./supabase");
const supabase = supabaseService.getClient();


async function saveOpsMessage(data) {
  if (!supabase) return false;

  const { error } = await supabase
    .from("bot_ops_messages")
    .insert([
      {
        msg_id: data.msgId,
        timestamp: new Date().toISOString(),
        content: data.message,
        kd_code: data.kdCode || null
      }
    ]);

  if (error) {
    console.error("[OPS SERVICE ERROR]", error.message);
    return false;
  }

  console.log("[OPS STORED]", data.message);
  return true;
}


async function saveAttack(data) {
  if (!supabase) return false;

  const { error } = await supabase
    .from("attacks")
    .insert([
      {
        message_id: data.msgId,
        timestamp: new Date().toISOString(),
        attacker_province: data.attackerProvince,
        target_province: data.targetProvince,
        target_kingdom: data.targetKingdom || null,
        acres_captured: data.acresCaptured || null,
        attack_type: data.attackType || null,
        kd_code: data.kdCode || null
      }
    ]);

  if (error) {
    console.error("[ATTACK SERVICE ERROR]", error.message);
    return false;
  }

  console.log(
    "[ATTACK SAVED]",
    data.attackerProvince,
    "→",
    data.targetProvince
  );

  return true;
}


async function saveHostileOp(data) {
  if (!supabase) return false;

  const { error } = await supabase
    .from("hostile_ops")
    .insert([
      {
        message_id: data.msgId,
        timestamp: new Date().toISOString(),
        attacker_province: data.attackerProvince,
        target_province: data.targetProvince,
        target_kingdom: data.targetKingdom || null,
        operation: data.op,
        category: data.category,
        success: data.success,
        result_value: data.resultValue || null,
        thieves_sent: data.thievesSent || null,
        thieves_lost: data.thievesLost || null,
        wizards_lost: data.wizardsLost || null
      }
    ]);

  if (error) {
    console.error("[HOSTILE OP ERROR]", error.message);
    return false;
  }

  console.log(
    "[HOSTILE OP SAVED]",
    data.attackerProvince,
    "→",
    data.targetProvince
  );

  return true;
}


async function saveOpAssignment(data) {
  if (!supabase) return false;

  const { error } = await supabase
    .from("ops_assignments")
    .insert([
      {
        user_id: data.userId || null,
        target_name: data.targetName,
        op_name: data.opName,
        op_type: data.opType,
        assigned_to: data.assignedTo,
        kd_code: data.kdCode || null
      }
    ]);

  if (error) {
    console.error("[OP ASSIGNMENT ERROR]", error.message);
    return false;
  }

  console.log("[OP ASSIGNMENT SAVED]", data.targetName);
  return true;
}


async function saveWaveAssignment(data) {
  if (!supabase) return false;

  const { error } = await supabase
    .from("wave_assignments")
    .insert([
      {
        user_id: data.userId || null,
        attacker: data.attacker,
        attacker_combo: data.attackerCombo,
        target: data.target,
        target_nw: data.targetNw,
        target_combo: data.targetCombo,
        source_kd: data.sourceKd,
        attack_type: data.attackType,
        off_sent: data.offSent,
        chain: data.chain || null,
        attack_result: data.attackResult || null,
        sort_order: data.sortOrder || null,
        kd_code: data.kdCode || null
      }
    ]);

  if (error) {
    console.error("[WAVE ASSIGNMENT ERROR]", error.message);
    return false;
  }

  console.log("[WAVE SAVED]", data.target);
  return true;
}


module.exports = {
  saveOpsMessage,
  saveAttack,
  saveHostileOp,
  saveOpAssignment,
  saveWaveAssignment
};
