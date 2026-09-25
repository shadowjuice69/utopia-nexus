const supabaseService = require("./supabase");
const logger = require("./logger");
const { parseAgeFileChunked: parseAgeFile, summarize } = require("../parsers/ageParser");
const { recalculateBuildLibrary } = require("./buildAgeRecalculator");

async function saveAgeUpdate(updateText, userId, filename) {
  const supabase = supabaseService.getClient();
  if (!supabase) return null;

  updateText = String(updateText)
    .replace(/\u0000/g, "")
    .replace(/\\(?!["\\/bfnrtu])/g, "");

  try {
    const match = filename?.match(/Age[_\s-]?(\d+)/i);
    const ageNumber = match ? parseInt(match[1], 10) : null;
    if (!ageNumber) {
      logger.info(`[AGE UPDATE] Rejected - no age number in filename: ${filename}`);
      return { error: "no_age_number" };
    }

    const { data: existing } = await supabase
      .from("age_updates")
      .select("id,status")
      .eq("age_number", ageNumber)
      .eq("submitted_by", userId)
      .in("status", ["pending", "approved"])
      .limit(1);

    if (existing?.length) {
      return { error: "duplicate", existingId: existing[0].id, status: existing[0].status };
    }

    const parsed = parseAgeFile(updateText);
    const parsedSummary = summarize(parsed);
    const { data, error } = await supabase.from("age_updates").insert({
      age_number: ageNumber,
      raw_text: updateText,
      source: "discord",
      submitted_by: userId,
      status: "pending"
    }).select().single();

    if (error) throw error;
    logger.info(`[AGE UPDATE SAVED] ID ${data.id} AGE ${ageNumber}`);
    return { ...data, parsedSummary };
  } catch (err) {
    logger.error(`[AGE UPDATE ERROR] ${err.message}`);
    return null;
  }
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

async function approveAgeUpdate(id, adminId) {
  const supabase = supabaseService.getClient();
  if (!supabase) return null;

  try {
    const { data: update, error: fetchError } = await supabase.from("age_updates").select("*").eq("id", id).single();
    if (fetchError) throw fetchError;

    const parsed = parseAgeFile(update.raw_text);
    const ageNumber = update.age_number;

    await supabase.from("spartan_race_rules").delete().eq("age_number", ageNumber);
    await supabase.from("spartan_personality_rules").delete().eq("age_number", ageNumber);
    await supabase.from("spartan_game_rules").delete().eq("age_number", ageNumber);

    const raceRows = Object.entries(parsed.races || {}).map(([race, data]) => ({
      age_number: ageNumber,
      race,
      emoji: data.emoji || null,
      archetype: data.archetype || null,
      war_doctrine: data.war_doctrine || null,
      unique_name: data.unique_name || null,
      unique_desc: data.unique_passive || null,
      bonuses: safeArray(data.bonuses).join("\n"),
      penalties: safeArray(data.penalties).join("\n"),
      units: JSON.stringify(data.units || {}),
      spells: safeArray(data.spells).join(", ")
    }));

    const personalityRows = Object.entries(parsed.personalities || {}).map(([personality, data]) => ({
      age_number: ageNumber,
      personality,
      emoji: data.emoji || null,
      unique_name: data.unique_name || null,
      unique_desc: data.unique_passive || null,
      bonuses: safeArray(data.bonuses).join("\n"),
      start_bonus: safeArray(data.starts_with).join("\n"),
      spells: safeArray(data.spells).join(", ")
    }));

    const gameRows = [];
    for (const [category, section] of Object.entries({
      spell: parsed.spells,
      thievery: parsed.thievery,
      building: parsed.buildings,
      science: parsed.science,
      game: parsed.game_rules
    })) {
      for (const [rule_name, value] of Object.entries(section || {})) {
        gameRows.push({
          age_number: ageNumber,
          category,
          rule_name,
          value: value ?? null,
          description: typeof value === "string" ? value : JSON.stringify(value)
        });
      }
    }

    for (const [name, dragon] of Object.entries(parsed.dragons || {})) {
      for (const effect of safeArray(dragon.effects)) {
        gameRows.push({
          age_number: ageNumber,
          category: "dragon",
          rule_name: name,
          value: effect,
          description: String(effect)
        });
      }
    }

    if (raceRows.length) {
      const { error } = await supabase.from("spartan_race_rules").insert(raceRows);
      if (error) throw error;
    }
    if (personalityRows.length) {
      const { error } = await supabase.from("spartan_personality_rules").insert(personalityRows);
      if (error) throw error;
    }
    if (gameRows.length) {
      const { error } = await supabase.from("spartan_game_rules").insert(gameRows);
      if (error) throw error;
    }

    const { data, error } = await supabase.from("age_updates")
      .update({ status: "approved", approved_by: adminId, approved_at: new Date().toISOString() })
      .eq("id", id).select().single();
    if (error) throw error;

    const { error: ageSettingError } = await supabase.from("bot_settings").upsert({
      key: "current_age",
      value: String(ageNumber),
      updated_at: new Date().toISOString()
    }, { onConflict: "key" });
    if (ageSettingError) throw ageSettingError;

    let recalculation = null;
    try {
      recalculation = await recalculateBuildLibrary(ageNumber, id, parsed);
    } catch (err) {
      logger.error(`[AGE BUILD RECALC ERROR] ${err.message}`);
      recalculation = { error: err.message };
    }

    logger.info(`[AGE UPDATE APPROVED] ID ${id} AGE ${ageNumber}; races=${raceRows.length}, personalities=${personalityRows.length}, game_rules=${gameRows.length}`);

    return {
      ...data,
      stats: {
        races: raceRows.length,
        personalities: personalityRows.length,
        gameRows: gameRows.length,
        summary: summarize(parsed),
        recalculation
      }
    };
  } catch (err) {
    logger.error(`[AGE APPROVE ERROR] ${err.message}`);
    return null;
  }
}

async function denyAgeUpdate(id, adminId) {
  const supabase = supabaseService.getClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from("age_updates")
      .update({ status: "rejected", approved_by: adminId, approved_at: new Date().toISOString() })
      .eq("id", id).select().single();
    if (error) throw error;
    logger.info(`[AGE UPDATE REJECTED] ID ${id} BY ${adminId}`);
    return data;
  } catch (err) {
    logger.error(`[AGE DENY ERROR] ${err.message}`);
    return null;
  }
}

module.exports = { saveAgeUpdate, approveAgeUpdate, denyAgeUpdate };
