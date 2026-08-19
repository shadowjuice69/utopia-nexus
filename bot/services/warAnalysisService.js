const supabaseService = require("./supabase");
const { getKingdomInfo } = require("./kingdomService");
const logger = require("./logger");
const opsAnalysisService = require("./opsAnalysisService");
const { getRecentOps } = require("./opsIntelService");

async function getWarData() {
  const supabase = supabaseService.getClient();
  if (!supabase) return null;

  try {
    const since = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

    const [attacks, hostileOps, intelMilitary, intelThrone, intelOps, allyOps] = await Promise.all([
      supabase.from("attacks").select("*").gte("timestamp", since).order("timestamp", { ascending: false }).limit(50),
      supabase.from("hostile_ops").select("*").gte("timestamp", since).order("timestamp", { ascending: false }).limit(100),
      supabase.from("intel_military").select("*").neq("kd_code", process.env.MY_KD).limit(20),
      supabase.from("intel_throne").select("*").neq("kd_code", process.env.MY_KD).limit(20),
    supabase.from("intel_ops").select("*").limit(50),
      getRecentOps(72),
    ]);

    if (attacks.error) logger.error(`[ATTACKS ERROR] ${attacks.error.message}`);
    if (hostileOps.error) logger.error(`[OPS ERROR] ${hostileOps.error.message}`);
    if (intelMilitary.error) logger.error(`[INTEL MIL ERROR] ${intelMilitary.error.message}`);
    if (intelThrone.error) logger.error(`[INTEL THRONE ERROR] ${intelThrone.error.message}`);
    if (intelOps.error) logger.error(`[INTEL OPS ERROR] ${intelOps.error.message}`);

    return {
      attacks: attacks.data || [],
      hostileOps: hostileOps.data || [],
      intelMilitary: intelMilitary.data || [],
      intelThrone: intelThrone.data || [],
    intelOps: intelOps.data || [],
      allyOps: allyOps || [],
    };
  } catch (err) {
    logger.error(`[WAR ANALYSIS ERROR] ${err.message}`);
    return null;
  }
}

async function analyzeWar() {
  const kd = await getKingdomInfo();
  const data = await getWarData();
  if (!data) return null;

  const { attacks, hostileOps, intelMilitary, intelThrone, intelOps, allyOps } = data;

  logger.info(`[WAR DATA] attacks=${attacks.length} ops=${hostileOps.length} allyOps=${allyOps.length} mil=${intelMilitary.length} throne=${intelThrone.length}`);

  if (attacks.length === 0 && hostileOps.length === 0 && allyOps.length === 0) {
    return "No war activity found in the last 72 hours.";
  }

  const attackSummary = attacks.slice(0, 15).map(a =>
    `${a.attacker_province}→${a.target_province} ${a.attack_type} ${a.acres_captured||0}ac`
  ).join("\n");

  const opsSummary = hostileOps.slice(0, 15).map(o =>
    `${o.attacker_province}→${o.target_province} ${o.operation} [${o.success?"OK":"FAIL"}]`
  ).join("\n");

  const militarySummary = intelMilitary.slice(0, 10).map(m =>
    `${m.province} (${m.kd_code}) Off:${m.offense} Def:${m.defense} Armies:${(m.armies||[]).length}`
  ).join("\n");

  const throneSummary = intelThrone.slice(0, 10).map(t =>
    `${t.province} (${t.kd_code}) ${t.race||'?'} NW:${t.networth} Land:${t.land} Off:${t.offense} Def:${t.defense} TPA:${t.tpa}`
  ).join("\n");

  const allyOpsSummary = allyOps.map(o =>
  `${o.attacker_province} → ${o.target_province}: ${o.op} [${o.outcome}] aTPA:${o.att_tpa_modified || "?"} dTPA:${o.def_tpa_modified || "?"} aWPA:${o.att_wpa_modified || "?"} dWPA:${o.def_wpa_modified || "?"}`
).join("\n");

const opsThreats = [];

for (const op of intelOps) {
  const analysis = await opsAnalysisService.analyzeHostileProvince(op.province);
  if (analysis) opsThreats.push(analysis);
}

const prompt = `Utopia war strategist for ${kd.name} (${kd.code}).

ATTACKS(${attacks.length}): ${attackSummary||"None"}

OPS(${hostileOps.length}): ${opsSummary||"None"}

ALLY OPS(${allyOps.length}): ${allyOpsSummary||"None"}

ENEMY MIL: ${militarySummary||"None"}

ENEMY THRONE: ${throneSummary||"None"}

Analyze: 1)What happened 2)Who is winning 3)Enemy weaknesses 4)Actions. Be concise. /no_think`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        messages: [{ role: "system", content: "You are a concise war analyst. Never use <think> tags. Respond directly with your analysis." }, { role: "user", content: prompt }],
        max_tokens: 1200
      })
    });
    const result = await response.json();
    if (result.choices?.[0]?.message?.content) {
      const raw = result.choices[0].message.content;
      return raw.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim();
    }
    if (result.error) return `Error: ${result.error.message}`;
    return null;
  } catch (err) {
    logger.error(`[WAR ANALYSIS ERROR] ${err.message}`);
    return null;
  }
}

module.exports = { analyzeWar };
