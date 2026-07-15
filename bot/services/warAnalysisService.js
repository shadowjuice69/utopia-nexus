const supabaseService = require("./supabase");
const logger = require("./logger");

async function getWarData() {
  const supabase = supabaseService.getClient();
  if (!supabase) return null;

  try {
    const since = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

    const [attacks, hostileOps, intelMilitary, intelThrone] = await Promise.all([
      supabase.from("attacks").select("*").gte("timestamp", since).order("timestamp", { ascending: false }).limit(50),
      supabase.from("hostile_ops").select("*").gte("timestamp", since).order("timestamp", { ascending: false }).limit(100),
      supabase.from("intel_military").select("*").order("updated_at", { ascending: false }).limit(20),
      supabase.from("intel_throne").select("*").order("updated_at", { ascending: false }).limit(20),
    ]);

    return {
      attacks: attacks.data || [],
      hostileOps: hostileOps.data || [],
      intelMilitary: intelMilitary.data || [],
      intelThrone: intelThrone.data || [],
    };
  } catch (err) {
    logger.error(`[WAR ANALYSIS ERROR] ${err.message}`);
    return null;
  }
}

async function analyzeWar() {
  const data = await getWarData();
  if (!data) return null;

  const { attacks, hostileOps, intelMilitary, intelThrone } = data;

  if (attacks.length === 0 && hostileOps.length === 0) {
    return "No war activity found in the last 72 hours.";
  }

  const attackSummary = attacks.map(a =>
    `${a.attacker_province} → ${a.target_province} (${a.attack_type}, ${a.acres_captured || 0} acres, ${a.timestamp})`
  ).join("\n");

  const opsSummary = hostileOps.map(o =>
    `${o.attacker_province} → ${o.target_province}: ${o.operation} [${o.success ? "SUCCESS" : "FAIL"}] (${o.timestamp})`
  ).join("\n");

  const militarySummary = intelMilitary.map(m =>
    `${m.province_name}: Off=${m.offense_points || "?"} Def=${m.defense_points || "?"} NW=${m.networth || "?"}`
  ).join("\n");

  const throneSummary = intelThrone.map(t =>
    `${t.province_name}: Race=${t.race || "?"} Personality=${t.personality || "?"} Land=${t.land || "?"} NW=${t.networth || "?"}`
  ).join("\n");

  const prompt = `You are a Utopia war strategist analyzing an active war for kingdom Judo (coordinates 4:9 on WoL).

Here is the war data from the last 72 hours:

ATTACKS (${attacks.length} total):
${attackSummary || "None"}

HOSTILE OPS (${hostileOps.length} total):
${opsSummary || "None"}

ENEMY MILITARY INTEL:
${militarySummary || "None available"}

ENEMY THRONE INTEL:
${throneSummary || "None available"}

Please analyze this war and provide:
1. WHAT HAPPENED - Summary of key events
2. WHO IS WINNING - Based on land gained/lost and op damage
3. ENEMY WEAKNESSES - Provinces that are vulnerable based on intel
4. RECOMMENDED ACTIONS - Specific targets and strategies for next 24 hours

Keep it concise and tactical. Use Utopia terminology.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 1000 }
        })
      }
    );

    const result = await response.json();
    return result.candidates[0].content.parts[0].text;
  } catch (err) {
    logger.error(`[GEMINI API ERROR] ${err.message}`);
    return null;
  }
}

module.exports = { analyzeWar };
