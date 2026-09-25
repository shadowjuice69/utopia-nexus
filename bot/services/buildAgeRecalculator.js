const supabaseService = require("./supabase");
const { askOpenRouter } = require("./openrouterService");
const { parseAgeFileChunked: parseAgeFile } = require("../parsers/ageParser");
const logger = require("./logger");

function extractJson(text) {
  const raw = String(text || "").trim().replace(/^\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`$/i, "").trim();
  try { return JSON.parse(raw); } catch {}
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
  throw new Error("AI returned invalid build JSON");
}

function normalize(result, original) {
  return {
    buildings: result?.buildings ?? original.buildings ?? {},
    science: result?.science ?? original.science ?? {},
    military_requirement: result?.military_requirement ?? original.military_requirement ?? {}
  };
}

function buildPrompt(build, ageNumber, parsed) {
  return [
    "You are the Utopia Spartan build-maintenance engine. An official new Age ruleset has just been approved.",
    `Update this saved Spartan Build Library build for Age ${ageNumber}.`,
    "",
    "NON-NEGOTIABLE RULES:",
    "1. Preserve the build identity: name, race, personality, author, and strategy identity. Do not change them.",
    "2. Preserve the user's intended strategy whenever still legal under the supplied official rules.",
    "3. Change only buildings, science, or military requirements when the official rules require or justify a change.",
    "4. Use ONLY the supplied official Age rules. Never invent bonuses, units, spells, science effects, or numbers.",
    "5. If an existing allocation remains valid, keep it.",
    "6. Return ONLY one JSON object with buildings, science, and military_requirement.",
    "",
    "RETURN SHAPE:",
    '{"buildings":{},"science":{},"military_requirement":{}}',
    "",
    "SAVED SPARTAN BUILD:",
    JSON.stringify({
      name: build.name,
      race: build.race,
      personality: build.personality,
      author: build.author,
      buildings: build.buildings,
      science: build.science,
      military_requirement: build.military_requirement
    }),
    "",
    `OFFICIAL AGE ${ageNumber} RULES:`,
    JSON.stringify(parsed)
  ].join("\n");
}

function extractRuleSnapshots(parsed) {
  return {
    raceRules: parsed?.races || {},
    personalityRules: parsed?.personalities || {}
  };
}

async function recalculateOne(sb, build, ageNumber, ageUpdateId, parsed) {
  const response = await askOpenRouter(buildPrompt(build, ageNumber, parsed));
  const updated = normalize(extractJson(response), build);
  const changed =
    JSON.stringify(updated.buildings) !== JSON.stringify(build.buildings || {}) ||
    JSON.stringify(updated.science) !== JSON.stringify(build.science || {}) ||
    JSON.stringify(updated.military_requirement) !== JSON.stringify(build.military_requirement || {});

  const { raceRules, personalityRules } = extractRuleSnapshots(parsed);
  const { data, error } = await sb.from("spartan_builds").update({
    buildings: updated.buildings,
    science: updated.science,
    military_requirement: updated.military_requirement,
    race_rule_snapshot: raceRules[build.race] || null,
    personality_rule_snapshot: personalityRules[build.personality] || null,
    rules_age_number: ageNumber,
    updated_at: new Date().toISOString()
  }).eq("id", build.id).select().single();

  if (error) throw error;
  return { data, changed, ageUpdateId };
}

async function recalculateBuildLibrary(ageNumber, ageUpdateId, parsed) {
  const sb = supabaseService.getClient();
  if (!sb) throw new Error("Supabase is not configured");

  let rules = parsed;
  if (!rules || !Object.keys(rules).length) {
    const { data: update, error: updateError } = await sb.from("age_updates").select("raw_text").eq("id", ageUpdateId).single();
    if (updateError) throw updateError;
    rules = parseAgeFile(update.raw_text);
  }

  const { data: builds, error } = await sb
    .from("spartan_builds")
    .select("*")
    .eq("active", true)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  if (!builds?.length) return { total: 0, updated: 0, unchanged: 0, failed: [] };

  let cursor = 0;
  let updatedCount = 0;
  let unchanged = 0;
  const failed = [];

  const workers = Array.from({ length: Math.min(3, builds.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= builds.length) return;
      const build = builds[index];
      try {
        const result = await recalculateOne(sb, build, ageNumber, ageUpdateId, rules);
        if (result.changed) updatedCount += 1;
        else unchanged += 1;
      } catch (err) {
        failed.push({ id: build.id, name: build.name || "Unnamed Build", error: err.message });
        logger.error(`[BUILD AGE RECALC] ${build.name || build.id}: ${err.message}`);
      }
    }
  });

  await Promise.all(workers);
  logger.info(`[BUILD AGE RECALC] Age ${ageNumber}: ${updatedCount} changed, ${unchanged} unchanged, ${failed.length} failed out of ${builds.length}`);
  return { total: builds.length, updated: updatedCount, unchanged, failed };
}

module.exports = { recalculateBuildLibrary };
