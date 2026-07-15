const supabaseService = require("./supabase");
const logger = require("./logger");

async function getWarData() {
  const supabase = supabaseService.getClient();
  if (!supabase) return null;

  try {
    // Get recent attacks (last 72 hours)
    const since = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

    const [attacks, hostileOps, intelMilitary, intelThrone] = await Promise.all([
      supabase
        .from("attacks")
        .select("*")
        .gte("timestamp", since)
        .order("timestamp", { ascending: false })
        .limit(50),

      supabase
        .from("hostile_ops")
        .select("*")
        .gte("timestamp", since)
        .order("timestamp", { ascending: false })
        .limit(100),

      supabase
        .from("intel_military")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(20),

      supabase
        .from("intel_throne")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(20),
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

  // Build summary for Claude
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
${t
cat > ~/utopia-nexus/bot/handlers/commands/analyzeWarHandler.js << 'EOF'
const { analyzeWar } = require("../../services/warAnalysisService");

module.exports = async function analyzeWarHandler(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const analysis = await analyzeWar();

  if (!analysis) {
    await interaction.editReply("⚠️ Could not retrieve war data. Check database connection.");
    return;
  }

  // Split if over Discord 2000 char limit
  if (analysis.length <= 1900) {
    await interaction.editReply(`⚔️ **War Analysis**\n\n${analysis}`);
  } else {
    const chunks = analysis.match(/.{1,1900}/gs);
    await interaction.editReply(`⚔️ **War Analysis**\n\n${chunks[0]}`);
    for (let i = 1; i < chunks.length; i++) {
      await interaction.followUp({ content: chunks[i], ephemeral: true });
    }
  }
};
