const supabaseService = require("./supabase");
const logger = require("./logger");
const { getMeterFromActions, getMeterStatus, getActionsToNextLevel } = require("./relationsCalculator");

const alreadyAlerted = new Set();

async function getAlertChannel(supabase) {
  const { data } = await supabase
    .from("bot_settings")
    .select("value")
    .eq("key", "alert_channel")
    .limit(1);
  return data?.[0]?.value || null;
}

async function getOurProvinces(supabase) {
  const { data } = await supabase.from("provinces").select("name");
  return new Set((data || []).map(p => p.name?.toLowerCase()));
}

// ─── WAVE DETECTOR ───────────────────────────────────────────────
async function checkEnemyWave(client, supabase) {
  const since = new Date(Date.now() - 20 * 60 * 1000).toISOString(); // last 20 mins
  const ourProvinces = await getOurProvinces(supabase);

  const [{ data: attacks }, { data: ops }] = await Promise.all([
    supabase.from("attacks").select("*").gte("timestamp", since),
    supabase.from("hostile_ops").select("*").gte("timestamp", since)
  ]);

  const incomingAtks = (attacks || []).filter(a => ourProvinces.has(a.target_province?.toLowerCase()));
  const incomingOps = (ops || []).filter(o => ourProvinces.has(o.target_province?.toLowerCase()));

  if (incomingAtks.length < 3 && incomingOps.length < 5) return null;

  // Count unique attackers and kingdoms
  const uniqueAttackers = new Set(incomingAtks.map(a => a.attacker_province));
  const uniqueKingdoms = new Set([
    ...incomingAtks.map(a => a.target_kingdom),
    ...incomingOps.map(o => o.target_kingdom)
  ]);

  // Find most hit province
  const hitCount = {};
  for (const a of incomingAtks) {
    const t = a.target_province || "Unknown";
    hitCount[t] = (hitCount[t] || 0) + 1;
  }
  const primaryTarget = Object.entries(hitCount).sort((a, b) => b[1] - a[1])[0];

  // Check ops before attacks (ops within 10 mins before attacks)
  const opsBeforeAtks = incomingOps.filter(o => {
    const opTime = new Date(o.timestamp);
    return incomingAtks.some(a => {
      const atkTime = new Date(a.timestamp);
      return atkTime - opTime > 0 && atkTime - opTime < 10 * 60 * 1000;
    });
  });

  // Confidence score
  let confidence = 0;
  if (incomingAtks.length >= 3) confidence += 30;
  if (incomingAtks.length >= 6) confidence += 20;
  if (incomingAtks.length >= 9) confidence += 15;
  if (uniqueAttackers.size >= 3) confidence += 15;
  if (incomingOps.length >= 5) confidence += 10;
  if (opsBeforeAtks.length >= 2) confidence += 10;
  if (primaryTarget && primaryTarget[1] >= 3) confidence += 10;
  confidence = Math.min(confidence, 99);

  if (confidence < 40) return null;

  const kingdom = [...uniqueKingdoms].filter(Boolean)[0] || "Unknown Kingdom";
  const key = `wave_${kingdom}_${new Date().getUTCHours()}`;
  if (alreadyAlerted.has(key)) return null;
  alreadyAlerted.add(key);

  return {
    type: "wave",
    kingdom,
    attacks: incomingAtks.length,
    ops: incomingOps.length,
    uniqueAttackers: uniqueAttackers.size,
    primaryTarget: primaryTarget?.[0],
    primaryTargetHits: primaryTarget?.[1],
    confidence,
    opsBeforeAtks: opsBeforeAtks.length
  };
}

