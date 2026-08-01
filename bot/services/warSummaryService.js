const supabaseService = require("./supabase");
const logger = require("./logger");

async function getWarSummary() {
  const supabase = supabaseService.getClient();
  if (!supabase) return null;

  try {
    const { data: attacks, error } = await supabase
      .from("attacks")
      .select("*")
      .order("timestamp", { ascending: false });

    if (error) { logger.error(`[WAR SUMMARY ERROR] ${error.message}`); return null; }

    const outgoing = attacks.filter(a => a.attack_type !== "incoming");
    const incoming = attacks.filter(a => a.attack_type === "incoming");

    // Per attacker stats
    const byAttacker = {};
    for (const a of outgoing) {
      const p = a.attacker_province || "Unknown";
      if (!byAttacker[p]) byAttacker[p] = { attacks: 0, acres: 0, types: {} };
      byAttacker[p].attacks++;
      byAttacker[p].acres += a.acres_captured || 0;
      byAttacker[p].types[a.attack_type] = (byAttacker[p].types[a.attack_type] || 0) + 1;
    }

    // Per enemy kingdom stats
    const byEnemy = {};
    for (const a of outgoing) {
      const kd = a.target_kingdom || "Unknown";
      if (!byEnemy[kd]) byEnemy[kd] = { attacks: 0, acres: 0, provinces: new Set(), types: {} };
      byEnemy[kd].attacks++;
      byEnemy[kd].acres += a.acres_captured || 0;
      byEnemy[kd].provinces.add(a.target_province);
      byEnemy[kd].types[a.attack_type] = (byEnemy[kd].types[a.attack_type] || 0) + 1;
    }

    // Attack type breakdown
    const typeBreakdown = {};
    for (const a of outgoing) {
      typeBreakdown[a.attack_type] = (typeBreakdown[a.attack_type] || 0) + 1;
    }

    // Total acres lost
    const acresLost = incoming.reduce((sum, a) => sum + (a.acres_captured || 0), 0);

    // Top performers
    const topByAcres = Object.entries(byAttacker)
      .sort((a, b) => b[1].acres - a[1].acres)
      .slice(0, 5);
    const topByAttacks = Object.entries(byAttacker)
      .sort((a, b) => b[1].attacks - a[1].attacks)
      .slice(0, 5);

    // Highlights
    const biggestHit = outgoing.reduce((best, a) =>
      (a.acres_captured || 0) > (best?.acres_captured || 0) ? a : best, null);
    const learns = outgoing.filter(a => a.attack_type === "learn");
    const bounces = outgoing.filter(a => !a.acres_captured && a.attack_type !== "learn" && a.attack_type !== "plunder");

    return {
      outgoing,
      incoming,
      byAttacker,
      byEnemy,
      typeBreakdown,
      acresLost,
      topByAcres,
      topByAttacks,
      biggestHit,
      learns,
      bounces,
      totalAcresGained: outgoing.reduce((sum, a) => sum + (a.acres_captured || 0), 0),
    };
  } catch (err) {
    logger.error(`[WAR SUMMARY ERROR] ${err.message}`);
    return null;
  }
}

function formatSummary(s) {
  if (!s) return "No attack data found.";

  const lines = [];

  lines.push(`**📊 WAR SUMMARY**`);
  lines.push(`**Attacks Made:** ${s.outgoing.length} | **Attacks Suffered:** ${s.incoming.length}`);
  lines.push(`**Land Gained:** +${s.totalAcresGained.toLocaleString()} acres | **Land Lost:** -${s.acresLost.toLocaleString()} acres`);
  lines.push(`**Net:** ${(s.totalAcresGained - s.acresLost) >= 0 ? "+" : ""}${(s.totalAcresGained - s.acresLost).toLocaleString()} acres`);
  lines.push("");

  // Attack type breakdown
  lines.push("**⚔️ Attack Types (Outgoing):**");
  for (const [type, count] of Object.entries(s.typeBreakdown)) {
    lines.push(`  ${type}: ${count}`);
  }
  lines.push(`  Bounces: ${s.bounces.length}`);
  lines.push("");

  // Per enemy kingdom outgoing
  lines.push("**🎯 By Enemy Kingdom:**");
  const enemyEntries = Object.entries(s.byEnemy).sort((a, b) => b[1].acres - a[1].acres);
  for (const [kd, data] of enemyEntries) {
    const uniques = data.provinces.size;
    lines.push(`  **${kd}** — ${data.attacks} attacks, +${data.acres} acres, ${uniques} uniques hit`);
  }
  lines.push("");

  // Incoming breakdown by kingdom
  lines.push("**🛡️ Incoming Attacks:**");
  if (s.incoming.length === 0) {
    lines.push("  None recorded");
  } else {
    const byIncomingKd = {};
    for (const a of s.incoming) {
      const kd = a.target_kingdom || "Unknown";
      if (!byIncomingKd[kd]) byIncomingKd[kd] = { count: 0, acres: 0, targets: {} };
      byIncomingKd[kd].count++;
      byIncomingKd[kd].acres += a.acres_captured || 0;
      const t = a.target_province || "Unknown";
      byIncomingKd[kd].targets[t] = (byIncomingKd[kd].targets[t] || 0) + (a.acres_captured || 0);
    }
    for (const [kd, data] of Object.entries(byIncomingKd).sort((a, b) => b[1].acres - a[1].acres)) {
      const kdLabel = kd === "3:2" ? "Our Kingdom" : kd;
      lines.push(`  **${kdLabel}** — ${data.count} hits, -${data.acres} acres`);
    }
    lines.push("");

    // Per-province incoming
    lines.push("**🏰 Members Hit:**");
    const byTarget = {};
    for (const a of s.incoming) {
      const t = a.target_province || "Unknown";
      if (!byTarget[t]) byTarget[t] = { hits: 0, acres: 0 };
      byTarget[t].hits++;
      byTarget[t].acres += a.acres_captured || 0;
    }
    for (const [name, data] of Object.entries(byTarget).sort((a, b) => b[1].acres - a[1].acres)) {
      lines.push(`  ${name}: ${data.hits} hits, -${data.acres} acres`);
    }
  }
  lines.push("");

  // Top performers by acres
  lines.push("**🏆 Top by Land Gained:**");
  for (const [name, data] of s.topByAcres) {
    lines.push(`  ${name}: +${data.acres} acres (${data.attacks} attacks)`);
  }
  lines.push("");

  // Top by attacks
  lines.push("**⚔️ Most Active:**");
  for (const [name, data] of s.topByAttacks) {
    lines.push(`  ${name}: ${data.attacks} attacks (+${data.acres} acres)`);
  }
  lines.push("");

  // Highlights
  lines.push("**✨ Highlights:**");
  if (s.biggestHit) {
    lines.push(`  Biggest hit: **${s.biggestHit.attacker_province}** → ${s.biggestHit.target_province} (${s.biggestHit.acres_captured} acres)`);
  }
  if (s.learns.length > 0) {
    const books = s.learns.reduce((sum, a) => sum + (a.books_captured || 0), 0);
    lines.push(`  Learns: ${s.learns.length} (${books} books)`);
  }
  lines.push(`  Bounces received: ${s.bounces.length}`);

  return lines.join("\n");
}

module.exports = { getWarSummary, formatSummary };
