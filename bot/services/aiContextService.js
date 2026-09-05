const supabaseService = require("./supabase");

function compact(value, max = 6000) {
  if (value == null) return "";
  let text;
  try { text = typeof value === "string" ? value : JSON.stringify(value); }
  catch { text = String(value); }
  return text.length > max ? text.slice(0, max) + "…" : text;
}

async function query(sb, table, select, options = {}) {
  try {
    let q = sb.from(table).select(select || "*");
    if (options.eq) for (const [k, v] of Object.entries(options.eq)) q = q.eq(k, v);
    if (options.neq) for (const [k, v] of Object.entries(options.neq)) q = q.neq(k, v);
    if (options.notNull) for (const k of options.notNull) q = q.not(k, "is", null);
    if (options.order) q = q.order(options.order[0], { ascending: options.order[1] ?? false });
    if (options.limit) q = q.limit(options.limit);
    const { data, error } = await q;
    if (error) return [];
    return data || [];
  } catch { return []; }
}

async function getKingdomContext({ kd: requestedKd = "", province = "", question = "" } = {}) {
  const sb = supabaseService.getClient();
  if (!sb) return { kd: requestedKd || process.env.MY_KD || "", province, text: "SUPABASE UNAVAILABLE" };

  const settings = await query(sb, "bot_settings", "key,value", { limit: 100 });
  const botKd = settings.find(s => s.key === "kingdom_code")?.value || process.env.MY_KD || "";
  const kd = String(requestedKd || botKd || "").trim();

  const [provinces, enemyProvinces, throne, enemyThrone, science, buildings, military, ops, events, attacks, hostileOps, spells, news, kingdoms, wars, aiBuilds, raceRules, personalityRules, scienceRules, buildingRules, spellRules, gameRules, relationRules, rawPages] = await Promise.all([
    query(sb, "provinces", "*", { eq: kd ? { kd_code: kd } : {}, order: ["updated_at", false], limit: 50 }),
    query(sb, "provinces", "*", { neq: kd ? { kd_code: kd } : {}, order: ["updated_at", false], limit: 100 }),
    query(sb, "intel_throne", "*", { eq: kd ? { kd_code: kd } : {}, order: ["updated_at", false], limit: 50 }),
    query(sb, "intel_throne", "*", { neq: kd ? { kd_code: kd } : {}, order: ["updated_at", false], limit: 100 }),
    query(sb, "intel_science", "*", { eq: kd ? { kd_code: kd } : {}, order: ["updated_at", false], limit: 50 }),
    query(sb, "intel_buildings", "*", { eq: kd ? { kd_code: kd } : {}, order: ["updated_at", false], limit: 50 }),
    query(sb, "intel_military", "*", { eq: kd ? { kd_code: kd } : {}, order: ["updated_at", false], limit: 50 }),
    query(sb, "intel_ops", "*", { eq: kd ? { kd_code: kd } : {}, order: ["updated_at", false], limit: 100 }),
    query(sb, "intel7_events", "*", { eq: kd ? { kd_code: kd } : {}, order: ["timestamp", false], limit: 150 }),
    query(sb, "attacks", "*", { eq: kd ? { kd_code: kd } : {}, order: ["created_at", false], limit: 100 }),
    query(sb, "hostile_ops", "*", { limit: 100 }),
    query(sb, "spell_events", "*", { limit: 100 }),
    query(sb, "news_events", "*", { eq: kd ? { kd_code: kd } : {}, order: ["created_at", false], limit: 100 }),
    query(sb, "kingdoms", "*", { limit: 30 }),
    query(sb, "wars", "*", { limit: 30 }),
    query(sb, "ai_builds", "*", { limit: 30 }),
    query(sb, "race_rules", "*", { limit: 200 }),
    query(sb, "personality_rules", "*", { limit: 200 }),
    query(sb, "science_rules", "*", { limit: 100 }),
    query(sb, "building_rules", "*", { limit: 200 }),
    query(sb, "spell_rules", "*", { limit: 200 }),
    query(sb, "game_rules", "*", { limit: 200 }),
    query(sb, "relation_rules", "*", { limit: 100 }),
    query(sb, "intel_page_ingest", "*", { eq: kd ? { kd_code: kd } : {}, order: ["received_at", false], limit: 40 }),
  ]);

  const relevantProvince = province ? provinces.find(p => String(p.name).toLowerCase() === String(province).toLowerCase()) : null;
  const q = String(question || "").toLowerCase();
  const needsRules = /rule|formula|science|build|spell|race|personality|target|attack|war|op|thief|wizard|military/.test(q);

  const sections = [
    `NEXUS KINGDOM CONTEXT\nKingdom code: ${kd || "unknown"}\nCurrent province: ${province || "unknown"}`,
    `OUR PROVINCES (${provinces.length})\n${compact(provinces, 18000)}`,
    `ENEMY PROVINCES (${enemyProvinces.length})\n${compact(enemyProvinces, 20000)}`,
    `OUR THRONE INTEL (${throne.length})\n${compact(throne, 16000)}`,
    `ENEMY THRONE INTEL (${enemyThrone.length})\n${compact(enemyThrone, 18000)}`,
    `SCIENCE INTEL (${science.length})\n${compact(science, 14000)}`,
    `BUILDING INTEL (${buildings.length})\n${compact(buildings, 12000)}`,
    `MILITARY INTEL (${military.length})\n${compact(military, 14000)}`,
    `OPS INTEL (${ops.length})\n${compact(ops, 12000)}`,
    `INTEL 7 EVENTS (${events.length})\n${compact(events, 18000)}`,
    `ATTACKS (${attacks.length})\n${compact(attacks, 14000)}`,
    `HOSTILE OPS (${hostileOps.length})\n${compact(hostileOps, 10000)}`,
    `SPELL EVENTS (${spells.length})\n${compact(spells, 10000)}`,
    `NEWS EVENTS (${news.length})\n${compact(news, 10000)}`,
    `KINGDOMS (${kingdoms.length})\n${compact(kingdoms, 8000)}`,
    `WARS (${wars.length})\n${compact(wars, 8000)}`,
    `ACTIVE REFERENCE BUILDS (${aiBuilds.length})\n${compact(aiBuilds, 12000)}`,
    `RECENT RAW PAGE INGEST (${rawPages.length})\n${compact(rawPages.map(r => ({received_at:r.received_at,kd_code:r.kd_code,province:r.province,source:r.source,tab:r.tab,data_type:r.data_type,parsed:r.parsed,raw_text:r.raw_text ? r.raw_text.slice(0,1200) : null})), 18000)}`,
  ];

  if (needsRules) {
    sections.push(`RACE RULES\n${compact(raceRules, 12000)}`);
    sections.push(`PERSONALITY RULES\n${compact(personalityRules, 12000)}`);
    sections.push(`SCIENCE RULES / FORMULAS\n${compact(scienceRules, 10000)}`);
    sections.push(`BUILDING RULES\n${compact(buildingRules, 10000)}`);
    sections.push(`SPELL RULES\n${compact(spellRules, 10000)}`);
    sections.push(`GAME RULES\n${compact(gameRules, 10000)}`);
    sections.push(`RELATION RULES\n${compact(relationRules, 8000)}`);
  }

  if (relevantProvince) sections.push(`CURRENT PROVINCE FULL RECORD\n${compact(relevantProvince, 12000)}`);

  return { kd, province, text: sections.join("\n\n") };
}

module.exports = { getKingdomContext };