// ─── CHAIN DETECTOR ──────────────────────────────────────────────
async function checkRelations(client, supabase) {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const ourProvinces = await getOurProvinces(supabase);

  const [{ data: attacks }, { data: ops }, { data: spellData }] = await Promise.all([
    supabase.from("attacks").select("*").gte("timestamp", since),
    supabase.from("hostile_ops").select("*").gte("timestamp", since),
    supabase.from("spell_events").select("*").gte("timestamp", since)
  ]);

  const incoming = (attacks || []).filter(a => ourProvinces.has(a.target_province?.toLowerCase()));
  const incomingOps = (ops || []).filter(o => ourProvinces.has(o.target_province?.toLowerCase()));
  const incomingSpells = (spellData || []).filter(s => ourProvinces.has(s.target_province?.toLowerCase()));

  const kingdoms = new Set([
    ...incoming.map(a => a.target_kingdom),
    ...incomingOps.map(o => o.target_kingdom)
  ].filter(Boolean));

  const warnings = [];

  for (const kd of kingdoms) {
    const kdAtks = incoming.filter(a => a.target_kingdom === kd);
    const kdOps = incomingOps.filter(o => o.target_kingdom === kd);
    const kdSpells = incomingSpells.filter(s => s.target_kingdom === kd);

    const meter = getMeterFromActions(kdAtks, kdOps, kdSpells);
    const status = getMeterStatus(meter);
    const nextLevel = getActionsToNextLevel(meter);

    if (status.level < 1) continue;

    const key = `relations_${kd}_${Math.floor(Date.now() / (60 * 60 * 1000))}`;
    if (alreadyAlerted.has(key)) continue;
    alreadyAlerted.add(key);

    warnings.push({
      type: "relations",
      kingdom: kd,
      meter,
      status: status.status,
      color: status.color,
      level: status.level,
      attacks: kdAtks.length,
      ops: kdOps.length,
      actionsToNext: nextLevel.actions,
      nextLevel: nextLevel.next
    });
  }

  return warnings;
}

async function checkChains(client, supabase) {
  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const ourProvinces = await getOurProvinces(supabase);

  const { data: attacks } = await supabase
    .from("attacks").select("*").gte("timestamp", since).order("timestamp", { ascending: true });

  if (!attacks?.length) return [];

  const incoming = (attacks || []).filter(a => ourProvinces.has(a.target_province?.toLowerCase()));

  const byTarget = {};
  for (const a of incoming) {
    const t = a.target_province || "Unknown";
    if (!byTarget[t]) byTarget[t] = [];
    byTarget[t].push(a);
  }

  const { data: allProvinces } = await supabase.from("provinces").select("name, nw, acres");
  const provinceNWMap = {};
  for (const p of (allProvinces || [])) {
    if (p.name) provinceNWMap[p.name.toLowerCase()] = {
      nw: parseFloat((p.nw || "0").toString().replace(/,/g, "")) || 0
    };
  }

  const { data: ourNWData } = await supabase.from("provinces")
    .select("nw").not("nw", "is", null).not("discord_id", "is", null);
  const ourNWValues = (ourNWData || []).map(p => parseFloat((p.nw || "0").toString().replace(/,/g, "")) || 0).filter(n => n > 0);
  const avgKdNW = ourNWValues.length ? ourNWValues.reduce((a, b) => a + b, 0) / ourNWValues.length : 0;

  const chains = [];

  for (const [province, hits] of Object.entries(byTarget)) {
    if (hits.length < 3) continue;

    const first = new Date(hits[0].timestamp);
    const last = new Date(hits[hits.length - 1].timestamp);
    const minutes = Math.round((last - first) / 60000);
    const totalAcresLost = hits.reduce((s, h) => s + (parseInt(h.acres_captured) || 0), 0);

    const targetIntel = provinceNWMap[province.toLowerCase()];
    const targetNW = targetIntel?.nw || 0;
    const rpnw = avgKdNW > 0 && targetNW > 0 ? targetNW / avgKdNW : null;
    const popRatioEstimate = hits.length >= 5 ? 1.15 : hits.length >= 3 ? 1.05 : 1.0;

    let status = "CHAINING";
    let rotateNow = false;

    if (popRatioEstimate >= 1.15 && rpnw !== null && rpnw < 0.567) {
      status = "EXHAUSTED";
      rotateNow = true;
    }

    const rotateKey = `chain_rotate_${province}`;
    const chainKey = `chain_${province}_${new Date().getUTCHours()}`;

    if (rotateNow && !alreadyAlerted.has(rotateKey)) {
      alreadyAlerted.add(rotateKey);
      chains.push({ type: "chain", status: "ROTATE", province, hits: hits.length, minutes, acresLost: totalAcresLost, rpnw, targetNW });
    } else if (!rotateNow && !alreadyAlerted.has(chainKey)) {
      alreadyAlerted.add(chainKey);
      chains.push({ type: "chain", status, province, hits: hits.length, minutes, acresLost: totalAcresLost, rpnw, targetNW });
    }
  }

  return chains;
}

