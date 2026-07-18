const supabaseService = require("./supabase");
const logger = require("./logger");

const alreadyAlerted = new Set();

async function getAlertChannel(supabase) {
  const { data } = await supabase
    .from("bot_settings")
    .select("value")
    .eq("key", "alert_channel")
    .limit(1);
  return data?.[0]?.value || null;
}

async function checkIncomingAttacks(client, supabase) {
  const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const { data: attacks } = await supabase
    .from("attacks")
    .select("*")
    .gte("timestamp", since)
    .order("timestamp", { ascending: false });

  if (!attacks?.length) return;

  const { data: provinces } = await supabase
    .from("provinces")
    .select("name");

  const ourProvinces = new Set((provinces || []).map(p => p.name?.toLowerCase()));
  const incoming = attacks.filter(a => ourProvinces.has(a.target_province?.toLowerCase()));
  if (!incoming.length) return;

  const channelId = await getAlertChannel(supabase);
  if (!channelId) return;
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) return;

  for (const atk of incoming) {
    const key = `atk_${atk.id || atk.msg_id}`;
    if (alreadyAlerted.has(key)) continue;
    alreadyAlerted.add(key);

    const msg = [
      `🚨 **INCOMING ATTACK**`,
      `⚔️ **${atk.attacker_province}** attacked **${atk.target_province}**`,
      atk.acres_captured ? `📍 Acres taken: ${atk.acres_captured}` : '',
      atk.kills ? `💀 Kills: ${atk.kills}` : '',
      atk.attack_type ? `📋 Type: ${atk.attack_type}` : '',
    ].filter(Boolean).join('\n');

    await channel.send(msg);
    logger.info(`[HOSTILE ALERT] Incoming attack on ${atk.target_province} from ${atk.attacker_province}`);
  }
}

async function checkHostileOpSpike(client, supabase) {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data: ops } = await supabase
    .from("hostile_ops")
    .select("*")
    .gte("timestamp", since);

  if (!ops?.length) return;

  const { data: provinces } = await supabase
    .from("provinces")
    .select("name");

  const ourProvinces = new Set((provinces || []).map(p => p.name?.toLowerCase()));
  const incomingOps = ops.filter(op => ourProvinces.has(op.target_province?.toLowerCase()));
  if (incomingOps.length < 3) return;

  const key = `ops_spike_${new Date().getUTCHours()}`;
  if (alreadyAlerted.has(key)) return;
  alreadyAlerted.add(key);

  const channelId = await getAlertChannel(supabase);
  if (!channelId) return;
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) return;

  const byKingdom = {};
  for (const op of incomingOps) {
    const kd = op.target_kingdom || "Unknown";
    if (!byKingdom[kd]) byKingdom[kd] = [];
    byKingdom[kd].push(op);
  }

  const kdSummary = Object.entries(byKingdom)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([kd, ops]) => `• ${kd}: ${ops.length} ops`)
    .join('\n');

  const successCount = incomingOps.filter(o => o.success).length;

  await channel.send([
    `⚠️ **HOSTILE OP SPIKE DETECTED**`,
    `${incomingOps.length} ops against Judo in the last hour (${successCount} successful)`,
    ``,
    `**By Kingdom:**`,
    kdSummary
  ].join('\n'));

  logger.info(`[HOSTILE ALERT] Op spike: ${incomingOps.length} ops in last hour`);
}

async function buildThreatMeter(supabase) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: ops } = await supabase
    .from("hostile_ops")
    .select("target_kingdom, success, operation")
    .gte("timestamp", since);

  const { data: atks } = await supabase
    .from("attacks")
    .select("target_kingdom, attacker_province")
    .gte("timestamp", since);

  if (!ops?.length && !atks?.length) return null;

  const threat = {};

  for (const op of (ops || [])) {
    const kd = op.target_kingdom || "Unknown";
    if (!threat[kd]) threat[kd] = { ops: 0, attacks: 0, successfulOps: 0 };
    threat[kd].ops++;
    if (op.success) threat[kd].successfulOps++;
  }

  for (const atk of (atks || [])) {
    const kd = atk.target_kingdom || "Unknown";
    if (!threat[kd]) threat[kd] = { ops: 0, attacks: 0, successfulOps: 0 };
    threat[kd].attacks++;
  }

  return Object.entries(threat)
    .sort((a, b) => (b[1].ops + b[1].attacks * 2) - (a[1].ops + a[1].attacks * 2))
    .slice(0, 5);
}

async function checkHostileActivity(client) {
  const supabase = supabaseService.getClient();
  if (!supabase) return;
  try {
    await checkIncomingAttacks(client, supabase);
    await checkHostileOpSpike(client, supabase);
  } catch (e) {
    logger.error(`[HOSTILE ALERT] Error: ${e.message}`);
  }
}

module.exports = { checkHostileActivity, buildThreatMeter };
