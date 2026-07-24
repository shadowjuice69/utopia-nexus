const supabaseService = require("./supabase");
const logger = require("./logger");
const opsAnalysisService = require("./opsAnalysisService");

async function getWarData() {
  const supabase = supabaseService.getClient();
  if (!supabase) return null;

  try {
    const since = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

    const [attacks, hostileOps, intelMilitary, intelThrone, intelOps] = await Promise.all([
      supabase.from("attacks").select("*").gte("timestamp", since).order("timestamp", { ascending: false }).limit(50),
      supabase.from("hostile_ops").select("*").gte("timestamp", since).order("timestamp", { ascending: false }).limit(100),
      supabase.from("intel_military").select("*").limit(20),
      supabase.from("intel_throne").select("*").limit(20),
    supabase.from("intel_ops").select("*").limit(50),
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
    };
  } catch (err) {
    logger.error(`[WAR ANALYSIS ERROR] ${err.message}`);
    return null;
  }
}

async function analyzeWar() {
  const data = await getWarData();
  if (!data) return null;

  const { attacks, hostileOps, intelMilitary, intelThrone, intelOps } = data;

  logger.info(`[WAR DATA] attacks=${attacks.length} ops=${hostileOps.length} mil=${intelMilitary.length} throne=${intelThrone.length}`);

  if (attacks.length === 0 && hostileOps.length === 0) {
    return "No war activity found in the last 72 hours.";
  }

  const attackSummary = attacks.map(a =>
    `${a.attacker_province} → ${a.target_province} (${a.attack_type}, ${a.acres_captured || 0} acres)`
  ).join("\n");

  const opsSummary = hostileOps.map(o =>
    `${o.attacker_province} → ${o.target_province}: ${o.operation} [${o.success ? "SUCCESS" : "FAIL"}]`
  ).join("\n");

  const militarySummary = intelMilitary.map(m =>
    JSON.stringify(m)
  ).join("\n");

  const throneSummary = intelThrone.map(t =>
    JSON.stringify(t)
  ).join("\n");

  const opsThreats = [];

for (const op of intelOps) {
  const analysis = await opsAnalysisService.analyzeHostileProvince(op.province);
  if (analysis) opsThreats.push(analysis);
}

const prompt = `You are a Utopia war strategist analyzing an active war for kingdom Judo (4:9 WoL).

ATTACKS (${attacks.length} total):
${attackSummary || "None"}

HOSTILE OPS (${hostileOps.length} total):
${opsSummary || "None"}\n\nHOSTILE THREAT ANALYSIS:\n${JSON.stringify(opsThreats, null, 2) || "None"}

ENEMY MILITARY INTEL:
${militarySummary || "None available"}

ENEMY THRONE INTEL:
${throneSummary || "None available"}

Analyze this war:
1. WHAT HAPPENED
2. WHO IS WINNING
3. ENEMY WEAKNESSES
4. RECOMMENDED ACTIONS

Keep it concise and tactical. Use Utopia terminology.`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1000
      })
    });

    const result = await response.json();
    logger.info(`[GROQ RAW] ${JSON.stringify(result).substring(0, 200)}`);

    if (result.choices?.[0]?.message?.content) {
      return result.choices[0].message.content;
    }

    if (result.error) {
      return `Groq API Error: ${result.error.message}`;
    }

    return `Unexpected response: ${JSON.stringify(result).substring(0, 200)}`;
  } catch (err) {
    logger.error(`[GROQ API ERROR] ${err.message}`);
    return null;
  }
}

module.exports = { analyzeWar };