async function sendAlerts(client, supabase, wave, chains, relations) {
  const channelId = await getAlertChannel(supabase);
  if (!channelId) return;
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) return;

  // Wave alert
  if (wave) {
    const bar = "█".repeat(Math.round(wave.confidence / 10)) + "░".repeat(10 - Math.round(wave.confidence / 10));
    await channel.send([
      `🚨 **POSSIBLE ENEMY WAVE DETECTED**`,
      `**Kingdom:** ${wave.kingdom}`,
      `**Last 20 minutes:** ⚔️ ${wave.attacks} attacks • 🗡️ ${wave.ops} ops • 👥 ${wave.uniqueAttackers} attackers`,
      wave.primaryTarget ? `**Primary target:** ${wave.primaryTarget} (${wave.primaryTargetHits} hits)` : "",
      `**Wave confidence:** ${wave.confidence}% [${bar}]`,
      `⚠️ Prepare defense and monitor remaining attackers.`
    ].filter(Boolean).join('\n'));
  }

  // Chain alerts
  for (const chain of chains) {
    if (chain.status === "ROTATE") {
      await channel.send([
        `🔴 **CRITICAL: ROTATE NOW**`,
        `**Province:** ${chain.province}`,
        `**Hits:** ${chain.hits} in ${chain.minutes} minutes`,
        chain.acresLost > 0 ? `**Acres lost:** ~${chain.acresLost}` : "",
        chain.rpnw !== null ? `**RPNW:** ${chain.rpnw.toFixed(3)} (below 0.567 — gains = 0)` : "",
        `✅ Pop Ratio ≥ 1.15 + RPNW < 0.567 — target exhausted. Move to next target.`
      ].filter(Boolean).join('\n'));
    } else {
      await channel.send([
        `🟡 **CHAINING DETECTED**`,
        `**Province:** ${chain.province}`,
        `**Hits:** ${chain.hits} in ${chain.minutes} minutes`,
        chain.acresLost > 0 ? `**Acres lost:** ~${chain.acresLost}` : "",
        chain.rpnw !== null ? `**RPNW:** ${chain.rpnw.toFixed(3)}` : "**RPNW:** No intel",
        `⚔️ Pop Ratio ≥ 1.15 — target is being drained. Keep hitting until RPNW < 0.567.`
      ].filter(Boolean).join('\n'));
    }
  }

  // Relations warnings
  for (const rel of relations) {
    const level = `${rel.color} ${rel.status}`;
    await channel.send([
      `⚠️ **RELATIONS WARNING**`,
      `**Kingdom:** ${rel.kingdom}`,
      `**Hostility level:** ${level} — ${rel.meter} points`,
      `⚔️ ${rel.attacks} attacks • 🗡️ ${rel.ops} ops in last hour`,
      `At current activity: **${rel.nextLevel}** in ~${rel.actionsToNext} more attack${rel.actionsToNext > 1 ? "s" : ""}.`
    ].join('\n'));
  }
}

async function checkIncomingAttacks(client, supabase) {
  const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const ourProvinces = await getOurProvinces(supabase);

  const { data: attacks } = await supabase
    .from("attacks")
    .select("*")
    .gte("timestamp", since)
    .order("timestamp", { ascending: false });

  if (!attacks?.length) return;
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

async function buildThreatMeter(supabase) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [{ data: ops }, { data: atks }] = await Promise.all([
    supabase.from("hostile_ops").select("target_kingdom, success, operation").gte("timestamp", since),
    supabase.from("attacks").select("target_kingdom, attacker_province").gte("timestamp", since)
  ]);

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

    // Run detection engines
    const [wave, chains, relations] = await Promise.all([
      checkEnemyWave(client, supabase),
      checkChains(client, supabase),
      checkRelations(client, supabase)
    ]);

    // Send any alerts
    const hasAlerts = wave || chains.length > 0 || relations.length > 0;
    if (hasAlerts) {
      await sendAlerts(client, supabase, wave, chains, relations);
    }

  } catch (e) {
    logger.error(`[HOSTILE ALERT] Error: ${e.message}`);
  }
}

module.exports = { checkHostileActivity, buildThreatMeter };
