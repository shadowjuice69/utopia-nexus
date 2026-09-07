const supabaseService = require("./supabase");
const { askOpenRouter } = require("./openrouterService");
const logger = require("./logger");

const SECTION_KEYS = ["buildings", "military", "science", "spells", "thievery", "priorities"];

function extractJson(text) {
  const raw = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try { return JSON.parse(raw); } catch {}
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
  throw new Error("AI returned invalid build JSON");
}

function normalize(result, original) {
  const out = {};
  for (const key of SECTION_KEYS) {
    if (result && Object.prototype.hasOwnProperty.call(result, key)) out[key] = result[key];
    else out[key] = original[key] ?? (key === "priorities" ? [] : {});
  }
  out.description = typeof result?.description === "string" ? result.description : original.description || "";
  out.notes = typeof result?.notes === "string" ? result.notes : original.notes || "";
  return out;
}

function buildPrompt(build, ageNumber, parsed) {
  return [
    "You are the Utopia Nexus build-maintenance engine. An official new Age ruleset has just been approved.",
    `Update this saved reference build for Age ${ageNumber}.`,
    "",
    "NON-NEGOTIABLE RULES:",
    "1. Preserve the build identity: name, race, personality, role, and build type are fixed and must not be changed.",
    "2. Preserve the user's intended strategy and priorities whenever still legal/optimal.",
    "3. Change only buildings, military targets, science allocations, spells, thievery, priorities, description, or notes when the new official rules actually require or justify a change.",
    "4. Use ONLY the supplied official Age rules. Do not invent rules, bonuses, units, spells, science effects, or numbers.",
    "5. If an old choice is still valid under the new Age, keep it.",
    "6. If a choice became invalid or materially worse because of an official rule change, replace it with the closest valid strategy consistent with the build's role.",
    "7. Return ONLY one JSON object. No markdown and no commentary.",
    "",
    "RETURN SHAPE:",
    '{"description":"...","buildings":{},"military":{},"science":{},"spells":{},"thievery":{},"priorities":[],"notes":"..."}',
    "",
    "SAVED BUILD:",
    JSON.stringify({
      name: build.name,
      description: build.description,
      race: build.race,
      personality: build.personality,
      role: build.role,
      build_type: build.build_type,
      buildings: build.buildings,
      military: build.military,
      science: build.science,
      spells: build.spells,
      thievery: build.thievery,
      priorities: build.priorities,
      notes: build.notes
    }),
    "",
    `OFFICIAL AGE ${ageNumber} RULES:`,
    JSON.stringify(parsed)
  ].join("\n");
}

async function recalculateOne(sb, build, ageNumber, ageUpdateId, parsed) {
  const prompt = buildPrompt(build, ageNumber, parsed);
  const response = await askOpenRouter(prompt);
  const updated = normalize(extractJson(response), build);
  const changed = SECTION_KEYS.some((key) => JSON.stringify(updated[key]) !== JSON.stringify(build[key])) || updated.description !== (build.description || "") || updated.notes !== (build.notes || "");

  const snapshot = { ...build, _age_recalculation: { age_number: ageNumber, age_update_id: ageUpdateId, recalculated_at: new Date().toISOString() } };
  const { error: versionError } = await sb.from("ai_build_versions").insert({
    build_id: build.id,
    version: Number(build.version || 1),
    snapshot
  });
  if (versionError) throw versionError;

  const nextVersion = Number(build.version || 1) + 1;
  const changeSummary = changed
    ? `Automatically recalculated for Age ${ageNumber} from official Age update #${ageUpdateId}.`
    : `Validated for Age ${ageNumber}; no build allocation changes were required.`;

  const notes = [updated.notes, changeSummary].filter(Boolean).join("\n");
  const { data, error } = await sb.from("ai_builds").update({
    description: updated.description,
    buildings: updated.buildings,
    military: updated.military,
    science: updated.science,
    spells: updated.spells,
    thievery: updated.thievery,
    priorities: updated.priorities,
    notes,
    version: nextVersion,
    age_number: ageNumber,
    age_update_id: ageUpdateId,
    age_recalculated_at: new Date().toISOString(),
    age_change_summary: changeSummary,
    updated_at: new Date().toISOString()
  }).eq("id", build.id).select().single();
  if (error) throw error;

  return { data, changed };
}

async function recalculateBuildLibrary(ageNumber, ageUpdateId, parsed) {
  const sb = supabaseService.getClient();
  if (!sb) throw new Error("Supabase is not configured");

  const { data: builds, error } = await sb.from("ai_builds").select("*").eq("active", true).order("updated_at", { ascending: false });
  if (error) throw error;
  if (!builds?.length) return { total: 0, updated: 0, unchanged: 0, failed: [] };

  let cursor = 0;
  let updated = 0;
  let unchanged = 0;
  const failed = [];
  const workers = Array.from({ length: Math.min(3, builds.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= builds.length) return;
      const build = builds[index];
      try {
        const result = await recalculateOne(sb, build, ageNumber, ageUpdateId, parsed);
        if (result.changed) updated += 1; else unchanged += 1;
      } catch (err) {
        failed.push({ id: build.id, name: build.name || "Unnamed Build", error: err.message });
        logger.error(`[BUILD AGE RECALC] ${build.name || build.id}: ${err.message}`);
      }
    }
  });
  await Promise.all(workers);

  logger.info(`[BUILD AGE RECALC] Age ${ageNumber}: ${updated} changed, ${unchanged} unchanged, ${failed.length} failed out of ${builds.length}`);
  return { total: builds.length, updated, unchanged, failed };
}

module.exports = { recalculateBuildLibrary };
